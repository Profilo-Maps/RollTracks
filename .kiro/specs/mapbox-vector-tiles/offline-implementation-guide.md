# Offline Vector Tile Implementation Guide

## Overview

This document provides detailed technical guidance on implementing offline functionality for Mapbox vector tiles in the RollTracks React Native application. Unlike raster tiles which are simple PNG images, vector tiles require a more sophisticated approach involving tile data, fonts, sprites, and style specifications.

## Current vs. Vector Tile Offline Architecture

### Current Raster Tile Approach (Leaflet)

```
Offline Storage:
└── sf_tiles/
    └── {z}/{x}/{y}.png  (Simple PNG files)

Access Pattern:
1. Request tile at zoom/x/y
2. Load PNG from file system
3. Display image directly
```

**Advantages**: Simple, straightforward file access
**Disadvantages**: Large file sizes, no styling flexibility, pixelation at different zoom levels

### Vector Tile Approach (Mapbox GL JS)

```
Offline Storage:
├── tiles/
│   └── {z}/{x}/{y}.pbf          (Vector tile data in Protocol Buffer format)
├── fonts/
│   └── {fontstack}/{range}.pbf  (Glyph data for text rendering)
├── sprites/
│   ├── sprite.png               (Icon atlas)
│   └── sprite.json              (Icon metadata)
└── styles/
    └── style.json               (Style specification)
```

**Advantages**: Smaller files, dynamic styling, crisp at all zoom levels
**Disadvantages**: More complex storage structure, requires multiple asset types

## Implementation Approaches

### Approach 1: WebView IndexedDB/WebSQL (Recommended for React Native)

This approach stores vector tiles in the WebView's built-in storage APIs, which are designed for web-based map applications.

#### Architecture

```typescript
// Storage Layer (Inside WebView)
class VectorTileCache {
  private db: IDBDatabase;
  
  async initialize(): Promise<void> {
    // Open IndexedDB database
    this.db = await this.openDatabase('mapbox-tiles', 1);
  }
  
  async storeTile(z: number, x: number, y: number, data: ArrayBuffer): Promise<void> {
    const key = `${z}/${x}/${y}`;
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    
    await store.put({
      key: key,
      data: data,
      timestamp: Date.now(),
      size: data.byteLength
    });
  }
  
  async getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    const key = `${z}/${x}/${y}`;
    const transaction = this.db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');
    const result = await store.get(key);
    
    return result ? result.data : null;
  }
  
  async getCacheSize(): Promise<number> {
    const transaction = this.db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');
    const allTiles = await store.getAll();
    
    return allTiles.reduce((total, tile) => total + tile.size, 0);
  }
  
  async clearOldTiles(maxSizeBytes: number): Promise<void> {
    const currentSize = await this.getCacheSize();
    
    if (currentSize > maxSizeBytes) {
      // Remove oldest tiles first (LRU strategy)
      const transaction = this.db.transaction(['tiles'], 'readwrite');
      const store = transaction.objectStore('tiles');
      const index = store.index('timestamp');
      
      let deletedSize = 0;
      const cursor = await index.openCursor();
      
      while (cursor && (currentSize - deletedSize) > maxSizeBytes) {
        deletedSize += cursor.value.size;
        await cursor.delete();
        await cursor.continue();
      }
    }
  }
  
  private openDatabase(name: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('tiles')) {
          const tileStore = db.createObjectStore('tiles', { keyPath: 'key' });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('fonts')) {
          db.createObjectStore('fonts', { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains('sprites')) {
          db.createObjectStore('sprites', { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains('styles')) {
          db.createObjectStore('styles', { keyPath: 'key' });
        }
      };
    });
  }
}
```

#### Mapbox GL JS Integration

