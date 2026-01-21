# Migration Strategy: Raster to Vector Tiles

## Executive Summary

This document outlines the practical migration path from your current Leaflet + raster tile system to Mapbox GL JS + vector tiles, with specific focus on maintaining offline functionality and minimizing disruption to users.

## Current System Analysis

### What You Have Now

```
Architecture:
- Leaflet.js in WebView
- Raster tiles (PNG images)
- File system storage: C:\MobilityTripTracker1\MapData\sf_tiles\
- Android assets: android/app/src/main/assets/sf_tiles/
- Simple file:// protocol access
- ~750 MB storage for San Francisco area

Strengths:
✓ Simple implementation
✓ Works reliably offline
✓ No complex dependencies
✓ Easy to debug (just PNG files)

Weaknesses:
✗ Large file sizes
✗ Pixelated at different zoom levels
✗ No dynamic styling
✗ Limited to pre-rendered appearance
```

### What Vector Tiles Offer

```
Architecture:
- Mapbox GL JS in WebView
- Vector tiles (Protocol Buffer format)
- Multiple storage options (IndexedDB + File System)
- Custom protocol handlers
- ~160-260 MB storage for same area

Strengths:
✓ 70-80% smaller file sizes
✓ Crisp at all zoom levels
✓ Dynamic styling and themes
✓ Better performance with WebGL
✓ Accessibility customization

Weaknesses:
✗ More complex implementation
✗ Requires WebGL support
✗ Multiple asset types (tiles, fonts, sprites)
✗ More sophisticated caching logic
```

## Migration Phases

### Phase 1: Parallel Implementation (Weeks 1-2)

**Goal**: Get vector tiles working alongside existing raster tiles without breaking anything.

**Implementation**:

1. **Add Mapbox GL JS to WebView** (keep Leaflet code intact)

```typescript
// MapView.tsx - Add new prop to toggle between implementations
interface MapViewProps {
  // ... existing props
  useVectorTiles?: boolean; // New prop for A/B testing
}

const htmlContent = useVectorTiles 
  ? generateMapboxGLHTML() 
  : generateLeafletHTML(); // Keep existing implementation
```

2. **Create minimal vector tile setup** with online tiles only

```javascript
// Mapbox GL JS HTML (online only for now)
function initializeMapboxMap() {
  mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';
  
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11', // Use Mapbox hosted style
    center: [-122.4194, 37.7749],
    zoom: 17
  });
  
  // Reuse existing message protocol
  window.addEventListener('message', handleExistingMessages);
}
```

3. **Test with feature flag**

```typescript
// App.tsx or config
const ENABLE_VECTOR_TILES = __DEV__; // Only in development initially

<MapView
  useVectorTiles={ENABLE_VECTOR_TILES}
  currentLocation={currentLocation}
  routePoints={routePoints}
  // ... other props
/>
```

**Deliverables**:
- [ ] Vector tiles work online with Mapbox API
- [ ] All existing features work (location, routes, obstacles)
- [ ] Can toggle between raster and vector
- [ ] No breaking changes to existing functionality

### Phase 2: Offline Foundation (Weeks 3-4)

**Goal**: Implement basic offline caching for vector tiles.

**Implementation**:

1. **Add IndexedDB caching layer**

```javascript
// Inside Mapbox GL JS WebView
class VectorTileCache {
  async initialize() {
    this.db = await this.openDatabase('mapbox-tiles', 1);
  }
  
  async cacheTile(z, x, y, data) {
    const key = `${z}/${x}/${y}`;
    await this.db.put('tiles', { key, data, timestamp: Date.now() });
  }
  
  async getTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    return await this.db.get('tiles', key);
  }
}

// Add custom protocol for offline access
mapboxgl.addProtocol('offline', async (params, callback) => {
  const match = params.url.match(/offline:\/\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf/);
  if (match) {
    const [, z, x, y] = match;
    const cached = await tileCache.getTile(z, x, y);
    
    if (cached) {
      callback(null, cached.data, null, null);
    } else {
      // Fetch from network and cache
      const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${z}/${x}/${y}.mvt?access_token=${token}`;
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      await tileCache.cacheTile(z, x, y, data);
      callback(null, data, null, null);
    }
  }
  
  return { cancel: () => {} };
});
```

2. **Implement automatic caching during online use**

```javascript
// Cache tiles as user navigates
map.on('data', (e) => {
  if (e.dataType === 'source' && e.tile) {
    // Tile loaded, cache it automatically
    const { z, x, y } = e.tile.tileID.canonical;
    cacheTileFromNetwork(z, x, y);
  }
});
```

3. **Add cache size monitoring**

```typescript
// React Native side
const [cacheSize, setCacheSize] = useState(0);

