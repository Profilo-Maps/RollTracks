#!/bin/bash

# Android Release Build Script
# This script builds a signed release AAB for Google Play Console upload

set -e

echo "🚀 Building Android Release AAB..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
ANDROID_DIR="android"
GRADLE_PROPS="$ANDROID_DIR/gradle.properties"
GRADLE_PROPS_EXAMPLE="$ANDROID_DIR/gradle.properties.example"
AAB_OUTPUT="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

# Step 1: Verify gradle.properties exists
echo "📋 Step 1: Verifying gradle.properties configuration..."
if [ ! -f "$GRADLE_PROPS" ]; then
    echo -e "${RED}❌ Error: gradle.properties not found${NC}"
    echo ""
    echo "Release signing is not configured. To set up:"
    echo ""
    echo "1. Copy the example file:"
    echo "   cp $GRADLE_PROPS_EXAMPLE $GRADLE_PROPS"
    echo ""
    echo "2. Edit $GRADLE_PROPS and fill in your keystore details:"
    echo "   - RELEASE_STORE_FILE: Path to your release keystore"
    echo "   - RELEASE_STORE_PASSWORD: Your keystore password"
    echo "   - RELEASE_KEY_ALIAS: Your key alias"
    echo "   - RELEASE_KEY_PASSWORD: Your key password"
    echo ""
    echo "3. Run this script again"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} gradle.properties found"

# Verify required properties are set
echo "🔍 Verifying signing properties..."
MISSING_PROPS=()

if ! grep -q "^RELEASE_STORE_FILE=.*[^_here]$" "$GRADLE_PROPS" 2>/dev/null; then
    MISSING_PROPS+=("RELEASE_STORE_FILE")
fi

if ! grep -q "^RELEASE_STORE_PASSWORD=.*[^_here]$" "$GRADLE_PROPS" 2>/dev/null; then
    MISSING_PROPS+=("RELEASE_STORE_PASSWORD")
fi

if ! grep -q "^RELEASE_KEY_ALIAS=.*[^_here]$" "$GRADLE_PROPS" 2>/dev/null; then
    MISSING_PROPS+=("RELEASE_KEY_ALIAS")
fi

if ! grep -q "^RELEASE_KEY_PASSWORD=.*[^_here]$" "$GRADLE_PROPS" 2>/dev/null; then
    MISSING_PROPS+=("RELEASE_KEY_PASSWORD")
fi

if [ ${#MISSING_PROPS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Error: Required signing properties not configured${NC}"
    echo ""
    echo "The following properties need to be set in $GRADLE_PROPS:"
    for prop in "${MISSING_PROPS[@]}"; do
        echo "  - $prop"
    done
    echo ""
    echo "Edit $GRADLE_PROPS and replace placeholder values with your actual keystore details."
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} All signing properties configured"
echo ""

# Step 2: Clean previous build
echo "🧹 Step 2: Cleaning previous build..."
cd "$ANDROID_DIR"
if ./gradlew clean > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Clean successful"
else
    echo -e "${YELLOW}⚠${NC} Clean failed, continuing anyway..."
fi
echo ""

# Step 3: Build release AAB
echo "📦 Step 3: Building release AAB..."
echo -e "${BLUE}This may take a few minutes...${NC}"
echo ""

if ./gradlew bundleRelease; then
    echo ""
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Incorrect keystore password or path"
    echo "  - Missing dependencies"
    echo "  - Compilation errors in code"
    echo ""
    echo "Check the error messages above for details."
    exit 1
fi
echo ""

# Go back to project root
cd ..

# Step 4: Verify AAB exists
echo "🔍 Step 4: Verifying AAB output..."
if [ ! -f "$AAB_OUTPUT" ]; then
    echo -e "${RED}❌ Error: AAB file not found at expected location${NC}"
    echo "Expected: $AAB_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✓${NC} AAB file generated"
echo ""

# Step 5: Display AAB information
echo "📊 Step 5: AAB Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get file size
if command -v stat &> /dev/null; then
    # Linux/Mac
    FILE_SIZE=$(stat -f%z "$AAB_OUTPUT" 2>/dev/null || stat -c%s "$AAB_OUTPUT" 2>/dev/null)
else
    # Fallback: use ls
    FILE_SIZE=$(ls -l "$AAB_OUTPUT" | awk '{print $5}')
fi

# Convert to human-readable format
if [ "$FILE_SIZE" -gt 1048576 ]; then
    SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1048576" | bc)
    SIZE_DISPLAY="${SIZE_MB} MB"
else
    SIZE_KB=$(echo "scale=2; $FILE_SIZE / 1024" | bc)
    SIZE_DISPLAY="${SIZE_KB} KB"
fi

echo "Location: $AAB_OUTPUT"
echo "Size: $SIZE_DISPLAY ($FILE_SIZE bytes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 6: Run bundletool validation (if available)
echo "🔐 Step 6: Validating AAB with bundletool..."

# Check if bundletool is available
BUNDLETOOL_CMD=""
if command -v bundletool &> /dev/null; then
    BUNDLETOOL_CMD="bundletool"
elif command -v bundletool-all &> /dev/null; then
    BUNDLETOOL_CMD="bundletool-all"
elif [ -f "bundletool.jar" ]; then
    BUNDLETOOL_CMD="java -jar bundletool.jar"
fi

if [ -n "$BUNDLETOOL_CMD" ]; then
    echo "Running validation..."
    if $BUNDLETOOL_CMD validate --bundle="$AAB_OUTPUT"; then
        echo -e "${GREEN}✓${NC} AAB validation passed"
    else
        echo -e "${RED}❌ AAB validation failed${NC}"
        echo "The AAB file may have issues. Review the errors above."
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} bundletool not found - skipping validation"
    echo ""
    echo "To install bundletool for validation:"
    echo "  1. Download from: https://github.com/google/bundletool/releases"
    echo "  2. Add to PATH or place bundletool.jar in project root"
    echo ""
    echo "Validation is recommended but not required for upload."
fi
echo ""

# Success summary
echo -e "${GREEN}✅ Release build complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Test the AAB on a device (optional):"
echo "   bundletool build-apks --bundle=$AAB_OUTPUT --output=app.apks"
echo "   bundletool install-apks --apks=app.apks"
echo ""
echo "2. Upload to Google Play Console:"
echo "   - Go to: https://play.google.com/console"
echo "   - Navigate to: Release > Production > Create new release"
echo "   - Upload: $AAB_OUTPUT"
echo ""
echo "3. Before uploading, ensure:"
echo "   - Version code has been incremented in android/app/build.gradle"
echo "   - Release notes are prepared"
echo "   - All Play Console requirements are met"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