```javascript
// Inside WebView HTML
let map;
let tileCache;

async function initializeMap() {
  // Initialize cache
  tileCache = new VectorTileCache();
  await tileCache.initialize();
  
  // Create custom protocol for offline tiles
  mapboxgl.addProtocol('offline', (params, callback) => {
    // Parse tile coordinates from URL
    const match = params.url.match(/offline:\/\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf/);
    if (match) {
      const [, z, x, y] = match;
      
      // Try to load from cache
      tileCache.getTile(parseInt(z), parseInt(x), parseInt(y))
        .then(data => {
          if (data) {
            callback(null, data, null, null);
          } else {
            // Tile not in cache, try to fetch from network
            fetchAndCacheTile(z, x, y)
              .then(data => callback(null, data, null, null))
              .catch(err => callback(err));
          }
        })
        .catch(err => callback(err));
    } else {
      callback(new Error('Invalid offline URL'));
    }
    
    // Return cancel function
    return { cancel: () => {} };
  });
  
  // Initialize map with offline-capable style
  map = new mapboxgl.Map({
    container: 'map',
    style: await loadOfflineStyle(),
    center: [-122.4194, 37.7749],
    zoom: 17
  });
}

async function loadOfflineStyle() {
  // Load style from cache or use default
  const cachedStyle = await tileCache.getStyle('default');
  
  if (cachedStyle) {
    return cachedStyle;
  }
  
  // Default style with offline protocol
  return {
    version: 8,
    sources: {
      'offline-tiles': {
        type: 'vector',
        tiles: ['offline://tiles/{z}/{x}/{y}.pbf'],
        minzoom: 10,
        maxzoom: 18
      }
    },
    layers: [
      // Define map layers here
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f8f8f8' }
      },
      {
        id: 'roads',
        type: 'line',
        source: 'offline-tiles',
        'source-layer': 'road',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2
        }
      }
      // ... more layers
    ],
    glyphs: 'offline://fonts/{fontstack}/{range}.pbf',
    sprite: 'offline://sprites/sprite'
  };
}

async function fetchAndCacheTile(z, x, y) {
  // Fetch from Mapbox API or custom server
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${z}/${x}/${y}.mvt?access_token=${MAPBOX_TOKEN}`;
  
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  
  // Cache the tile
  await tileCache.storeTile(parseInt(z), parseInt(x), parseInt(y), data);
  
  return data;
}
```

#### React Native Integration

```typescript
// MapView.tsx
export const MapView: React.FC<MapViewProps> = ({
  currentLocation,
  offlineRegions,
  tileSource,
  ...props
}) => {
  const webViewRef = useRef<WebView>(null);
  
  // Download offline region
  const downloadOfflineRegion = async (region: OfflineRegion) => {
    sendMessage({
      type: 'downloadOfflineRegion',
      payload: region
    });
  };
  
  // Handle download progress from WebView
  const handleMessage = (event: any) => {
    const message = JSON.parse(event.nativeEvent.data);
    
    switch (message.type) {
      case 'offlineDownloadProgress':
        console.log(`Download progress: ${message.payload.progress}%`);
        break;
        
      case 'offlineDownloadComplete':
        console.log(`Downloaded ${message.payload.tileCount} tiles`);
        break;
    }
  };
  
  return (
    <WebView
      ref={webViewRef}
      source={{ html: htmlContent }}
      onMessage={handleMessage}
      // ... other props
    />
  );
};
```

#### Offline Region Download Implementation

```javascript
// Inside WebView
async function downloadOfflineRegion(region) {
  const { bounds, minZoom, maxZoom } = region;
  
  // Calculate all tile coordinates in the region
  const tiles = calculateTileCoordinates(bounds, minZoom, maxZoom);
  
  let downloaded = 0;
  const total = tiles.length;
  
  // Download tiles in batches to avoid overwhelming the network
  const batchSize = 10;
  
  for (let i = 0; i < tiles.length; i += batchSize) {
    const batch = tiles.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async ({ z, x, y }) => {
      try {
        await fetchAndCacheTile(z, x, y);
        downloaded++;
        
        // Report progress
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'offlineDownloadProgress',
          payload: {
            region: region.id,
            progress: Math.round((downloaded / total) * 100)
          }
        }));
      } catch (error) {
        console.error(`Failed to download tile ${z}/${x}/${y}:`, error);
      }
    }));
  }
  
  // Download fonts and sprites
  await downloadFonts();
  await downloadSprites();
  
  // Report completion
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'offlineDownloadComplete',
    payload: {
      region: region.id,
      tileCount: downloaded
    }
  }));
}

