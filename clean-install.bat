@echo off
echo ========================================
echo Clean Install Script for RollTracks
echo ========================================
echo.

echo Step 1: Uninstalling old app from Android emulator...
adb uninstall com.rolltracks 2>nul
if %errorlevel% equ 0 (
    echo App uninstalled successfully
) else (
    echo No existing app found or uninstall failed - continuing anyway
)
echo.

echo Step 2: Cleaning build artifacts...
cd android
call gradlew clean
cd ..
echo.

echo Step 3: Clearing Metro bundler cache...
call npx react-native start --reset-cache &
timeout /t 5 /nobreak >nul
taskkill /F /IM node.exe /T 2>nul
echo.

echo Step 4: Building and installing fresh app...
call npx react-native run-android
echo.

echo ========================================
echo Clean install complete!
echo ========================================
pause
