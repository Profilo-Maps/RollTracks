@echo off
REM Script to copy map tiles to Android assets directory

echo Copying map tiles to Android assets...

REM Create assets directory if it doesn't exist
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"

REM Copy tiles from source to assets
echo Copying from C:\MobilityTripTracker1\MapData\sf_tiles
echo To android\app\src\main\assets\sf_tiles

xcopy "C:\MobilityTripTracker1\MapData\sf_tiles" "android\app\src\main\assets\sf_tiles" /E /I /Y

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Tiles copied successfully!
    echo.
    echo The tiles are now bundled with the app and will be included in the APK.
    echo You can now build the app with: npm run android
) else (
    echo.
    echo ✗ Error copying tiles. Please check:
    echo   1. Source path exists: C:\MobilityTripTracker1\MapData\sf_tiles
    echo   2. You have read permissions for the source directory
    echo   3. You have write permissions for the android directory
)

pause
