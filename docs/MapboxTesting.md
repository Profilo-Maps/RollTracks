# Mapbox Integration Testing Guide

## Quick Start

### 1. Enable Mapbox

```typescript
// src/config/features.ts
export const FeatureFlags = {
  USE_MAPBOX_VECTOR_TILES: true, // Change to true
};
```

### 2. Build and Install

```bash
# Windows
npm run clean-install
cd android
gradlew clean
gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk

# Linux/Mac
npm run clean-install
cd android
./gradlew clean
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 3. Test Basic Functionality

1. **Launch app** and log in
2. **Start a trip** from StartTripScreen
3. **Verify map loads** with Mapbox tiles (should look crisper than Leaflet)
4. **Move around** and verify location marker updates
5. **Check obstacles** appear on map
6. **Tap an obstacle** to verify popup works
7. **Rate an obstacle** and verify star appears
8. **End trip** and view summary
9. **Verify route** displays correctly on summary screen

## Detailed Test Cases

### Test 1: Map Initialization

**Steps**:
1. Enable Mapbox feature flag
2. Launch app
3. Navigate to ActiveTripScreen

**Expected**:
- Map loads within 2-3 seconds
- No errors in console
- Map shows Mapbox vector tiles (crisp text, smooth rendering)
- Loading indicator disappears after map loads

**Verify**:
- [ ] Map loads successfully
- [ ] No "WebGL not supported" errors
- [ ] No JavaScript errors in logs
- [ ] Map is interactive (can pan/zoom)

### Test 2: Location Tracking

**Steps**:
1. Start a trip
2. Move around (or use GPS simulation)
3. Watch location marker

**Expected**:
- Blue dot appears at current location
- Accuracy circle shows around marker
- Marker updates smoothly (no jumping)
- Map auto-centers on location

**Verify**:
- [ ] Location marker appears
- [ ] Marker updates as you move
- [ ] Accuracy circle displays
- [ ] Auto-centering works
- [ ] Recenter button appears when you pan away

### Test 3: Route Rendering

**Steps**:
1. Start a trip
2. Move around to create a route
3. Watch blue line appear

**Expected**:
- Blue line follows your path
- Line is smooth (not jagged)
- Line updates in real-time
- No lag or stuttering

**Verify**:
- [ ] Route line appears
- [ ] Line follows your path
- [ ] Smooth rendering (60fps)
- [ ] No memory issues with long routes

### Test 4: Obstacle Markers

**Steps**:
1. Navigate to area with obstacles
2. Verify obstacles appear on map
3. Tap an obstacle

**Expected**:
- Obstacles appear as colored circles
- Colors match condition scores (green/orange/purple)
- Tap opens popup with details
- Rated obstacles show stars

**Verify**:
- [ ] Obstacles display correctly
- [ ] Colors are correct
- [ ] Tap handler works
- [ ] Popup shows correct info
- [ ] Stars appear for rated obstacles

### Test 5: Rating Flow

**Steps**:
1. Tap an unrated obstacle
2. Click "Rate" button
3. Submit a rating
4. Verify star appears

**Expected**:
- Popup opens on tap
- Rating modal appears
- After rating, obstacle shows star
- Star color matches rating (green/yellow/red)

**Verify**:
- [ ] Rating modal opens
- [ ] Rating submits successfully
- [ ] Star appears immediately
- [ ] Star color is correct
- [ ] Popup shows rating value

### Test 6: Trip Summary

**Steps**:
1. Complete a trip
2. View trip summary
3. Verify map shows complete route

**Expected**:
- Map shows entire route at once
- Route is fitted to screen
- All obstacles along route visible
- Rated obstacles show stars

**Verify**:
- [ ] Complete route displays
- [ ] Map fits route to screen
- [ ] Obstacles are visible
- [ ] Stars show for rated obstacles
- [ ] Can tap obstacles in summary

### Test 7: Memory Management

**Steps**:
1. Start a long trip (30+ minutes)
2. Create a long route (1000+ points)
3. Encounter many obstacles (100+)
4. Monitor memory usage

**Expected**:
- Memory stays under 100 MB
- No memory warnings in logs
- No crashes or slowdowns
- Route simplification kicks in automatically

**Verify**:
- [ ] Memory stays reasonable
- [ ] No memory warnings
- [ ] No crashes
- [ ] Performance stays smooth

### Test 8: App Backgrounding

**Steps**:
1. Start a trip
2. Press home button (background app)
3. Wait 30 seconds
4. Return to app

**Expected**:
- Map resumes correctly
- Location tracking continues
- No errors or crashes
- Message queue was cleared

**Verify**:
- [ ] App resumes correctly
- [ ] Map still works
- [ ] Location updates resume
- [ ] No queue overflow errors

### Test 9: Network Issues

**Steps**:
1. Enable airplane mode
2. Try to load map
3. Disable airplane mode
4. Verify map loads

**Expected**:
- Error message if no network
- Map loads when network returns
- Cached tiles still work
- Graceful error handling

**Verify**:
- [ ] Error message appears
- [ ] Map recovers when online
- [ ] No crashes
- [ ] User-friendly error messages

### Test 10: Coordinate Validation

**Steps**:
1. Simulate invalid GPS data (if possible)
2. Check logs for validation errors
3. Verify map doesn't crash

**Expected**:
- Invalid coordinates rejected silently
- No map crashes
- Warning in logs
- Map continues working

**Verify**:
- [ ] Invalid coordinates handled
- [ ] No crashes
- [ ] Warnings logged
- [ ] Map stays functional

## Performance Benchmarks

### Target Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Map Load Time | < 3 seconds | Time from screen open to map ready |
| Frame Rate | 60 fps | Smooth panning/zooming |
| Memory Usage | < 100 MB | Android Studio Profiler |
| Location Update | < 100ms | Time from GPS to marker update |
| Route Render | < 50ms | Time to add route point |
| Obstacle Render | < 200ms | Time to update obstacles |

### Measuring Performance

**Android Studio Profiler**:
1. Open Android Studio
2. Run app on device
3. Open Profiler (View → Tool Windows → Profiler)
4. Monitor Memory and CPU

**Chrome DevTools** (for WebView):
1. Enable WebView debugging in app
2. Open chrome://inspect in Chrome
3. Click "inspect" on your WebView
4. Use Performance tab

## Monitoring Checklist

### During Testing

- [ ] Watch console logs for errors
- [ ] Monitor memory usage
- [ ] Check frame rate during interactions
- [ ] Verify no coordinate validation errors
- [ ] Check message queue doesn't overflow
- [ ] Monitor Mapbox API usage

### After Testing

- [ ] Review crash reports
- [ ] Check Mapbox dashboard for usage
- [ ] Analyze performance metrics
- [ ] Collect user feedback
- [ ] Review error logs

## Mapbox API Usage Monitoring

### Check Usage

1. Go to https://account.mapbox.com/
2. Click "Statistics"
3. View tile requests

### Expected Usage

**First Day** (cold cache):
- High tile requests (500-1000 per user)
- Normal for initial loading

**Subsequent Days** (warm cache):
- Lower tile requests (50-100 per user)
- Mapbox GL JS caching working

**Monthly**:
- ~500 tiles per active user per month
- Should stay well under 50k free tier limit

### Usage Alerts

Set up alerts if:
- Daily usage > 2000 requests
- Monthly usage > 40,000 requests (80% of limit)
- Unusual spike in requests

## Troubleshooting

### Map doesn't load

**Check**:
1. Internet connection
2. Mapbox token is correct
3. WebGL support (chrome://gpu)
4. Console errors

**Fix**:
- Verify token in MapViewMapbox.tsx
- Check device WebGL support
- Review error logs

### Poor performance

**Check**:
1. Memory usage
2. Route point count
3. Obstacle count
4. Device capabilities

**Fix**:
- Reduce MAX_ROUTE_POINTS
- Reduce MAX_OBSTACLES
- Increase simplification tolerance
- Test on newer device

### Tiles not loading

**Check**:
1. Network connection
2. Mapbox API status
3. Token validity
4. Rate limits

**Fix**:
- Check Mapbox dashboard
- Verify token hasn't expired
- Check for API errors

### Memory issues

**Check**:
1. Route point count
2. Obstacle count
3. Memory warnings in logs

**Fix**:
- Increase simplification
- Reduce MAX_ROUTE_POINTS
- Reduce MAX_OBSTACLES
- Clear cache more aggressively

## Rollback Plan

If issues occur:

### Quick Rollback

```typescript
// src/config/features.ts
export const FeatureFlags = {
  USE_MAPBOX_VECTOR_TILES: false, // Disable Mapbox
};
```

Rebuild and redeploy. App will use Leaflet again.

### Gradual Rollback

If only some users have issues:
1. Identify affected devices/users
2. Add device-specific checks
3. Disable for problematic devices only

## Success Criteria

### Must Pass

- [ ] Map loads on all test devices
- [ ] No crashes during normal use
- [ ] Memory stays under 100 MB
- [ ] Performance is smooth (60fps)
- [ ] All features work (location, routes, obstacles, ratings)
- [ ] Mapbox usage stays under free tier

### Nice to Have

- [ ] Faster than Leaflet
- [ ] Better visual quality
- [ ] Lower memory usage than expected
- [ ] Higher frame rate than Leaflet

## Next Steps After Testing

1. **If all tests pass**: Begin gradual rollout (5% → 25% → 50% → 100%)
2. **If minor issues**: Fix and retest
3. **If major issues**: Rollback and investigate
4. **If performance issues**: Optimize and retest

## Support

- **Mapbox Support**: https://support.mapbox.com/
- **Documentation**: `docs/MapboxIntegration.md`
- **Implementation Status**: `.kiro/specs/mapbox-vector-tiles/IMPLEMENTATION_STATUS.md`