function calculateTileCoordinates(bounds, minZoom, maxZoom) {
  const tiles = [];
  
  for (let z = minZoom; z <= maxZoom; z++) {
    const nwTile = latLonToTile(bounds.north, bounds.west, z);
    const seTile = latLonToTile(bounds.south, bounds.east, z);
    
    for (let x = nwTile.x; x <= seTile.x; x++) {
      for (let y = nwTile.y; y <= seTile.y; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  
  return tiles;
}

function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  
  return { x, y };
}

async function downloadFonts() {
  // Download required font glyphs
  const fontStacks = ['Open Sans Regular', 'Open Sans Bold'];
  const ranges = ['0-255', '256-511']; // Common glyph ranges
  
  for (const fontStack of fontStacks) {
    for (const range of ranges) {
      const url = `https://api.mapbox.com/fonts/v1/mapbox/${fontStack}/${range}.pbf?access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      
      await tileCache.storeFont(fontStack, range, data);
    }
  }
}

async function downloadSprites() {
  // Download sprite atlas and metadata
  const spriteUrl = 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite';
  
  // Download PNG atlas
  const pngResponse = await fetch(`${spriteUrl}.png?access_token=${MAPBOX_TOKEN}`);
  const pngData = await pngResponse.arrayBuffer();
  await tileCache.storeSprite('sprite.png', pngData);
  
  // Download JSON metadata
  const jsonResponse = await fetch(`${spriteUrl}.json?access_token=${MAPBOX_TOKEN}`);
  const jsonData = await jsonResponse.json();
  await tileCache.storeSprite('sprite.json', JSON.stringify(jsonData));
}
```

### Approach 2: React Native File System (Alternative)

This approach stores vector tiles in the React Native file system using `react-native-fs`, similar to your current raster tile approach.

#### Architecture

```typescript
// OfflineTileManager.ts (React Native side)
import RNFS from 'react-native-fs';

export class OfflineTileManager {
  private basePath: string;
  
  constructor() {
    // Use external storage on Android
    this.basePath = `${RNFS.ExternalStorageDirectoryPath}/RollTracks/vector_tiles`;
  }
  
  async initialize(): Promise<void> {
    // Create directory structure
    await RNFS.mkdir(`${this.basePath}/tiles`);
    await RNFS.mkdir(`${this.basePath}/fonts`);
    await RNFS.mkdir(`${this.basePath}/sprites`);
    await RNFS.mkdir(`${this.basePath}/styles`);
  }
  
  async downloadTile(z: number, x: number, y: number, url: string): Promise<void> {
    const tilePath = `${this.basePath}/tiles/${z}/${x}`;
    await RNFS.mkdir(tilePath);
    
    const filePath = `${tilePath}/${y}.pbf`;
    
    // Download tile
    await RNFS.downloadFile({
      fromUrl: url,
      toFile: filePath
    }).promise;
  }
  
  async downloadRegion(region: OfflineRegion, onProgress: (progress: number) => void): Promise<void> {
    const tiles = this.calculateTileCoordinates(region.bounds, region.minZoom, region.maxZoom);
    
    let downloaded = 0;
    const total = tiles.length;
    
    // Download in batches
    const batchSize = 10;
    for (let i = 0; i < tiles.length; i += batchSize) {
      const batch = tiles.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async ({ z, x, y }) => {
        const url = this.getTileUrl(z, x, y);
        await this.downloadTile(z, x, y, url);
        downloaded++;
        onProgress(Math.round((downloaded / total) * 100));
      }));
    }
    
    // Download fonts and sprites
    await this.downloadFonts();
    await this.downloadSprites();
  }
  
  async getCacheSize(): Promise<number> {
    const stats = await RNFS.stat(this.basePath);
    return stats.size;
  }
  
  async clearCache(): Promise<void> {
    await RNFS.unlink(this.basePath);
    await this.initialize();
  }
  
  private getTileUrl(z: number, x: number, y: number): string {
    return `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${z}/${x}/${y}.mvt?access_token=${MAPBOX_TOKEN}`;
  }
  
  private calculateTileCoordinates(bounds: BoundingBox, minZoom: number, maxZoom: number) {
    // Same implementation as WebView approach
    // ...
  }
  
  private async downloadFonts(): Promise<void> {
    // Download font glyphs to file system
    // ...
  }
  
  private async downloadSprites(): Promise<void> {
    // Download sprite assets to file system
    // ...
  }
}
```

#### WebView Integration with File System

```javascript
// Inside WebView HTML
function initializeMapWithFileSystem() {
  // Use file:// protocol for Android assets or external storage
  const tileBasePath = 'file:///storage/emulated/0/RollTracks/vector_tiles';
  
  map = new mapboxgl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'offline-tiles': {
          type: 'vector',
          tiles: [`${tileBasePath}/tiles/{z}/{x}/{y}.pbf`],
          minzoom: 10,
          maxzoom: 18
        }
      },
      layers: [
        // Define layers
      ],
      glyphs: `${tileBasePath}/fonts/{fontstack}/{range}.pbf`,
      sprite: `${tileBasePath}/sprites/sprite`
    },
    center: [-122.4194, 37.7749],
    zoom: 17
  });
}
```

## Comparison of Approaches

### IndexedDB/WebSQL (Approach 1)

**Pros**:
- Native web storage API, well-supported by Mapbox GL JS
- Automatic quota management by browser
- Efficient binary data storage
- No file system permissions required
- Works consistently across platforms

**Cons**:
- Storage limits vary by platform (typically 50-100MB)
- Data stored in WebView, not easily accessible from React Native
- Harder to inspect/debug cached data
- May be cleared if WebView cache is cleared

**Best For**: 
- Smaller offline regions (city-level)
- Apps that don't need direct file access
- Cross-platform consistency

### React Native File System (Approach 2)

**Pros**:
- Larger storage capacity (limited by device storage)
- Direct file access from React Native
- Easier to inspect and debug
- Can bundle tiles with app (like current raster tiles)
- More control over cache management

**Cons**:
- Requires storage permissions on Android
- More complex file path management
- Need to handle file:// protocol in WebView
- Platform-specific path differences

**Best For**:
- Larger offline regions (state/country-level)
- Apps that need to bundle tiles with installation
- When you need direct file access from React Native

## Recommended Hybrid Approach

For RollTracks, I recommend a **hybrid approach** that combines both methods:

### Implementation Strategy

```typescript
// HybridOfflineManager.ts
export class HybridOfflineManager {
  private webViewCache: WebViewCacheInterface;
  private fileSystemCache: OfflineTileManager;
  
  constructor() {
    this.fileSystemCache = new OfflineTileManager();
  }
  
  async initialize(): Promise<void> {
    await this.fileSystemCache.initialize();
    
    // Bundle essential tiles with app (San Francisco area)
    await this.bundleEssentialTiles();
  }
  
  async downloadRegion(region: OfflineRegion, onProgress: (progress: number) => void): Promise<void> {
    const cacheSize = await this.fileSystemCache.getCacheSize();
    
    if (cacheSize < 150 * 1024 * 1024) {
      // Use file system for larger regions
      await this.fileSystemCache.downloadRegion(region, onProgress);
    } else {
      // Use WebView cache for additional regions
      this.sendMessageToWebView({
        type: 'downloadOfflineRegion',
        payload: region
      });
    }
  }
  
  private async bundleEssentialTiles(): Promise<void> {
    // Copy bundled tiles from assets to file system on first launch
    const bundledPath = 'android/app/src/main/assets/vector_tiles';
    const targetPath = this.fileSystemCache.basePath;
    
    // Check if already copied
    const exists = await RNFS.exists(targetPath);
    if (!exists) {
      await RNFS.copyFileAssets(bundledPath, targetPath);
    }
  }
}
```

### Storage Strategy

1. **Bundled Tiles** (File System): Include essential San Francisco area tiles with app installation
2. **User-Downloaded Regions** (File System): Store larger regions downloaded by user
3. **Dynamic Cache** (WebView IndexedDB): Cache recently viewed areas automatically
4. **Fallback**: If both fail, fetch from network

## Storage Size Estimates

### Vector Tiles vs Raster Tiles

For San Francisco (zoom levels 10-18):

**Raster Tiles (Current)**:
- Tile count: ~50,000 tiles
- Average size: 15-20 KB per tile
- Total size: ~750 MB - 1 GB

**Vector Tiles (Proposed)**:
- Tile count: ~50,000 tiles
- Average size: 3-5 KB per tile
- Total size: ~150-250 MB
- Plus fonts: ~5 MB
- Plus sprites: ~2 MB
- **Total: ~160-260 MB (70-80% reduction)**

### Storage Breakdown

```
Vector Tile Storage Structure:
├── tiles/           (~150-250 MB)
│   └── {z}/{x}/{y}.pbf
├── fonts/           (~5 MB)
│   └── {fontstack}/{range}.pbf
├── sprites/         (~2 MB)
│   ├── sprite.png
│   └── sprite.json
└── styles/          (~100 KB)
    └── style.json

Total: ~160-260 MB for full San Francisco coverage
```

## Implementation Checklist

### Phase 1: Basic Offline Support
- [ ] Implement IndexedDB cache in WebView
- [ ] Add custom protocol handler for offline tiles
- [ ] Create tile download and caching logic
- [ ] Test with small geographic region

### Phase 2: File System Integration
- [ ] Set up React Native file system storage
- [ ] Implement tile bundling with app
- [ ] Add file:// protocol support in WebView
- [ ] Test with bundled San Francisco tiles

### Phase 3: Region Management
- [ ] Create region download UI
- [ ] Implement download progress tracking
- [ ] Add cache size management
- [ ] Implement LRU cache eviction

### Phase 4: Optimization
- [ ] Add intelligent tile prioritization
- [ ] Implement compression for cached tiles
- [ ] Add background download support
- [ ] Optimize for battery and data usage

### Phase 5: Fonts and Sprites
- [ ] Download and cache font glyphs
- [ ] Download and cache sprite atlases
- [ ] Implement fallback fonts
- [ ] Test text rendering offline

## Conclusion

The recommended approach for RollTracks is:

1. **Start with IndexedDB** for dynamic caching (easier to implement)
2. **Add file system storage** for bundled tiles (better for app distribution)
3. **Implement hybrid strategy** for optimal storage usage
4. **Prioritize San Francisco area** for bundled tiles
5. **Allow user downloads** for additional regions

This provides the best balance of:
- Easy implementation (IndexedDB is native to Mapbox GL JS)
- Large storage capacity (file system for bundled tiles)
- Flexibility (users can download additional regions)
- Performance (local file access is fast)
- User experience (works offline immediately after installation)