useEffect(() => {
  // Query cache size from WebView
  sendMessage({ type: 'getCacheSize' });
}, []);

// WebView responds with cache size
const handleMessage = (event) => {
  const message = JSON.parse(event.nativeEvent.data);
  if (message.type === 'cacheSize') {
    setCacheSize(message.payload.bytes);
  }
};
```

**Deliverables**:
- [ ] Tiles automatically cache during online use
- [ ] Cached tiles work offline
- [ ] Cache size monitoring
- [ ] Basic cache management (clear cache)

### Phase 3: Bundled Tiles (Weeks 5-6)

**Goal**: Bundle essential San Francisco tiles with app, similar to current approach.

**Implementation**:

1. **Generate vector tiles for San Francisco**

```bash
# Use Mapbox Studio or tilemaker to generate tiles
# Export tiles for San Francisco area, zoom 10-18

# Directory structure:
vector_tiles/
├── tiles/
│   └── 10-18/{x}/{y}.pbf
├── fonts/
│   └── Open Sans Regular/
│       └── 0-255.pbf
├── sprites/
│   ├── sprite.png
│   └── sprite.json
└── style.json
```

2. **Bundle with Android app**

```bash
# Copy to Android assets
cp -r vector_tiles/ android/app/src/main/assets/

# Update build script
# package.json
{
  "scripts": {
    "copy-vector-tiles": "node scripts/copy-vector-tiles-to-assets.js",
    "prebuild": "npm run copy-vector-tiles"
  }
}
```

3. **Access bundled tiles from WebView**

```javascript
// Use file:// protocol for bundled assets
const style = {
  version: 8,
  sources: {
    'bundled-tiles': {
      type: 'vector',
      tiles: ['file:///android_asset/vector_tiles/tiles/{z}/{x}/{y}.pbf'],
      minzoom: 10,
      maxzoom: 18
    }
  },
  layers: [/* layer definitions */],
  glyphs: 'file:///android_asset/vector_tiles/fonts/{fontstack}/{range}.pbf',
  sprite: 'file:///android_asset/vector_tiles/sprites/sprite'
};
```

4. **Hybrid approach: bundled + cached**

```javascript
// Prioritize bundled tiles, fall back to cached/network
function getTileSource() {
  return {
    type: 'vector',
    tiles: [
      'file:///android_asset/vector_tiles/tiles/{z}/{x}/{y}.pbf', // Try bundled first
      'offline://tiles/{z}/{x}/{y}.pbf', // Then cached
      'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.mvt?access_token=${token}' // Finally network
    ]
  };
}
```

**Deliverables**:
- [ ] San Francisco tiles bundled with app
- [ ] App works offline immediately after installation
- [ ] Hybrid fallback system (bundled → cached → network)
- [ ] APK size increase documented and acceptable

### Phase 4: Advanced Features (Weeks 7-8)

**Goal**: Add region downloads, dynamic styling, and accessibility features.

**Implementation**:

1. **Region download UI**

```typescript
// OfflineRegionsScreen.tsx
export const OfflineRegionsScreen = () => {
  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  const downloadRegion = async (region: OfflineRegion) => {
    setDownloading(region.id);
    
    // Send download request to WebView
    sendMessage({
      type: 'downloadOfflineRegion',
      payload: region
    });
  };
  
  return (
    <View>
      <Text>Available Regions</Text>
      {PREDEFINED_REGIONS.map(region => (
        <RegionCard
          key={region.id}
          region={region}
          onDownload={() => downloadRegion(region)}
          downloading={downloading === region.id}
        />
      ))}
    </View>
  );
};

