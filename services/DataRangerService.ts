import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

import { DataService, RatedFeature, FeatureEdit } from '@/adapters/DatabaseAdapter';
import { Feature } from '@/components/MapViewComponent';
import type { NetworkSegment, SegmentEdit, FacilityType, CurbRampSlot, GeometryEditPayload, GeometryEditRecord } from '@/services/types/NetworkSegment';
import type { MapAdapter } from '@/services/rnMapboxAdapter';
import { SegmentSpatialGrid } from '@/services/utils/SegmentSpatialGrid';
import { getRenderColumns, rowToNetworkSegment } from '@/services/utils/parquetToSegments';
import { bboxToGridCells } from '@/services/utils/wgs84ToUtm';
import { canGradeTrip } from '@/utils/timeValidation';

// ═══════════════════════════════════════════════════════════
// DATA RANGER SERVICE
// ═══════════════════════════════════════════════════════════
// Manages proximity network segments, curb ramp querying, rating
// orchestration, and segment correction for DataRanger mode.
//
// All feature and segment data comes from the Proximity parquet
// downloaded from Supabase Storage. Curb ramps are extracted as
// point features from segments with segment_type === 'curb_ramp'.

// --- Error Messages ---

const ERROR_MESSAGES = {
  INVALID_RATING: 'Rating must be between 1 and 10',
  INVALID_FEATURE: 'Feature data is invalid or incomplete',
  INVALID_COORDINATES: 'Invalid latitude or longitude values',
  STORAGE_WRITE_FAILED: 'Failed to save rating. Please try again.',
  STORAGE_READ_FAILED: 'Failed to load ratings',
  IMAGE_UPLOAD_FAILED: 'Failed to upload image',
  NOT_INITIALIZED: 'DataRanger service is not initialized',
  FEATURE_QUERY_FAILED: 'Failed to query nearby features',
  GRADING_WINDOW_EXPIRED: 'Features can only be graded within 6 hours of trip completion',
};

// --- DataRanger Service ---

class DataRangerServiceClass {
  private queryCache: Map<string, { features: Feature[]; location: { lat: number; lon: number } }> = new Map();
  private readonly MAX_CACHE_SIZE = 10;
  private readonly CACHE_INVALIDATION_DISTANCE_M = 10;
  private readonly MAX_RESULTS = 50;
  private readonly DEFAULT_RADIUS_M = 50;

  // Storage paths
  private readonly PARQUET_FILE_NAME = 'proximity_network.parquet';
  private readonly GRID_INDEX_FILE_NAME = 'proximity_grid_index.json';
  private readonly PROXIMITY_VERSION_KEY = '@proximity/version';
  private readonly PENDING_GEOMETRY_EDITS_KEY = '@dataranger/pendingGeometryEdits';

  // Chunked read batch size — keeps per-call allocation under ~4 MB
  private readonly INDEX_BUILD_BATCH_SIZE = 2000;

  // Parquet state (lazy loading)
  private parquetFile: InstanceType<typeof File> | null = null;
  private gridOrigin: { x: number; y: number; cellSize: number } | null = null;
  private gridCellIndex: Map<string, Set<number>> | null = null; // "col_row" → row group indices
  private loadedCells: Map<string, NetworkSegment[]> = new Map();
  private loadingCells: Set<string> = new Set();
  private segments: NetworkSegment[] = [];
  private segmentIndex: SegmentSpatialGrid | null = null;
  private segmentMap: Map<string, NetworkSegment> = new Map();
  private isInitialized: boolean = false;
  // Deduplicates concurrent initialize() calls — both callers join the same promise
  // instead of each allocating a 124MB ArrayBuffer, which would cause Android OOM.
  private initializingPromise: Promise<void> | null = null;

  // Track ratings for current trip: cris_id → userRating
  private ratedFeatures: Map<string, number> = new Map();
  private currentTripId: string | null = null;

  // Debug counter for logging
  private debugRatedCount: number = 0;

  /**
   * Initialize by loading proximity network metadata (lazy — no row parsing).
   */
  async initialize(checkForUpdates: boolean = false): Promise<void> {
    return this.initializeProximity(checkForUpdates);
  }

  /**
   * Initialize the proximity network: download parquet if needed, read metadata,
   * and build a grid cell index from the street_grid_id column.
   * Does NOT parse full segment rows — those are loaded on demand.
   */
  async initializeProximity(checkForUpdates: boolean = false): Promise<void> {
    if (this.isInitialized) {
      if (checkForUpdates) {
        this.checkAndUpdateProximity().catch(err =>
          console.warn('[DataRangerService] Background update check failed:', err)
        );
      }
      return;
    }

    // If another caller already started initialization, join that promise instead of
    // starting a second one. A duplicate 124 MB ArrayBuffer allocation causes Android OOM.
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = this._doInitializeProximity(checkForUpdates).finally(() => {
      this.initializingPromise = null;
    });
    return this.initializingPromise;
  }

