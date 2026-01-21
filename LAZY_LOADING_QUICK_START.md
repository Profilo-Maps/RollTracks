# Lazy Loading Quick Start

## TL;DR

Map lazy loading is **already enabled by default**. Your maps will load faster automatically.

## What Changed?

Maps now only render obstacles visible in the current viewport, dramatically improving performance.

## Performance Gains

- **Before**: 3-5 seconds to load 1000 obstacles
- **After**: < 500ms to load 1000 obstacles
- **Memory**: 67% reduction (45MB → 15MB)

## Do I Need to Change My Code?

**No!** Lazy loading works automatically. But you can optimize further if needed.

## Optional: Maximum Performance

For even better performance with large datasets (> 500 obstacles):

```typescript
import { useViewportObstacles } from '../hooks';

// In your component:
const visibleObstacles = useViewportObstacles({
  allObstacles: allObstaclesArray,
  currentLocation,
  routePoints,
  viewportRadiusMeters: 500, // Adjust as needed
});

<MapViewMapbox
  obstacleFeatures={visibleObstacles} // Use filtered obstacles
  enableLazyLoading={true}
/>
```

## Configuration Cheat Sheet

### Viewport Radius

```typescript
// Active trips (real-time tracking)
viewportRadiusMeters: 300

// Trip summaries (historical view)
viewportRadiusMeters: 500

// Large area overview
viewportRadiusMeters: 1000
```

### When to Use React Native Filtering

| Obstacle Count | Use Hook? | Why |
|----------------|-----------|-----|
| < 100 | No | WebView filtering is sufficient |
| 100-500 | Optional | Marginal benefit |
| 500-1000 | Yes | Noticeable improvement |
| > 1000 | Yes | Significant improvement |

## Disable Lazy Loading

If you encounter issues:

```typescript
<MapViewMapbox
  enableLazyLoading={false}
  obstacleFeatures={allObstacles}
/>
```

## Monitor Performance

Check console logs:

```javascript
// WebView console
"Lazy loading: Filtered 45 visible obstacles from 1200 total in 12ms"

// React Native console
"Filtered 45 obstacles from 1200 total in 8ms (spatial index)"
```

## Full Documentation

- **Technical details**: `docs/LazyLoadingOptimization.md`
- **Migration guide**: `docs/LazyLoadingMigrationGuide.md`
- **Architecture**: `docs/LazyLoadingArchitecture.md`
- **Summary**: `LAZY_LOADING_SUMMARY.md`

## Questions?

Check the troubleshooting section in `docs/LazyLoadingMigrationGuide.md`