// Predefined regions
const PREDEFINED_REGIONS: OfflineRegion[] = [
  {
    id: 'sf-downtown',
    name: 'San Francisco Downtown',
    bounds: {
      north: 37.8,
      south: 37.75,
      east: -122.38,
      west: -122.43
    },
    minZoom: 10,
    maxZoom: 18,
    estimatedSize: 25 * 1024 * 1024 // 25 MB
  },
  // ... more regions
];
```

2. **Dynamic styling and themes**

```typescript
// MapView.tsx
interface MapViewProps {
  // ... existing props
  theme?: 'light' | 'dark' | 'accessibility';
}

// WebView HTML
function applyTheme(theme) {
  const styles = {
    light: {
      background: '#f8f8f8',
      roads: '#ffffff',
      text: '#000000'
    },
    dark: {
      background: '#1a1a1a',
      roads: '#2a2a2a',
      text: '#ffffff'
    },
    accessibility: {
      background: '#ffffff',
      roads: '#000000',
      text: '#000000',
      textSize: 1.5 // 50% larger
    }
  };
  
  const themeStyle = styles[theme];
  
  // Update map style dynamically
  map.setPaintProperty('background', 'background-color', themeStyle.background);
  map.setPaintProperty('roads', 'line-color', themeStyle.roads);
  map.setLayoutProperty('labels', 'text-size', ['*', ['get', 'text-size'], themeStyle.textSize || 1]);
}
```

3. **Accessibility enhancements**

```typescript
// AccessibilityMapConfig
interface AccessibilityMapConfig {
  highContrast: boolean;
  largeText: boolean;
  simplifiedColors: boolean;
  enhancedObstacleMarkers: boolean;
}

function applyAccessibilityConfig(config: AccessibilityMapConfig) {
  if (config.highContrast) {
    // Increase contrast for all map elements
    map.setPaintProperty('roads', 'line-color', '#000000');
    map.setPaintProperty('buildings', 'fill-color', '#ffffff');
  }
  
  if (config.largeText) {
    // Increase text size by 50%
    map.setLayoutProperty('labels', 'text-size', ['*', ['get', 'text-size'], 1.5]);
  }
  
  if (config.enhancedObstacleMarkers) {
    // Make obstacle markers larger and more visible
    obstacleMarkers.forEach(marker => {
      marker.getElement().style.transform = 'scale(1.5)';
    });
  }
}
```

**Deliverables**:
- [ ] Region download functionality
- [ ] Theme switching (light/dark/accessibility)
- [ ] Accessibility enhancements
- [ ] User preferences persistence

### Phase 5: Production Rollout (Weeks 9-10)

**Goal**: Gradual rollout to users with monitoring and rollback capability.

**Implementation**:

1. **Feature flag system**

```typescript
// FeatureFlags.ts
export const FeatureFlags = {
  VECTOR_TILES_ENABLED: false, // Start disabled
  VECTOR_TILES_ROLLOUT_PERCENTAGE: 0, // Gradual rollout
};

// Check if user should get vector tiles
export function shouldUseVectorTiles(userId: string): boolean {
  if (!FeatureFlags.VECTOR_TILES_ENABLED) return false;
  
  // Hash user ID to get consistent assignment
  const hash = hashString(userId);
  const percentage = hash % 100;
  
  return percentage < FeatureFlags.VECTOR_TILES_ROLLOUT_PERCENTAGE;
}
```

2. **Monitoring and analytics**

```typescript
// Track vector tile performance
analytics.track('map_initialized', {
  implementation: useVectorTiles ? 'vector' : 'raster',
  initTime: Date.now() - startTime,
  cacheSize: cacheSize,
  offlineMode: !isOnline
});

// Track errors
map.on('error', (e) => {
  analytics.track('map_error', {
    implementation: 'vector',
    error: e.error.message,
    source: e.source
  });
});
```

3. **Rollback mechanism**

```typescript
// If vector tiles fail, automatically fall back to raster
const [mapImplementation, setMapImplementation] = useState<'vector' | 'raster'>(
  shouldUseVectorTiles(userId) ? 'vector' : 'raster'
);

const handleMapError = (error: string) => {
  if (mapImplementation === 'vector') {
    console.error('Vector tiles failed, falling back to raster:', error);
    setMapImplementation('raster');
    
    analytics.track('vector_tiles_fallback', {
      error: error,
      userId: userId
    });
  }
};
```

4. **Gradual rollout schedule**

```
Week 9:
- Day 1-2: 5% of users
- Day 3-4: 10% of users
- Day 5-7: 25% of users