  private async _doInitializeProximity(checkForUpdates: boolean): Promise<void> {
    try {
      console.log('[DataRangerService] Initializing (metadata only)...');

      // Ensure parquet file exists on disk (download if needed)
      this.parquetFile = await this.ensureParquetFile();
      console.log('[DataRangerService] Parquet file ready, reading metadata...');

      // Read metadata to get grid origin (reads only the footer from disk)
      const { parquetMetadataAsync } = await import('hyparquet/src/index.js');
      const metaBuffer = this.createFileAsyncBuffer();
      let metadata;
      try {
        metadata = await parquetMetadataAsync(metaBuffer);
      } finally {
        metaBuffer.close();
      }

      // Extract grid origin from key-value metadata
      const originKv = metadata.key_value_metadata?.find(
        (kv: { key: unknown }) => String(kv.key ?? '') === 'proximity_grid_origin'
      );
      if (originKv) {
        const raw = originKv.value as string | Uint8Array | undefined;
        const jsonStr = raw instanceof Uint8Array ? new TextDecoder().decode(raw) : (raw ?? '');
        const parsed = JSON.parse(jsonStr) as { x: number; y: number; cell_size?: number; cellSize?: number };
        // Parquet stores it as snake_case `cell_size`; normalize to camelCase.
        this.gridOrigin = { x: parsed.x, y: parsed.y, cellSize: parsed.cell_size ?? parsed.cellSize ?? 500 };
        console.log('[DataRangerService] Grid origin:', this.gridOrigin);
      } else {
        throw new Error('Parquet missing proximity_grid_origin metadata — re-run the pipeline and re-upload.');
      }

      // Try loading cached grid cell index from disk first
      const cachedIndex = await this.loadGridCellIndexFromDisk();
      if (cachedIndex) {
        this.gridCellIndex = cachedIndex;
        console.log(`[DataRangerService] Loaded cached grid index: ${cachedIndex.size} cells`);
      } else {
        // Build from parquet in small batches to avoid large single allocations
        await this.buildGridCellIndex();
        // Persist to disk so subsequent launches skip the expensive build
        await this.saveGridCellIndexToDisk();
      }

      this.isInitialized = true;
      console.log(`[DataRangerService] Initialized: ${this.gridCellIndex?.size ?? 0} grid cells indexed`);

      if (checkForUpdates) {
        this.checkAndUpdateProximity().catch(err =>
          console.warn('[DataRangerService] Background update check failed:', err)
        );
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null
            ? JSON.stringify(error) || '[empty native error]'
            : String(error);
      console.warn('[DataRangerService] Initialization failed:', msg);
      throw new Error(`DataRanger init failed: ${msg}`);
    }
  }

  /**
   * Create an AsyncBuffer backed by on-disk file reads via FileHandle.
   * Reads only the requested byte ranges — never loads the full parquet into JS heap.
   */
  private createFileAsyncBuffer() {
    const file = this.parquetFile!;
    // Keep ONE file handle open for the lifetime of the buffer instead of
    // open/close per slice. Each slice() typically reads a small column page;
    // a 200-column row group triggers hundreds of slices and the syscall
    // overhead from open/close was freezing the JS thread for seconds.
    const handle = file.open();
    const fileSize = handle.size!;

    return {
      byteLength: fileSize,
      slice(start: number, end?: number): Promise<ArrayBuffer> {
        const len = (end ?? fileSize) - start;
        handle.offset = start;
        const bytes = handle.readBytes(len);
        return Promise.resolve(bytes.buffer);
      },
      close() {
        try { handle.close(); } catch { /* ignore */ }
      },
    };
  }

  /**
   * Ensure the parquet file exists on disk and is valid.
   * Downloads from Supabase on first run; subsequent launches use the cached file.
   * Returns a File handle — the file is NEVER loaded entirely into JS heap.
   */
  private async ensureParquetFile(): Promise<InstanceType<typeof File>> {
    const file = new File(Paths.document, this.PARQUET_FILE_NAME);
    if (file.exists) {
      console.log('[DataRangerService] Parquet file found in cache, validating...');
      if (this.isParquetValid(file)) {
        return file;
      }
      console.warn('[DataRangerService] Cached parquet invalid or truncated, re-downloading');
      try { file.delete(); this.deleteGridIndexCache(); } catch { /* ignore */ }
    }

    return this.downloadParquet(file);
  }

  private isParquetValid(file: InstanceType<typeof File>): boolean {
    try {
      const handle = file.open();
      try {
        const fileSize = handle.size ?? 0;
        console.log(`[DataRangerService] Cached file size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

        // Minimum viable parquet is several MB for this dataset.
        // A partial download will be much smaller than the real file.
        if (fileSize < 5 * 1024 * 1024) {
          console.warn('[DataRangerService] File too small, likely truncated download');
          return false;
        }

        // Check PAR1 magic at header (bytes 0-3)
        const header = handle.readBytes(4);
        const headerOk = header[0] === 0x50 && header[1] === 0x41 && header[2] === 0x52 && header[3] === 0x31;

        // Check PAR1 magic at footer (last 4 bytes) — truncated downloads fail here
        handle.offset = fileSize - 4;
        const footer = handle.readBytes(4);
        const footerOk = footer[0] === 0x50 && footer[1] === 0x41 && footer[2] === 0x52 && footer[3] === 0x31;

        console.log(`[DataRangerService] PAR1 header=${headerOk} footer=${footerOk}`);
        return headerOk && footerOk;
      } finally {
        handle.close();
      }
    } catch (err) {
      console.warn('[DataRangerService] Parquet validation error:', err);
      return false;
    }
  }

  private async downloadParquet(file: InstanceType<typeof File>): Promise<InstanceType<typeof File>> {
    const url = DataService.getProximityAssetUrl();
    console.log('[DataRangerService] Downloading parquet (chunked):', url);

    // Resolve total size upfront so we can issue Range requests.
    const head = await fetch(url, { method: 'HEAD' });
    const totalSize = parseInt(head.headers.get('content-length') ?? '0', 10);
    if (!totalSize) throw new Error('Server did not return Content-Length for parquet');
    console.log(`[DataRangerService] Parquet size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

    // Chunked Range download — each fetch allocates only CHUNK bytes in the
    // JS heap. After writeBytes the Uint8Array is unreferenced and Hermes can
    // GC it before the next chunk arrives, keeping peak heap well under 10 MB.
    const CHUNK = 4 * 1024 * 1024; // 4 MB per request
    file.write(new Uint8Array(0)); // create/truncate destination
    const handle = file.open();
    let written = 0;
    try {
      while (written < totalSize) {
        const end = Math.min(written + CHUNK - 1, totalSize - 1);
        const resp = await fetch(url, { headers: { Range: `bytes=${written}-${end}` } });
        if (resp.status !== 206 && resp.status !== 200) {
          throw new Error(`HTTP ${resp.status} on range ${written}-${end}`);
        }
        const chunk = new Uint8Array(await resp.arrayBuffer());
        handle.writeBytes(chunk);
        written += chunk.byteLength;
        console.log(`[DataRangerService] ${(written / 1024 / 1024).toFixed(1)}/${(totalSize / 1024 / 1024).toFixed(1)} MB`);
      }
    } finally {
      handle.close();
    }

    if (!this.isParquetValid(file)) {
      try { file.delete(); this.deleteGridIndexCache(); } catch { /* ignore */ }
      throw new Error('Parquet download incomplete or corrupt — please retry');
    }

    await AsyncStorage.setItem(this.PROXIMITY_VERSION_KEY, new Date().toISOString());
    console.log(`[DataRangerService] Parquet cached: ${(file.size / 1024 / 1024).toFixed(1)} MB`);
    return file;
  }

  private async buildGridCellIndex(): Promise<void> {
    const { parquetMetadataAsync, parquetRead } = await import('hyparquet/src/index.js');
    const asyncBuffer = this.createFileAsyncBuffer();
    try {
      const metadata = await parquetMetadataAsync(asyncBuffer);
      const rowGroups = metadata.row_groups ?? [];

      this.gridCellIndex = new Map(); // cellKey → Set<rowGroupIndex>

      // Compute cumulative row offsets so we can use rowStart/rowEnd per group.
      let globalRowOffset = 0;
      for (let rgIdx = 0; rgIdx < rowGroups.length; rgIdx++) {
        const groupRows = Number(rowGroups[rgIdx].num_rows);
        const rgStart = globalRowOffset;
        globalRowOffset += groupRows;

        const cellsInGroup = new Set<string>();

        // Read street_grid_id in small batches to keep peak allocation low.
        // Parquet column chunks are stored per row group, but requesting a
        // smaller rowStart/rowEnd range lets hyparquet decompress only the
        // pages that overlap the range, avoiding a single 100 MB+ allocation.
        for (let batchStart = rgStart; batchStart < rgStart + groupRows; batchStart += this.INDEX_BUILD_BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + this.INDEX_BUILD_BATCH_SIZE, rgStart + groupRows);

          await new Promise<void>((resolve, reject) => {
            parquetRead({
              file: asyncBuffer,
              metadata,
              columns: ['street_grid_id'],
              rowStart: batchStart,
              rowEnd: batchEnd,
              onChunk: (chunk: any) => {
                const data: unknown[] = chunk.columnData ?? [];
                for (const v of data) {
                  if (typeof v !== 'string') continue;
                  const parts = v.split('_');
                  if (parts.length >= 2) {
                    cellsInGroup.add(`${parts[0]}_${parts[1]}`);
                  }
                }
              },
            }).then(resolve).catch(reject);
          });
        }

        for (const cellKey of cellsInGroup) {
          const existing = this.gridCellIndex.get(cellKey);
          if (existing) {
            existing.add(rgIdx);
          } else {
            this.gridCellIndex.set(cellKey, new Set([rgIdx]));
          }
        }
      }

      console.log(`[DataRangerService] Grid cell index built: ${this.gridCellIndex.size} cells across ${rowGroups.length} row groups`);
    } finally {
      asyncBuffer.close();
    }
  }

  /**
   * Save the grid cell index to a JSON file on disk so subsequent launches
   * can skip the expensive parquet column scan.
   */
  private async saveGridCellIndexToDisk(): Promise<void> {
    if (!this.gridCellIndex) return;
    try {
      // Serialize Map<string, Set<number>> → Record<string, number[]>
      const obj: Record<string, number[]> = {};
      for (const [key, rgSet] of this.gridCellIndex) {
        obj[key] = [...rgSet];
      }
      const file = new File(Paths.document, this.GRID_INDEX_FILE_NAME);
      file.write(JSON.stringify(obj));
      console.log(`[DataRangerService] Grid index cached to disk (${this.gridCellIndex.size} cells)`);
    } catch (err) {
      console.warn('[DataRangerService] Failed to cache grid index:', err);
    }
  }

  /**
   * Load the cached grid cell index from disk.
   * Returns null if the cache file doesn't exist or is corrupt.
   */
  private async loadGridCellIndexFromDisk(): Promise<Map<string, Set<number>> | null> {
    try {
      const file = new File(Paths.document, this.GRID_INDEX_FILE_NAME);
      if (!file.exists) return null;

      const handle = file.open();
      const bytes = handle.readBytes(handle.size!);
      handle.close();

      const text = new TextDecoder().decode(bytes);
      const obj: Record<string, number[]> = JSON.parse(text);

      const map = new Map<string, Set<number>>();
      for (const [key, arr] of Object.entries(obj)) {
        map.set(key, new Set(arr));
      }
      return map;
    } catch (err) {
      console.warn('[DataRangerService] Failed to load cached grid index:', err);
      return null;
    }
  }

  /**
   * Delete the cached grid cell index file from disk.
   */
  private deleteGridIndexCache(): void {
    try {
      const file = new File(Paths.document, this.GRID_INDEX_FILE_NAME);
      if (file.exists) file.delete();
    } catch { /* ignore */ }
  }

  /**
   * Load grid cells that overlap the given bounding box.
   * Skips cells already loaded. Returns when all needed cells are ready.
   */
  async loadGridCellsForBbox(bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }): Promise<void> {
    if (!this.gridOrigin || !this.gridCellIndex || !this.parquetFile) return;

    const range = bboxToGridCells(bbox, { x: this.gridOrigin.x, y: this.gridOrigin.y }, this.gridOrigin.cellSize);

    // Collect which row groups we need and which cell keys to load
    const neededRowGroups = new Set<number>();
    const cellsToLoad: string[] = [];

    for (let col = range.minCol; col <= range.maxCol; col++) {
      for (let row = range.minRow; row <= range.maxRow; row++) {
        const cellKey = `${col}_${row}`;
        if (this.loadedCells.has(cellKey) || this.loadingCells.has(cellKey)) continue;
        const rgs = this.gridCellIndex.get(cellKey);
        if (!rgs) continue;
        cellsToLoad.push(cellKey);
        for (const rg of rgs) neededRowGroups.add(rg);
      }
    }

    if (cellsToLoad.length === 0) return;

    console.log(`[DataRangerService] Loading ${cellsToLoad.length} grid cells from ${neededRowGroups.size} row groups`);
    for (const cellKey of cellsToLoad) this.loadingCells.add(cellKey);

    let asyncBuffer: ReturnType<DataRangerServiceClass['createFileAsyncBuffer']> | null = null;
    try {
      const { parquetMetadataAsync, parquetReadObjects } = await import('hyparquet/src/index.js');
      asyncBuffer = this.createFileAsyncBuffer();
      const columns = getRenderColumns();
      const neededCellSet = new Set(cellsToLoad);

      // Read metadata once so we can compute per-row-group row ranges.
      const metadata = await parquetMetadataAsync(asyncBuffer);
      const rowGroups = metadata.row_groups ?? [];

      // Compute cumulative row offsets for each row group.
      const rgOffsets: number[] = [];
      let offset = 0;
      for (const rg of rowGroups) {
        rgOffsets.push(offset);
        offset += Number(rg.num_rows);
      }

      // Read each needed row group individually using rowStart/rowEnd,
      // then filter rows to only the cells we need.
      const sortedGroups = [...neededRowGroups].sort((a, b) => a - b);

      for (const rgIdx of sortedGroups) {
        const rowStart = rgOffsets[rgIdx];
        const rowEnd = rowStart + Number(rowGroups[rgIdx].num_rows);

        const rows = await parquetReadObjects({
          file: asyncBuffer,
          metadata,
          columns,
          rowStart,
          rowEnd,
        });

        for (const row of rows) {
          const gridId = (row as any).street_grid_id as string;
          if (!gridId) continue;
          const parts = gridId.split('_');
          if (parts.length < 2) continue;
          const cellKey = `${parts[0]}_${parts[1]}`;
          if (!neededCellSet.has(cellKey)) continue;

          const segment = rowToNetworkSegment(row as Record<string, unknown>);
          if (!segment) continue;

          const existing = this.loadedCells.get(cellKey);
          if (existing) {
            existing.push(segment);
          } else {
            this.loadedCells.set(cellKey, [segment]);
          }
          this.segmentMap.set(segment.streetGridId, segment);
        }
      }

      for (const cellKey of cellsToLoad) {
        this.loadingCells.delete(cellKey);
        if (!this.loadedCells.has(cellKey)) this.loadedCells.set(cellKey, []);
      }

      this.rebuildIndex();
      console.log(`[DataRangerService] Loaded cells. Spatial index: ${this.segmentIndex?.getStats().totalSegments ?? 0} segments`);
    } catch (err) {
      for (const cellKey of cellsToLoad) this.loadingCells.delete(cellKey);
      console.warn('[DataRangerService] loadGridCellsForBbox failed:', err);
    } finally {
      asyncBuffer?.close();
    }
  }

  /**
   * Load grid cells near a point (for position-based queries).
   *
   * Default radius matches the visualization query radius (50 m) plus a small
   * buffer for segments whose `street_grid_id` is in a neighboring cell but
   * whose geometry extends within range. Loading larger bboxes (e.g. 500 m)
   * pulled in 9 cells / thousands of segments per query and froze the JS thread.
   */
  async loadGridCellsNearPoint(lat: number, lon: number, radiusM: number = 80): Promise<void> {
    const latDelta = radiusM / 111320;
    const lonDelta = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
    await this.loadGridCellsForBbox({
      minLon: lon - lonDelta,
      minLat: lat - latDelta,
      maxLon: lon + lonDelta,
      maxLat: lat + latDelta,
    });
  }

  private loadSegmentsIntoMemory(segments: NetworkSegment[]): void {
    this.segments = segments;
    this.segmentMap.clear();
    for (const seg of segments) {
      this.segmentMap.set(seg.streetGridId, seg);
    }
    this.segmentIndex = new SegmentSpatialGrid(segments, 0.001);
  }

  private rebuildIndex(): void {
    this.segments = [];
    for (const cellSegments of this.loadedCells.values()) {
      this.segments.push(...cellSegments);
    }
    this.segmentIndex = new SegmentSpatialGrid(this.segments, 0.001);
  }

  private async checkAndUpdateProximity(): Promise<void> {
    try {
      const serverVersion = await DataService.checkAssetUpdates('ProximityNetwork');
      if (!serverVersion) return;

      const localVersion = await AsyncStorage.getItem(this.PROXIMITY_VERSION_KEY);
      if (!localVersion || new Date(serverVersion) > new Date(localVersion)) {
        console.log('[DataRangerService] Proximity update available, re-downloading...');
        // Clear cached files and re-initialize
        const file = new File(Paths.document, this.PARQUET_FILE_NAME);
        if (file.exists) file.delete();
        this.deleteGridIndexCache();

        // Reset state and re-initialize
        this.parquetFile = null;
        this.gridOrigin = null;
        this.gridCellIndex = null;
        this.loadedCells.clear();
        this.loadingCells.clear();
        this.segments = [];
        this.segmentIndex = null;
        this.segmentMap.clear();
        this.isInitialized = false;

        await this.initializeProximity(false);
      }
    } catch (error) {
      console.warn('[DataRangerService] Failed to check proximity updates:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FEATURE QUERIES (curb ramps from proximity segments)
  // ═══════════════════════════════════════════════════════════

  /**
   * Query curb ramp features within radius of a location.
   * Curb ramps are extracted from sidewalk curbRamps[] slots on nearby segments.
   * Returns Feature[] compatible with MapViewComponent.
   *
   * NOTE: Cells must be pre-loaded by the caller via loadGridCellsNearPoint()
   * or loadGridCellsForBbox(). This method only queries already-loaded segments.
   */
  queryNearbyFeatures(lat: number, lon: number, radiusM?: number): Feature[] {
    if (!this.isInitialized || !this.segmentIndex) {
      return [];
    }

    const radius = radiusM ?? this.DEFAULT_RADIUS_M;

    try {
      // Check cache
      const cacheKey = this.getCacheKey(lat, lon);
      const cached = this.queryCache.get(cacheKey);

      if (cached) {
        const distance = this.calculateDistance(
          cached.location.lat,
          cached.location.lon,
          lat,
          lon,
        );
        if (distance <= this.CACHE_INVALIDATION_DISTANCE_M) {
          return cached.features;
        }
        this.queryCache.delete(cacheKey);
      }

      // Query nearby segments and extract curb ramps from sidewalks
      const nearbySegments = this.segmentIndex.queryNearby(lat, lon, radius);
      const mapFeatures: Feature[] = [];

      for (const seg of nearbySegments) {
        // Extract curb ramps from both sidewalks
        const sides = [seg.sidewalkLeft, seg.sidewalkRight];
        for (const sidewalk of sides) {
          if (!sidewalk?.curbRamps) continue;
          for (const ramp of sidewalk.curbRamps) {
            if (!ramp.geometry || !ramp.id) continue;
            const [rampLon, rampLat] = ramp.geometry.coordinates;
            if (this.calculateDistance(lat, lon, rampLat, rampLon) <= radius) {
              mapFeatures.push(this.curbRampToFeature(ramp, seg.streetGridId));
            }
          }
        }

        if (mapFeatures.length >= this.MAX_RESULTS) break;
      }

      const limited = mapFeatures.slice(0, this.MAX_RESULTS);

      // Cache results
      this.cacheQueryResult(cacheKey, limited, lat, lon);

      return limited;
    } catch (error) {
      console.error('[DataRangerService] Error querying nearby features:', error);
      return [];
    }
  }

  /**
   * Convert a CurbRampSlot to a MapViewComponent Feature.
   */
  private curbRampToFeature(ramp: CurbRampSlot, streetGridId: string): Feature {
    const featureId = ramp.id ?? `${streetGridId}_${ramp.position}_${ramp.slotNumber}`;
    const isRated = this.ratedFeatures.has(featureId);
    const userRating = this.ratedFeatures.get(featureId);

    if (isRated && this.debugRatedCount < 3) {
      console.log('[DataRangerService] curbRampToFeature - Rated:', {
        id: featureId,
        isRated,
        userRating,
      });
      this.debugRatedCount++;
    }

    const [rampLon, rampLat] = ramp.geometry!.coordinates;

    return {
      id: featureId,
      coordinate: [rampLon, rampLat],
      type: 'curb_ramp',
      properties: {
        condition_score: ramp.conditionScore ?? undefined,
        location_in_intersection: ramp.returnloc ?? undefined,
        position_on_curb: ramp.returnposition ?? undefined,
        rated: isRated,
        ...(userRating !== undefined && { userRating }),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // SEGMENT QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Query nearby network segments within radius of user position.
   *
   * NOTE: Cells must be pre-loaded by the caller via loadGridCellsNearPoint()
   * or loadGridCellsForBbox(). This method only queries already-loaded segments.
   */
  queryNearbySegments(lat: number, lon: number, radiusM: number = 50): NetworkSegment[] {
    if (!this.isInitialized || !this.segmentIndex) {
      return [];
    }
    return this.segmentIndex.queryNearby(lat, lon, radiusM);
  }

  /**
   * Get a segment by its streetGridId.
   */
  getSegmentById(streetGridId: string): NetworkSegment | null {
    return this.segmentMap.get(streetGridId) ?? null;
  }

  /**
   * Submit an attribute edit for a segment facility.
   * Writes to Supabase and updates the in-memory segment.
   */
  async submitSegmentEdit(edit: SegmentEdit): Promise<void> {
    // Write to Supabase
    await DataService.writeSegmentEdit({
      tripId: edit.tripId,
      userId: edit.userId,
      streetGridId: edit.streetGridId,
      facilityType: edit.facilityType,
      fieldName: edit.fieldName,
      oldValue: edit.oldValue,
      newValue: edit.newValue,
    });

    // Update in-memory segment
    const segment = this.segmentMap.get(edit.streetGridId);
    if (segment) {
      this.applyEditToSegment(segment, edit);
      if (this.segmentIndex) {
        this.segmentIndex.updateSegment(segment);
      }
    }

    // Invalidate query cache
    this.queryCache.clear();
  }

  private applyEditToSegment(segment: NetworkSegment, edit: SegmentEdit): void {
    const facility = this.getFacilityFromSegment(segment, edit.facilityType);
    if (facility && edit.fieldName in facility) {
      const numericFields = ['width', 'incline', 'lanes', 'laneWidth'];
      if (numericFields.includes(edit.fieldName)) {
        (facility as any)[edit.fieldName] = parseFloat(edit.newValue);
      } else {
        (facility as any)[edit.fieldName] = edit.newValue;
      }
    }
  }

  private getFacilityFromSegment(segment: NetworkSegment, facilityType: FacilityType): Record<string, unknown> | null {
    switch (facilityType) {
      case 'street': return segment.street as any;
      case 'sidewalk_left': return segment.sidewalkLeft as any;
      case 'sidewalk_right': return segment.sidewalkRight as any;
      case 'crosswalk_start': return segment.crosswalkStart as any;
      case 'crosswalk_end': return segment.crosswalkEnd as any;
      case 'bikeway_left_1': return segment.bikewayLeft1 as any;
      case 'bikeway_left_2': return segment.bikewayLeft2 as any;
      case 'bikeway_right_1': return segment.bikewayRight1 as any;
      case 'bikeway_right_2': return segment.bikewayRight2 as any;
      default: return null;
    }
  }

  /**
   * Whether the proximity network is loaded and ready.
   */
  isProximityReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Whether the service is initialized and ready.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // ═══════════════════════════════════════════════════════════
  // RATING METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Rate a feature. Persists to Supabase via DataService.
   * Checks for existing rating and updates instead of creating duplicate.
   * Validates 6-hour grading window for completed trips.
   */
  async rateFeature(
    feature: Feature,
    tripId: string,
    userId: string,
    rating: number,
    tripStatus: 'active' | 'paused' | 'completed',
    imageUri?: string,
  ): Promise<void> {
    try {
      if (rating < 1 || rating > 10) {
        throw new Error(ERROR_MESSAGES.INVALID_RATING);
      }

      if (!feature.id || !feature.coordinate || feature.coordinate.length !== 2) {
        throw new Error(ERROR_MESSAGES.INVALID_FEATURE);
      }

      const [lon, lat] = feature.coordinate;
      if (!this.isValidCoordinate(lat, lon)) {
        throw new Error(ERROR_MESSAGES.INVALID_COORDINATES);
      }

      if (tripStatus === 'completed' && !canGradeTrip(tripId, tripStatus)) {
        throw new Error(ERROR_MESSAGES.GRADING_WINDOW_EXPIRED);
      }

      let imageUrl: string | undefined;

      if (imageUri) {
        try {
          imageUrl = await DataService.uploadFeatureImage(
            userId,
            imageUri,
            feature.id,
          );
        } catch (error) {
          console.error('[DataRangerService] Failed to upload image:', error);
        }
      }

      // Check if rating already exists for this feature in this trip
      const existingRatings = await DataService.getRatingsForTrip(tripId);
      const existingRating = existingRatings.find(r => r.crisId === feature.id);

      if (existingRating) {
        console.log(`[DataRangerService] Updating existing rating for feature ${feature.id}`);
        await DataService.updateRating(existingRating.crisId, tripId, {
          userRating: rating,
          ...(imageUrl && { imageUrl }),
        });
      } else {
        console.log(`[DataRangerService] Creating new rating for feature ${feature.id}`);
        await DataService.writeRating({
          userId,
          tripId,
          crisId: feature.id,
          conditionScore: feature.properties?.condition_score ?? 0,
          userRating: rating,
          lat: lat,
          long: lon,
          timeStamp: new Date().toISOString(),
          imageUrl,
        });
      }

      this.ratedFeatures.set(feature.id, rating);
      this.queryCache.clear();
    } catch (error: any) {
      if (error.message && Object.values(ERROR_MESSAGES).includes(error.message)) {
        throw error;
      }
      console.error('[DataRangerService] Error rating feature:', error);
      throw new Error(ERROR_MESSAGES.STORAGE_WRITE_FAILED);
    }
  }

  /**
   * Load existing ratings for a trip (e.g., when resuming).
   */
  async loadTripRatings(tripId: string): Promise<void> {
    try {
      console.log('[DataRangerService] loadTripRatings - Loading ratings for trip:', tripId);
      const ratings: RatedFeature[] = await DataService.getRatingsForTrip(tripId);
      console.log('[DataRangerService] loadTripRatings - Got ratings from DataService:', ratings.length);

      this.ratedFeatures.clear();
      this.debugRatedCount = 0;

      for (const r of ratings) {
        this.ratedFeatures.set(r.crisId, r.userRating);
        if (this.debugRatedCount < 3) {
          console.log('[DataRangerService] loadTripRatings - Adding rated feature:', {
            crisId: r.crisId,
            userRating: r.userRating,
          });
        }
      }

      this.currentTripId = tripId;
      console.log(`[DataRangerService] Loaded ${ratings.length} existing ratings for trip`);
    } catch (error) {
      console.warn('[DataRangerService] Failed to load trip ratings:', error);
    }
  }

  /**
   * Load all ratings for the current user across all trips.
   */
  async loadAllUserRatings(userId: string): Promise<void> {
    try {
      const ratings: RatedFeature[] = await DataService.getUserRatings();

      this.ratedFeatures.clear();

      const ratingsByFeature = new Map<string, { rating: number; timestamp: string }>();

      for (const r of ratings) {
        const existing = ratingsByFeature.get(r.crisId);
        if (!existing || new Date(r.timeStamp) > new Date(existing.timestamp)) {
          ratingsByFeature.set(r.crisId, {
            rating: r.userRating,
            timestamp: r.timeStamp,
          });
        }
      }

      for (const [crisId, data] of ratingsByFeature.entries()) {
        this.ratedFeatures.set(crisId, data.rating);
      }

      console.log(`[DataRangerService] Loaded ${this.ratedFeatures.size} user ratings across all trips`);
    } catch (error) {
      console.warn('[DataRangerService] Failed to load user ratings:', error);
    }
  }

  async getRatingsForTrip(tripId: string): Promise<RatedFeature[]> {
    try {
      return await DataService.getRatingsForTrip(tripId);
    } catch (error) {
      console.warn('[DataRangerService] Failed to get ratings for trip:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GEOMETRY EDITS (topology-altering operations)
  // ═══════════════════════════════════════════════════════════

  async submitGeometryEdit(edit: GeometryEditPayload, tripId: string, userId: string): Promise<string> {
    const { id } = await DataService.writeGeometryEdit({
      tripId,
      userId,
      editType: edit.editType,
      streetGridId: edit.streetGridId,
      payload: edit.payload as unknown as Record<string, unknown>,
      coord: edit.coord,
    });

    // Cache locally for map preview
    const pending = await this.loadPendingGeometryEdits();
    const record: GeometryEditRecord = {
      ...edit,
      id,
      userId,
      tripId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    pending.push(record);
    await AsyncStorage.setItem(this.PENDING_GEOMETRY_EDITS_KEY, JSON.stringify(pending));

    this.queryCache.clear();
    return id;
  }

  async getPendingGeometryEdits(): Promise<GeometryEditRecord[]> {
    return this.loadPendingGeometryEdits();
  }

  async syncGeometryEditStatuses(): Promise<GeometryEditRecord[]> {
    const pending = await this.loadPendingGeometryEdits();
    if (pending.length === 0) return [];

    const statuses = await DataService.getGeometryEditStatuses(pending.map(e => e.id));
    const statusMap = new Map(statuses.map(s => [s.id, s.status]));

    const conflicts: GeometryEditRecord[] = [];
    const stillPending: GeometryEditRecord[] = [];

    for (const edit of pending) {
      const serverStatus = statusMap.get(edit.id) ?? 'pending';
      if (serverStatus === 'conflict' || serverStatus === 'rejected') {
        conflicts.push({ ...edit, status: serverStatus as GeometryEditRecord['status'] });
      } else if (serverStatus === 'pending') {
        stillPending.push(edit);
      }
      // 'applied' edits are dropped from local cache
    }

    await AsyncStorage.setItem(this.PENDING_GEOMETRY_EDITS_KEY, JSON.stringify(stillPending));
    return conflicts;
  }

  private async loadPendingGeometryEdits(): Promise<GeometryEditRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(this.PENDING_GEOMETRY_EDITS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Submit a brand-new segment drawn from GPS trip polyline.
   * The geometry is a LineString extracted from the trip between start/end indices.
   * Written to geometry_edits with edit_type='draw_segment', no street_grid_id.
   */
  async submitNewSegment(
    geometry: { type: 'LineString'; coordinates: [number, number][] },
    facilityType: string,
    attributes: Record<string, string>,
    tripId: string,
    userId: string,
  ): Promise<void> {
    const coord = geometry.coordinates[0] ?? [0, 0];
    await this.submitGeometryEdit(
      {
        editType: 'draw_segment',
        streetGridId: undefined,
        payload: { facilityType, geometry, attributes },
        coord: coord as [number, number],
      },
      tripId,
      userId,
    );
  }

  /**
   * Submit a new point feature (curb ramp or traffic calming) placed by the user.
   * Written to geometry_edits with edit_type='add_node'.
   */
  async submitNewPointFeature(
    subtype: 'ramp' | 'calm',
    coord: [number, number],
    attributes: Record<string, string>,
    tripId: string,
    userId: string,
  ): Promise<void> {
    await this.submitGeometryEdit(
      {
        editType: 'add_node',
        streetGridId: undefined,
        payload: { subtype, coord, attributes },
        coord,
      },
      tripId,
      userId,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // FEATURE EDITS (unified table — ratings, corrections, attributes)
  // ═══════════════════════════════════════════════════════════

  /**
   * Submit a feature edit (rating or correction) to Supabase and cache locally.
   */
  async submitFeatureEdit(
    edit: {
      editType: 'rate' | 'correct_attributes' | 'correct_geometry';
      streetGridId: string;
      geometry: any;
      editedAttributes?: Record<string, unknown>;
      rating?: number;
      coord: [number, number];
      featureType: 'point' | 'line';
    },
    tripId: string,
    userId: string,
  ): Promise<void> {
    const editTypeMap = {
      rate: 'rating',
      correct_attributes: 'attribute_correction',
      correct_geometry: 'geometry_correction',
    } as const;
    const featureEdit = {
      userId,
      tripId,
      editType: editTypeMap[edit.editType],
      streetGridId: edit.streetGridId,
      geometry: edit.geometry,
      editedAttributes: edit.editedAttributes || null,
      rating: edit.rating ?? null,
      coord: edit.coord,
      featureType: edit.featureType,
    };

    await DataService.writeFeatureEdit(featureEdit);

    // Cache locally for offline display
    const cacheKey = '@dataranger/pendingFeatureEdits';
    const existing = await AsyncStorage.getItem(cacheKey);
    const edits = existing ? JSON.parse(existing) : [];
    edits.push({ ...featureEdit, createdAt: new Date().toISOString(), status: 'pending' });
    await AsyncStorage.setItem(cacheKey, JSON.stringify(edits));
  }

  /**
   * Get locally cached pending feature edits for display on home screen.
   */
  async getPendingFeatureEdits(): Promise<any[]> {
    const cacheKey = '@dataranger/pendingFeatureEdits';
    const raw = await AsyncStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : [];
  }

  /**
   * Sync feature edit statuses from server, remove applied ones from local cache.
   */
  async syncFeatureEditStatuses(): Promise<{ conflicts: any[] }> {
    const cacheKey = '@dataranger/pendingFeatureEdits';
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return { conflicts: [] };

    const localEdits = JSON.parse(raw);
    const serverEdits = await DataService.getUserFeatureEdits();

    const serverMap = new Map(serverEdits.map((e: any) => [e.streetGridId + e.editType, e]));
    const conflicts: any[] = [];
    const stillPending: any[] = [];

    for (const local of localEdits) {
      const server = serverMap.get(local.streetGridId + local.editType);
      if (!server || server.status === 'pending') {
        stillPending.push(local);
      } else if (server.status === 'conflict') {
        conflicts.push(server);
      }
      // 'applied' edits drop out of local cache
    }

    await AsyncStorage.setItem(cacheKey, JSON.stringify(stillPending));
    return { conflicts };
  }

  /**
   * Get all feature edits for the current user (for Home Screen display).
   */
  async getUserFeatureEdits(): Promise<FeatureEdit[]> {
    return DataService.getUserFeatureEdits();
  }

  /**
   * Get feature edits for a specific trip.
   */
  async getFeatureEditsForTrip(tripId: string): Promise<FeatureEdit[]> {
    return DataService.getFeatureEditsForTrip(tripId);
  }

  /**
   * Submit a GPS-recorded segment correction.
   * Stores the recorded polyline as a geometry correction in feature_edits.
   */
  async submitSegmentCorrection(
    tripId: string,
    userId: string,
    streetGridId: string,
    recordedPolyline: GeoJSON.LineString,
    coord: [number, number],
  ): Promise<void> {
    return this.submitFeatureEdit({
      editType: 'correct_geometry',
      streetGridId,
      geometry: recordedPolyline,
      coord,
      featureType: 'line',
    }, tripId, userId);
  }

  // ═══════════════════════════════════════════════════════════
  // MAP ADAPTER (for @proximity/shared tool integration)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get a segment pair info by looking up loaded segments.
   * Used by merge_segments tool when rnMapboxAdapter can't query by ID.
   */
  getSegmentPairInfo(seg1Id: string, seg2Id: string): { sharedNodeId: string | null; sharedCoord: [number, number] | null } | null {
    const seg1 = this.segmentMap.get(seg1Id);
    const seg2 = this.segmentMap.get(seg2Id);
    if (!seg1 || !seg2) return null;

    // Check if segments share an endpoint by comparing start/end node coordinates
    const seg1Geom = seg1.street?.geometry;
    const seg2Geom = seg2.street?.geometry;
    if (!seg1Geom || !seg2Geom) return null;

    const getEndpoints = (geom: GeoJSON.LineString | GeoJSON.MultiLineString): [number, number][] => {
      if (geom.type === 'LineString') {
        const coords = geom.coordinates;
        return [coords[0] as [number, number], coords[coords.length - 1] as [number, number]];
      }
      return [];
    };

    if (seg1Geom.type !== 'LineString' || seg2Geom.type !== 'LineString') return null;

    const eps1 = getEndpoints(seg1Geom);
    const eps2 = getEndpoints(seg2Geom);
    const tolerance = 0.00001; // ~1m

    for (const p1 of eps1) {
      for (const p2 of eps2) {
        if (Math.abs(p1[0] - p2[0]) < tolerance && Math.abs(p1[1] - p2[1]) < tolerance) {
          return {
            sharedNodeId: `${p1[0].toFixed(6)}_${p1[1].toFixed(6)}`,
            sharedCoord: p1,
          };
        }
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // TRIP LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  startTrip(tripId: string): void {
    this.currentTripId = tripId;
    this.ratedFeatures.clear();
    this.queryCache.clear();
  }

  endTrip(): void {
    this.currentTripId = null;
    this.ratedFeatures.clear();
    this.queryCache.clear();
  }

  async getUserRatingCount(): Promise<number> {
    try {
      const ratings = await DataService.getUserRatings();
      return ratings.length;
    } catch (error) {
      console.warn('[DataRangerService] Failed to get user rating count:', error);
      return 0;
    }
  }

  getRatedCountForCurrentTrip(): number {
    return this.ratedFeatures.size;
  }

  getExistingRating(crisId: string | undefined): number | null {
    if (!crisId) return null;
    return this.ratedFeatures.get(crisId) ?? null;
  }

  async getSegmentEditCountForTrip(tripId: string): Promise<number> {
    try {
      const edits = await DataService.getSegmentEditsForTrip(tripId);
      return edits.length;
    } catch {
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CACHE & CLEANUP
  // ═══════════════════════════════════════════════════════════

  async clearCache(): Promise<void> {
    try {
      const file = new File(Paths.document, this.PARQUET_FILE_NAME);
      if (file.exists) file.delete();
      this.deleteGridIndexCache();
      await AsyncStorage.removeItem(this.PROXIMITY_VERSION_KEY);
      console.log('[DataRangerService] Cache cleared');
    } catch (error) {
      console.warn('[DataRangerService] Failed to clear cache:', error);
    }
  }

  cleanup(clearCacheOnCleanup: boolean = false): void {
    console.log('[DataRangerService] Cleaning up...');
    this.queryCache.clear();
    this.ratedFeatures.clear();
    this.currentTripId = null;

    this.segments = [];
    this.segmentIndex = null;
    this.segmentMap.clear();
    this.loadedCells.clear();
    this.loadingCells.clear();
    this.parquetFile = null;
    this.gridOrigin = null;
    this.gridCellIndex = null;
    this.isInitialized = false;

    if (clearCacheOnCleanup) {
      this.clearCache().catch(err =>
        console.warn('[DataRangerService] Failed to clear cache during cleanup:', err)
      );
    }
  }

  // --- Private helpers ---

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getCacheKey(lat: number, lon: number): string {
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLon = Math.round(lon * 1000) / 1000;
    return `${roundedLat}_${roundedLon}`;
  }

  private cacheQueryResult(
    key: string,
    features: Feature[],
    lat: number,
    lon: number,
  ): void {
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.queryCache.delete(firstKey);
      }
    }
    this.queryCache.set(key, { features, location: { lat, lon } });
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }
}

// Export singleton instance
export const DataRangerService = new DataRangerServiceClass();
