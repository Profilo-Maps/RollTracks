# Map Tile Setup for Android

## Overview

The RollTracks app uses offline map tiles for the map visualization feature. The tiles are bundled with the app as Android assets, so they're automatically included in the APK.

## Building the App with Tiles

### Automatic Method (Recommended)

The tiles are automatically copied to the Android assets during the build process:

```bash
npm run copy-tiles
```

Or they'll be copied automatically when you build:

```bash
npm run android
```

### Manual Method

If you need to manually copy tiles to the assets directory:

```bash
# Windows
scripts\copy-tiles-to-assets.bat

# Mac/Linux
bash scripts/copy-tiles-to-assets.sh
```

## Directory Structure

The tiles must follow this structure:

```
sf_tiles/
  10/
    163/
      395.png
      396.png
      ...
  11/
    327/
      790.png
      791.png
      ...
  ...
  17/
    20964/
      50262.png
      50263.png
      ...
```

Where:
- `{z}` = Zoom level (10-18)
- `{x}` = Longitude tile coordinate
- `{y}` = Latitude tile coordinate

## How It Works

The tiles are stored in the Android app's assets directory:

```
android/app/src/main/assets/sf_tiles/
```

When the app is built, these assets are packaged into the APK. The WebView accesses them using:

```
file:///android_asset/sf_tiles/{z}/{x}/{y}.png
```

This means:
- ✅ No manual copying to device needed
- ✅ Tiles work immediately after installation
- ✅ Works on all Android devices
- ✅ No storage permissions required for tiles
- ✅ Tiles are included in app store distribution

## Verifying Tiles Are Bundled

After running the copy script, verify the tiles are in the assets directory:

```bash
# Check if tiles directory exists
ls android/app/src/main/assets/sf_tiles/

# Count tiles (Windows PowerShell)
(Get-ChildItem -Path android/app/src/main/assets/sf_tiles -Recurse -Filter *.png).Count

# Count tiles (Mac/Linux)
find android/app/src/main/assets/sf_tiles -name "*.png" | wc -l
```

## Troubleshooting

### Tiles Not Showing

If the map shows a gray background with only the polyline visible:

1. **Check tile location**: Verify tiles are in `/sdcard/MobilityTripTracker1/MapData/sf_tiles/`
2. **Check folder structure**: Ensure the `{z}/{x}/{y}.png` structure is correct
3. **Check permissions**: Grant storage permissions to the app
4. **Check tile format**: Tiles must be PNG images
5. **Check logs**: Look for "Tile load error" messages in the console

## First Time Setup

Before building the app for the first time:

1. Ensure tiles exist at: `C:\MobilityTripTracker1\MapData\sf_tiles`
2. Run the copy script: `npm run copy-tiles`
3. Build the app: `npm run android`

The tiles will be automatically included in the APK!

## San Francisco Tile Coverage

The current tiles are for San Francisco at zoom level 17. If you're testing outside this area, you'll see blank tiles. The map will still work for tracking, but background tiles won't be visible.

To add tiles for other areas, generate tiles for your location and place them in the same directory structure.
