# Mapbox Tiles Not Displaying - Debug Guide

## Issue
Map container loads but tiles don't display (blank/gray screen).

## Debug Steps

### Step 1: Rebuild with Debug Logging
```bash
cd android
./gradlew clean
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Step 2: Check Console Output

After rebuilding, start the app and check the console for these messages:

**Expected sequence:**
```
Mapbox initialization script starting...
Creating Mapbox map instance...
Map instance created, waiting for load event...
Map style data loaded
Tiles loading for source: composite
Map load event fired
Adding route source and layer...
Route layer added
Tiles loaded for source: composite
Map is ready
```

**What to look for:**
- ❌ If you don't see "Map style data loaded" → Style not loading
- ❌ If you don't see "Tiles loading" → Network issue
- ❌ If you see "Tiles loading" but not "Tiles loaded" → Tiles failing to load

### Step 3: Check What You See

**Scenario A: Gray Background Visible**
- ✅ Map container is rendering
- ❌ Tiles not loading
- **Likely cause**: Network issue or Mapbox API problem

**Scenario B: Completely Blank**
- ❌ Map container not rendering
- **Likely cause**: WebView issue or styling problem

**Scenario C: Loading Indicator Stuck**
- ❌ Map never fires 'ready' event
- **Likely cause**: Map initialization failing silently

### Step 4: Test Internet Connection

```bash
# From device, test Mapbox API
adb shell
ping api.mapbox.com
curl https://api.mapbox.com/
```

### Step 5: Inspect WebView (Advanced)

1. Enable WebView debugging (if not already enabled)
2. Open Chrome: `chrome://inspect`
3. Find your app's WebView
4. Click "inspect"
5. Check Console tab for errors
6. Check Network tab to see if tiles are loading

**What to look for in Network tab:**
- Requests to `api.mapbox.com/styles/...` (style loading)
- Requests to `api.tiles.mapbox.com/...` (tile loading)
- Any failed requests (red)

## Common Causes & Solutions

### Cause 1: Network/Firewall Blocking Mapbox
**Symptoms**: 
- "Map style data loaded" never appears
- No tile requests in Network tab

**Solution**:
- Check internet connection
- Try on different network (mobile data vs WiFi)
- Check if corporate firewall blocks Mapbox

### Cause 2: Invalid Mapbox Token
**Symptoms**:
- Style loads but tiles don't
- 401 errors in Network tab

**Solution**:
- Verify token at: https://account.mapbox.com/access-tokens/
- Check token hasn't expired
- Ensure token has correct scopes

### Cause 3: WebView Not Rendering
**Symptoms**:
- No gray background visible
- No console output

**Solution**:
- Check WebView is enabled in AndroidManifest.xml
- Verify WebView component is rendering
- Check React Native WebView version

### Cause 4: Style URL Issue
**Symptoms**:
- Map initializes but stays blank
- Style loading fails

**Solution**:
Try a different style URL in the code:
```javascript
// Instead of:
style: 'mapbox://styles/mapbox/streets-v12',

// Try:
style: 'mapbox://styles/mapbox/streets-v11',
// or
style: 'mapbox://styles/mapbox/light-v11',
```

### Cause 5: CORS or Mixed Content
**Symptoms**:
- Tiles blocked by browser security

**Solution**:
Already handled in WebView config:
```typescript
mixedContentMode="always"
originWhitelist={['*']}
```

## Quick Tests

### Test 1: Check if mapboxgl is loaded
In WebView console:
```javascript
console.log(typeof mapboxgl); // Should be 'object'
console.log(mapboxgl.version); // Should show version number
```

### Test 2: Check map instance
```javascript
console.log(map); // Should show Map object
console.log(map.getStyle()); // Should show style object
```

### Test 3: Check token
```javascript
console.log(mapboxgl.accessToken); // Should show your token
```

### Test 4: Force tile reload
```javascript
map.triggerRepaint();
```

## Fallback: Use Different Mapbox Version

If tiles still don't load, try an older Mapbox GL JS version:

In `MapViewMapbox.tsx`, change:
```html
<!-- From: -->
<script src='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'></script>
<link href='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css' rel='stylesheet' />

<!-- To: -->
<script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
<link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
```

## Report Back

After running these tests, report:
1. **Console output** (especially the sequence of log messages)
2. **What you see** (gray background, blank, loading indicator)
3. **Network tab** (any failed requests)
4. **WebView console** (any errors)

This will help identify the exact issue!
