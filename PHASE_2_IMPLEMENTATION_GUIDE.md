# Phase 2: Mapbox GL JS Integration - Implementation Guide

## ✅ Phase 1 Complete

Your serverless proxy infrastructure is deployed and ready:
- Database tables created (`tile_cache`, `tile_usage`)
- Edge Function deployed (`mapbox-tiles`)
- Mapbox token stored securely server-side
- MapboxProxyService ready for use

## 📋 Phase 2 Overview

Phase 2 integrates Mapbox GL JS vector tiles into your React Native app, replacing the current Leaflet + raster tile implementation.

## 🎯 Two Implementation Approaches

### Approach A: Direct Mapbox (Recommended for MVP)

**Pros**:
- Simpler implementation
- Faster to deploy
- Uses Mapbox's CDN (fast, reliable)
- Public token is designed for this use case

**Cons**:
- Token visible in app (but this is normal and safe)
- Uses Mapbox API directly (within free tier limits)

**Implementation**: Use Mapbox GL JS with your public token directly in the WebView.

### Approach B: Full Proxy Integration

**Pros**:
- Token never in app
- Full control over caching
- Better for scaling beyond free tier

**Cons**:
- More complex
- Requires custom tile loading protocol
- Harder to debug

**Implementation**: Route all tile requests through your Supabase Edge Function.

## 🚀 Recommended Path: Start with Approach A

1. **Create MapViewMapbox component** using Mapbox GL JS with public token
2. **Test thoroughly** with real devices
3. **Monitor usage** in Mapbox dashboard
4. **Migrate to Approach B** later if needed (when scaling beyond free tier)

## 📝 Implementation Steps

### Step 1: Create MapViewMapbox Component

Create `src/components/MapViewMapbox.tsx`:

```typescript
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import WebView from 'react-native-webview';
import { LocationPoint, ObstacleFeature } from '../types';

const MAPBOX_TOKEN = 'pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA';

export const MapViewMapbox: React.FC<MapViewProps> = (props) => {
  // Component implementation
  // See full code in .kiro/specs/mapbox-vector-tiles/code-examples/MapViewMapbox.tsx
};
```

**Key features to implement**:
- Mapbox GL JS initialization with your token
- WebGL support detection
- Location marker updates
- Route polyline rendering
- Obstacle markers
- Message protocol (same as Leaflet version)

### Step 2: Create Feature Flag

Add a feature flag to toggle between Leaflet and Mapbox:

```typescript
// src/config/features.ts
export const FeatureFlags = {
  USE_MAPBOX_VECTOR_TILES: false, // Set to true to enable Mapbox
};
```

### Step 3: Update Screens to Use Feature Flag

```typescript
// src/screens/ActiveTripScreen.tsx
import { MapView } from '../components/MapView'; // Leaflet
import { MapViewMapbox } from '../components/MapViewMapbox'; // Mapbox
import { FeatureFlags } from '../config/features';

const MapComponent = FeatureFlags.USE_MAPBOX_VECTOR_TILES ? MapViewMapbox : MapView;

// In render:
<MapComponent
  currentLocation={currentLocation}
  routePoints={routePoints}
  // ... other props
/>
```

### Step 4: Test with Mapbox

1. Set `USE_MAPBOX_VECTOR_TILES = true`
2. Run the app
3. Verify:
   - Map loads with vector tiles
   - Location tracking works
   - Routes display correctly
   - Obstacles show up
   - Performance is good

### Step 5: Monitor Usage

Check Mapbox dashboard:
- Go to https://account.mapbox.com/
- View "Statistics" tab
- Monitor tile requests
- Ensure you're within free tier (50k requests/month)

## 📊 Expected Performance

### Mapbox GL JS vs Leaflet

| Feature | Leaflet (Current) | Mapbox GL JS (New) |
|---------|-------------------|-------------------|
| Tile Size | 15-20 KB (PNG) | 3-5 KB (PBF) |
| Visual Quality | Pixelated at zoom | Crisp at all zooms |
| Rendering | CPU (Canvas) | GPU (WebGL) |
| Frame Rate | 30-45 fps | 60 fps |
| Styling | Fixed | Dynamic |
| Offline | Bundled tiles | Cached tiles |

### Free Tier Usage

**Mapbox Free Tier**: 50,000 tile requests/month

**Estimated Usage**:
- Average session: 50 tiles
- 10 sessions per user per month
- **Supports ~100 active users** within free tier

**With Mapbox's automatic caching**: Actual usage will be lower.

## 🔧 Configuration Options

### Mapbox Style

You can use different Mapbox styles:

```javascript
// In WebView HTML
map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12', // Default
  // Or:
  // style: 'mapbox://styles/mapbox/outdoors-v12',
  // style: 'mapbox://styles/mapbox/light-v11',
  // style: 'mapbox://styles/mapbox/dark-v11',
  // style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [-122.4194, 37.7749],
  zoom: 17
});
```

### Custom Styles

Create custom styles at https://studio.mapbox.com/ and use:

```javascript
style: 'mapbox://styles/profilo-maps/YOUR_STYLE_ID'
```

## 🐛 Troubleshooting

### "WebGL not supported"
- Device doesn't support WebGL
- Fall back to Leaflet automatically
- Most modern devices support WebGL

### Map doesn't load
- Check internet connection
- Verify Mapbox token is correct
- Check browser console for errors

### Tiles not loading
- Check Mapbox dashboard for API errors
- Verify you haven't exceeded free tier
- Check network requests in dev tools

### Poor performance
- Reduce obstacle marker count
- Simplify route polylines
- Lower map quality on older devices

## 📚 Resources

### Mapbox Documentation
- GL JS API: https://docs.mapbox.com/mapbox-gl-js/api/
- Style Spec: https://docs.mapbox.com/mapbox-gl-js/style-spec/
- Examples: https://docs.mapbox.com/mapbox-gl-js/example/

### Your Mapbox Account
- Dashboard: https://account.mapbox.com/
- Tokens: https://account.mapbox.com/access-tokens/
- Statistics: https://account.mapbox.com/statistics/
- Studio: https://studio.mapbox.com/

## ⏭️ Next Steps

1. **Implement MapViewMapbox** component
2. **Add feature flag** for easy toggling
3. **Test thoroughly** on real devices
4. **Monitor usage** in Mapbox dashboard
5. **Gradually roll out** to users (5% → 25% → 100%)
6. **Consider proxy integration** if scaling beyond free tier

## 💡 Pro Tips

1. **Start Simple**: Get basic map working first, then add features
2. **Test on Real Devices**: WebView behavior differs from browser
3. **Monitor Usage**: Keep an eye on Mapbox API usage
4. **Cache Aggressively**: Mapbox GL JS caches automatically
5. **Fallback to Leaflet**: Keep Leaflet as backup for unsupported devices

## 🎓 Learning Resources

If you're new to Mapbox GL JS:
1. Start with the [Quickstart Guide](https://docs.mapbox.com/mapbox-gl-js/guides/)
2. Try [Interactive Examples](https://docs.mapbox.com/mapbox-gl-js/example/)
3. Read [Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/)

## 📞 Support

- **Mapbox Support**: https://support.mapbox.com/
- **Spec Documentation**: `.kiro/specs/mapbox-vector-tiles/`
- **Implementation Status**: `.kiro/specs/mapbox-vector-tiles/IMPLEMENTATION_STATUS.md`

---

**Ready to implement?** Start with Step 1 and create the MapViewMapbox component. The proxy infrastructure is ready when you need it!
