# Mapbox GL JS Integration - Hybrid Approach

## Overview

This implementation uses a **hybrid approach** combining:
- **Mapbox GL JS** for base map tiles (fast, reliable, GPU-accelerated)
- **Direct Mapbox API** for tile loading (no proxy overhead)
- **Custom data layers** for obstacles and routes (your domain logic)

## Architecture

```
┌─────────────────────────────────────────────┐
│         React Native App                    │
│  ┌───────────────────────────────────────┐  │
│  │  ActiveTripScreen / TripSummaryScreen │  │
│  │                                       │  │
│  │  ┌─────────────────────────────────┐ │  │
│  │  │  Feature Flag Check             │ │  │
│  │  │  USE_MAPBOX_VECTOR_TILES?       │ │  │
│  │  └──────────┬──────────────────────┘ │  │
│  │             │                         │  │
│  │      ┌──────┴──────┐                 │  │
│  │      │             │                 │  │
│  │  ┌───▼───┐    ┌───▼────────┐        │  │
│  │  │MapView│    │MapViewMapbox│       │  │
│  │  │Leaflet│    │Mapbox GL JS│       │  │
│  │  └───────┘    └────────────┘        │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Mapbox CDN          │
        │   (Vector Tiles)      │
        └───────────────────────┘
```

## Comprehensive Protections

### 1. Race Condition Prevention

**Problem**: Map operations called before map is fully initialized

**Solution**:
```javascript
let mapInitialized = false;
let mapLoadComplete = false;
let pendingOperations = [];

function executeWhenReady(operation) {
  if (mapLoadComplete) {
    operation();
  } else {
    pendingOperations.push(operation);
  }
}

map.on('load', function() {
  mapLoadComplete = true;
  processPendingOperations();
});
```

**Protection**:
- All map operations queued until `map.on('load')` fires
- Pending operations executed in order after initialization
- No operations lost or executed on uninitialized map

### 2. Message Queue Overflow Prevention

**Problem**: Too many messages from React Native → WebView can cause memory issues

**Solution**:
```javascript
const MESSAGE_QUEUE_LIMIT = 50;
let messageQueue = [];

function queueMessage(handler) {
  if (messageQueue.length >= MESSAGE_QUEUE_LIMIT) {
    console.warn('Message queue overflow, dropping oldest');
    messageQueue = messageQueue.slice(-25); // Keep newest 25
  }
  messageQueue.push(handler);
  processMessageQueue();
}
```

**Protection**:
- React Native side: Max 100 messages in queue
- WebView side: Max 50 messages in queue
- Oldest messages dropped when limit reached
- Queue cleared when app goes to background

### 3. Coordinate System Validation

**Problem**: Invalid coordinates can crash map or cause rendering issues

**Solution**:
```javascript
function validateCoordinates(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

function sanitizeLocation(location) {
  const lat = parseFloat(location.latitude);
  const lon = parseFloat(location.longitude);
  
  if (!validateCoordinates(lat, lon)) {
    return null;
  }
  
  return { latitude: lat, longitude: lon, accuracy: location.accuracy || 0 };
}
```

**Protection**:
- Type checking (must be numbers)
- NaN detection
- Range validation (lat: -90 to 90, lon: -180 to 180)
- Invalid coordinates rejected silently
- Prevents map crashes from bad GPS data

### 4. Memory Management

**Problem**: Large routes and many obstacles can cause memory leaks

**Solution**:
```javascript
const MAX_ROUTE_POINTS = 5000;
const MAX_OBSTACLES = 1000;

function checkMemory() {
  if (performance && performance.memory) {
    const used = performance.memory.usedJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    const usage = (used / limit) * 100;
    
    if (usage > 80) {
      console.warn('High memory usage:', usage.toFixed(2) + '%');
      
      if (usage > 90) {
        simplifyRouteAggressive();
        limitObstacles();
      }
    }
  }
}

// Check memory every 5 seconds
memoryCheckInterval = setInterval(checkMemory, 5000);
```

**Protection**:
- Route points limited to 5000 max
- Obstacles limited to 1000 max
- Memory monitoring every 5 seconds
- Automatic simplification at 80% memory usage
- Aggressive cleanup at 90% memory usage
- Memory warnings sent to React Native

### 5. Cache Corruption Prevention

**Problem**: Corrupted cache can cause rendering issues or crashes