Week 10:
- Day 1-2: 50% of users
- Day 3-4: 75% of users
- Day 5-7: 100% of users

Monitor at each stage:
- Error rates
- Performance metrics
- User feedback
- Battery usage
- Data usage
```

**Deliverables**:
- [ ] Feature flag system
- [ ] Analytics and monitoring
- [ ] Automatic fallback to raster tiles
- [ ] Gradual rollout plan
- [ ] Rollback procedures

## Storage Migration Strategy

### Option 1: Keep Both (Recommended for Transition)

```
Storage Layout:
├── raster_tiles/          (750 MB - keep during transition)
│   └── sf_tiles/{z}/{x}/{y}.png
└── vector_tiles/          (160 MB - new)
    ├── tiles/{z}/{x}/{y}.pbf
    ├── fonts/
    └── sprites/

Total: ~910 MB during transition
After transition: ~160 MB (remove raster tiles)
```

**Advantages**:
- Safe rollback if vector tiles have issues
- Users can switch between implementations
- No data loss during migration

**Disadvantages**:
- Temporarily uses more storage
- Larger APK size during transition

### Option 2: Replace Immediately

```
Storage Layout:
└── vector_tiles/          (160 MB)
    ├── tiles/{z}/{x}/{y}.pbf
    ├── fonts/
    └── sprites/

Total: ~160 MB
```

**Advantages**:
- Immediate storage savings
- Smaller APK size
- Cleaner implementation

**Disadvantages**:
- No fallback if issues occur
- Riskier migration
- Requires more testing

**Recommendation**: Use Option 1 for initial rollout, transition to Option 2 after 2-3 months of stable operation.

## Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebGL not supported on device | Medium | High | Automatic fallback to raster tiles |
| Vector tiles don't load offline | Low | High | Hybrid storage (bundled + cached) |
| Performance worse than raster | Low | Medium | Performance monitoring + optimization |
| Larger APK size | High | Low | Acceptable trade-off for features |
| Cache management issues | Medium | Medium | Implement robust cache limits |

### User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users notice visual differences | High | Low | Gradual rollout + user education |
| Offline functionality breaks | Low | High | Extensive offline testing |
| Battery drain increases | Low | Medium | Power optimization + monitoring |
| Data usage increases | Medium | Low | Efficient caching strategy |

## Success Metrics

### Technical Metrics

- [ ] Map initialization time < 2 seconds
- [ ] Frame rate maintained at 60fps during interactions
- [ ] Offline functionality works for 100% of bundled area
- [ ] Cache size stays under 200MB
- [ ] Error rate < 1% of map loads
- [ ] WebGL fallback rate < 5% of users

### User Experience Metrics

- [ ] User satisfaction maintained or improved
- [ ] No increase in support tickets about maps
- [ ] Battery usage comparable or better
- [ ] Data usage reduced by 60-80%
- [ ] Accessibility features used by target users

### Business Metrics

- [ ] APK size increase acceptable (< 50MB)
- [ ] Development time within budget
- [ ] No regression in app store ratings
- [ ] Positive user feedback on new features

## Timeline Summary

```
Week 1-2:   Parallel implementation (vector + raster coexist)
Week 3-4:   Offline foundation (IndexedDB caching)
Week 5-6:   Bundled tiles (similar to current approach)
Week 7-8:   Advanced features (regions, themes, accessibility)
Week 9-10:  Production rollout (gradual, monitored)
Week 11-12: Stabilization and optimization
Week 13+:   Remove raster tiles (if stable)

Total: 3 months to full migration
```

## Conclusion

The migration from raster to vector tiles is **feasible and recommended**, with these key points:

1. **Incremental approach**: Keep raster tiles as fallback during transition
2. **Hybrid storage**: Use both IndexedDB and file system for optimal offline support
3. **Gradual rollout**: Start with small percentage of users, monitor closely
4. **Automatic fallback**: If vector tiles fail, revert to raster automatically
5. **Storage savings**: 70-80% reduction in tile storage after migration
6. **Enhanced features**: Dynamic styling, accessibility, better performance

The migration will take approximately 3 months with proper testing and gradual rollout, resulting in a more modern, flexible, and efficient mapping system.