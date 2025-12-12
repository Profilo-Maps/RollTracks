import { ObstacleFeature } from '../types';

interface GridCell {
  features: ObstacleFeature[];
}

/**
 * Spatial grid index for efficient proximity queries.
 * Divides geographic space into grid cells for fast feature lookup.
 */
export class SpatialGrid {
  private grid: Map<string, GridCell> = new Map();
  private cellSize: number;

  /**
   * Create a spatial grid index
   * @param features - Features to index
   * @param cellSize - Size of grid cells in degrees (default: 0.001 ≈ 100m)
   */
  constructor(features: ObstacleFeature[], cellSize: number = 0.001) {
    this.cellSize = cellSize;
    this.buildIndex(features);
  }

  /**
   * Query features near a location
   * @param lat - Latitude
   * @param lon - Longitude
   * @param radiusMeters - Search radius in meters
   * @returns Features in nearby grid cells
   */
  queryNearby(lat: number, lon: number, radiusMeters: number): ObstacleFeature[] {
    const nearbyCells = this.getNearbyCells(lat, lon, radiusMeters);
    const features: ObstacleFeature[] = [];
    const seenIds = new Set<string>();

    for (const cellKey of nearbyCells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const feature of cell.features) {
          // Avoid duplicates (features on cell boundaries)
          if (!seenIds.has(feature.id)) {
            features.push(feature);
            seenIds.add(feature.id);
          }
        }
      }
    }

    return features;
  }

  /**
   * Get grid cell key for a coordinate
   * @private
   */
  getCellKey(lat: number, lon: number): string {
    const cellLat = Math.floor(lat / this.cellSize);
    const cellLon = Math.floor(lon / this.cellSize);
    return `${cellLat}_${cellLon}`;
  }

  /**
   * Get all cells within radius
   * @private
   */
  private getNearbyCells(lat: number, lon: number, radiusMeters: number): string[] {
    // Calculate how many cells to check based on radius
    // 1 degree ≈ 111km at equator, so cellSize degrees ≈ cellSize * 111km
    const cellsToCheck = Math.ceil(radiusMeters / (this.cellSize * 111000)) + 1;
    const cells: string[] = [];

    const baseCellLat = Math.floor(lat / this.cellSize);
    const baseCellLon = Math.floor(lon / this.cellSize);

    for (let dLat = -cellsToCheck; dLat <= cellsToCheck; dLat++) {
      for (let dLon = -cellsToCheck; dLon <= cellsToCheck; dLon++) {
        const cellLat = baseCellLat + dLat;
        const cellLon = baseCellLon + dLon;
        cells.push(`${cellLat}_${cellLon}`);
      }
    }

    return cells;
  }

  /**
   * Build the spatial index
   * @private
   */
  private buildIndex(features: ObstacleFeature[]): void {
    console.log(`Building spatial index for ${features.length} features...`);
    const startTime = Date.now();

    for (const feature of features) {
      const cellKey = this.getCellKey(feature.latitude, feature.longitude);
      
      let cell = this.grid.get(cellKey);
      if (!cell) {
        cell = { features: [] };
        this.grid.set(cellKey, cell);
      }

      cell.features.push(feature);
    }

    const endTime = Date.now();
    console.log(`Spatial index built in ${endTime - startTime}ms with ${this.grid.size} cells`);
  }

  /**
   * Get statistics about the spatial index
   */
  getStats(): { cellCount: number; avgFeaturesPerCell: number; maxFeaturesPerCell: number } {
    let totalFeatures = 0;
    let maxFeatures = 0;

    for (const cell of this.grid.values()) {
      const count = cell.features.length;
      totalFeatures += count;
      maxFeatures = Math.max(maxFeatures, count);
    }

    return {
      cellCount: this.grid.size,
      avgFeaturesPerCell: this.grid.size > 0 ? totalFeatures / this.grid.size : 0,
      maxFeaturesPerCell: maxFeatures
    };
  }
}