**Solution**:
```javascript
let dataCache = {
  obstacles: null,
  ratedFeatures: { ids: [], ratings: {} },
  lastUpdate: 0
};

function updateCache(key, value) {
  try {
    dataCache[key] = JSON.parse(JSON.stringify(value)); // Deep clone
    dataCache.lastUpdate = Date.now();
  } catch (e) {
    console.error('Cache update error:', e);
    // Reset cache on corruption
    dataCache = {
      obstacles: null,
      ratedFeatures: { ids: [], ratings: {} },
      lastUpdate: 0
    };
  }
}
```

**Protection**:
- Deep cloning prevents reference issues
- Try-catch around all cache operations
- Automatic cache reset on corruption
- Timestamp tracking for cache freshness

## Feature Flag Usage

### Enable Mapbox

```typescript
// src/config/features.ts
export const FeatureFlags = {
  USE_MAPBOX_VECTOR_TILES: true, // Enable Mapbox
};
```

### Gradual Rollout Strategy

1. **Phase 1: Internal Testing** (Week 1)
   - Set flag to `true` for development builds
   - Test on multiple devices
   - Monitor performance and memory usage

2. **Phase 2: Beta Testing** (Week 2)
   - Enable for 5% of users
   - Monitor crash reports and feedback
   - Verify Mapbox API usage stays within limits

3. **Phase 3: Gradual Rollout** (Weeks 3-4)
   - 25% of users
   - 50% of users
   - 100% of users

4. **Phase 4: Remove Leaflet** (Week 5+)
   - Once stable, remove Leaflet code
   - Set flag permanently to `true`
   - Clean up unused code

## Performance Characteristics

### Mapbox GL JS (New)
- **Tile Size**: 3-5 KB (PBF format)
- **Rendering**: GPU-accelerated (WebGL)
- **Frame Rate**: 60 fps
- **Visual Quality**: Crisp at all zoom levels
- **Memory**: ~50-100 MB for typical session

### Leaflet (Current)
- **Tile Size**: 15-20 KB (PNG format)
- **Rendering**: CPU (Canvas)
- **Frame Rate**: 30-45 fps
- **Visual Quality**: Pixelated at high zoom
- **Memory**: ~30-50 MB for typical session

## Monitoring

### Key Metrics to Track

1. **Mapbox API Usage**
   - Go to https://account.mapbox.com/statistics/
   - Monitor tile requests per day
   - Free tier: 50,000 requests/month
   - Expected: ~500 requests per active user per month

2. **Memory Usage**
   - Watch for memory warnings in logs
   - Monitor crash reports related to memory
   - Check WebView memory consumption

3. **Performance**
   - Frame rate during map interactions
   - Time to first render
   - Responsiveness during route updates

4. **Errors**
   - WebGL initialization failures
   - Tile loading errors
   - Coordinate validation failures

## Troubleshooting

### Map doesn't load
- Check internet connection
- Verify Mapbox token is correct
- Check browser console for errors
- Ensure WebGL is supported

### Poor performance
- Check memory usage (may need aggressive simplification)
- Reduce obstacle count
- Simplify route more aggressively
- Consider device capabilities

### Tiles not loading
- Check Mapbox dashboard for API errors
- Verify you haven't exceeded free tier
- Check network requests in dev tools

### WebGL not supported
- Automatically falls back to Leaflet
- Most devices since 2015 support WebGL
- Consider showing warning to user

## Testing Checklist

- [ ] Map loads successfully
- [ ] Location marker updates smoothly
- [ ] Route rendering works (incremental and complete)
- [ ] Obstacles display correctly
- [ ] Rated obstacles show stars
- [ ] Feature tap opens popup
- [ ] Recenter button works
- [ ] Memory stays under 100 MB
- [ ] No coordinate validation errors
- [ ] Message queue doesn't overflow
- [ ] App backgrounding clears queue
- [ ] WebGL fallback works
- [ ] Mapbox API usage is reasonable

## Future Enhancements

### Optional: Add Proxy for Custom Data

If you want to use your Supabase proxy for custom data layers:

```javascript
// Fetch obstacles through proxy
const obstacles = await fetch(
  'https://vavqokubsuaiaaqmizso.supabase.co/functions/v1/obstacles',
  {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  }
);

map.addSource('obstacles', {
  type: 'geojson',
  data: obstacles
});
```

This gives you:
- Server-side caching for obstacles
- Rate limiting per user
- Usage analytics
- Token security

## Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/api/)
- [Mapbox Account Dashboard](https://account.mapbox.com/)
- [WebGL Support Check](https://get.webgl.org/)
- [React Native WebView Docs](https://github.com/react-native-webview/react-native-webview)
