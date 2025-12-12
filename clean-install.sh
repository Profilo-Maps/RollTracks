#!/bin/bash

echo "========================================"
echo "Clean Install Script for RollTracks"
echo "========================================"
echo ""

echo "Step 1: Uninstalling old app from emulator/device..."
adb uninstall com.rolltracks 2>/dev/null
if [ $? -eq 0 ]; then
    echo "App uninstalled successfully"
else
    echo "No existing app found or uninstall failed - continuing anyway"
fi
echo ""

echo "Step 2: Cleaning build artifacts..."
cd android
./gradlew clean
cd ..
echo ""

echo "Step 3: Clearing Metro bundler cache..."
npx react-native start --reset-cache &
METRO_PID=$!
sleep 5
kill $METRO_PID 2>/dev/null
echo ""

echo "Step 4: Building and installing fresh app..."
npx react-native run-android
echo ""

echo "========================================"
echo "Clean install complete!"
echo "========================================"
