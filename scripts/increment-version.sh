#!/bin/bash

# Android Version Increment Script
# This script increments versionCode and updates versionName in build.gradle

set -e

echo "📱 Android Version Increment Tool"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project paths
BUILD_GRADLE="android/app/build.gradle"

# Verify build.gradle exists
if [ ! -f "$BUILD_GRADLE" ]; then
    echo -e "${RED}❌ Error: build.gradle not found at $BUILD_GRADLE${NC}"
    exit 1
fi

# Function to validate semantic versioning format
validate_semver() {
    local version=$1
    # Regex for semantic versioning: MAJOR.MINOR.PATCH (with optional -suffix)
    if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
        return 0
    else
        return 1
    fi
}

# Extract current versionCode
echo "🔍 Reading current version information..."
CURRENT_VERSION_CODE=$(grep -E "^\s*versionCode\s+" "$BUILD_GRADLE" | sed -E 's/.*versionCode\s+([0-9]+).*/\1/')
CURRENT_VERSION_NAME=$(grep -E "^\s*versionName\s+" "$BUILD_GRADLE" | sed -E 's/.*versionName\s+"([^"]+)".*/\1/')

if [ -z "$CURRENT_VERSION_CODE" ]; then
    echo -e "${RED}❌ Error: Could not find versionCode in $BUILD_GRADLE${NC}"
    exit 1
fi

if [ -z "$CURRENT_VERSION_NAME" ]; then
    echo -e "${RED}❌ Error: Could not find versionName in $BUILD_GRADLE${NC}"
    exit 1
fi

echo ""
echo "Current version information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  versionCode: ${CYAN}$CURRENT_VERSION_CODE${NC}"
echo -e "  versionName: ${CYAN}$CURRENT_VERSION_NAME${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Calculate new versionCode
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

echo -e "${GREEN}✓${NC} versionCode will be incremented to: ${GREEN}$NEW_VERSION_CODE${NC}"
echo ""

# Prompt for versionName update
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Version Name Update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Semantic versioning format: MAJOR.MINOR.PATCH"
echo ""
echo "  MAJOR: Incompatible API changes"
echo "  MINOR: Add functionality (backward compatible)"
echo "  PATCH: Bug fixes (backward compatible)"
echo ""
echo -e "Current versionName: ${CYAN}$CURRENT_VERSION_NAME${NC}"
echo ""

# Suggest version increments based on current version
if validate_semver "$CURRENT_VERSION_NAME"; then
    # Parse current version
    IFS='.' read -r MAJOR MINOR PATCH_WITH_SUFFIX <<< "$CURRENT_VERSION_NAME"
    # Remove any suffix from PATCH (e.g., "0-beta" -> "0")
    PATCH=$(echo "$PATCH_WITH_SUFFIX" | sed -E 's/([0-9]+).*/\1/')
    
    SUGGESTED_PATCH="$MAJOR.$MINOR.$((PATCH + 1))"
    SUGGESTED_MINOR="$MAJOR.$((MINOR + 1)).0"
    SUGGESTED_MAJOR="$((MAJOR + 1)).0.0"
    
    echo "Suggestions:"
    echo "  [1] Patch release (bug fixes):     $SUGGESTED_PATCH"
    echo "  [2] Minor release (new features):  $SUGGESTED_MINOR"
    echo "  [3] Major release (breaking):      $SUGGESTED_MAJOR"
    echo "  [4] Custom version"
    echo "  [5] Keep current version"
    echo ""
    
    read -p "Select option [1-5]: " OPTION
    
    case $OPTION in
        1)
            NEW_VERSION_NAME="$SUGGESTED_PATCH"
            ;;
        2)
            NEW_VERSION_NAME="$SUGGESTED_MINOR"
            ;;
        3)
            NEW_VERSION_NAME="$SUGGESTED_MAJOR"
            ;;
        4)
            read -p "Enter custom version (e.g., 1.2.3): " NEW_VERSION_NAME
            ;;
        5)
            NEW_VERSION_NAME="$CURRENT_VERSION_NAME"
            ;;
        *)
            echo -e "${RED}❌ Invalid option${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${YELLOW}⚠ Current versionName doesn't follow semantic versioning${NC}"
    echo ""
    read -p "Enter new versionName (e.g., 1.0.0): " NEW_VERSION_NAME
fi

# Validate new versionName
if ! validate_semver "$NEW_VERSION_NAME"; then
    echo ""
    echo -e "${RED}❌ Error: Invalid semantic versioning format${NC}"
    echo ""
    echo "Version must follow format: MAJOR.MINOR.PATCH"
    echo "Examples: 1.0.0, 2.1.3, 1.0.0-beta"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} versionName will be updated to: ${GREEN}$NEW_VERSION_NAME${NC}"
echo ""

# Confirm changes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary of changes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  versionCode: $CURRENT_VERSION_CODE → $NEW_VERSION_CODE"
echo "  versionName: $CURRENT_VERSION_NAME → $NEW_VERSION_NAME"
echo ""
echo "File to be modified: $BUILD_GRADLE"
echo ""

read -p "Apply these changes? [y/N]: " CONFIRM

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}❌ Changes cancelled${NC}"
    exit 0
fi

# Create backup
BACKUP_FILE="${BUILD_GRADLE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$BUILD_GRADLE" "$BACKUP_FILE"
echo ""
echo -e "${GREEN}✓${NC} Backup created: $BACKUP_FILE"

# Update versionCode
if sed -i.tmp -E "s/(^\s*versionCode\s+)[0-9]+/\1$NEW_VERSION_CODE/" "$BUILD_GRADLE"; then
    rm -f "${BUILD_GRADLE}.tmp"
    echo -e "${GREEN}✓${NC} versionCode updated to $NEW_VERSION_CODE"
else
    echo -e "${RED}❌ Error: Failed to update versionCode${NC}"
    mv "$BACKUP_FILE" "$BUILD_GRADLE"
    exit 1
fi

# Update versionName
if sed -i.tmp -E "s/(^\s*versionName\s+)\"[^\"]+\"/\1\"$NEW_VERSION_NAME\"/" "$BUILD_GRADLE"; then
    rm -f "${BUILD_GRADLE}.tmp"
    echo -e "${GREEN}✓${NC} versionName updated to $NEW_VERSION_NAME"
else
    echo -e "${RED}❌ Error: Failed to update versionName${NC}"
    mv "$BACKUP_FILE" "$BUILD_GRADLE"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Version updated successfully!${NC}"
echo ""

# Verify changes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verification:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

VERIFY_VERSION_CODE=$(grep -E "^\s*versionCode\s+" "$BUILD_GRADLE" | sed -E 's/.*versionCode\s+([0-9]+).*/\1/')
VERIFY_VERSION_NAME=$(grep -E "^\s*versionName\s+" "$BUILD_GRADLE" | sed -E 's/.*versionName\s+"([^"]+)".*/\1/')

echo "  versionCode: $VERIFY_VERSION_CODE"
echo "  versionName: $VERIFY_VERSION_NAME"
echo ""

if [ "$VERIFY_VERSION_CODE" = "$NEW_VERSION_CODE" ] && [ "$VERIFY_VERSION_NAME" = "$NEW_VERSION_NAME" ]; then
    echo -e "${GREEN}✓${NC} Changes verified successfully"
else
    echo -e "${RED}❌ Warning: Verification failed${NC}"
    echo "Expected: versionCode=$NEW_VERSION_CODE, versionName=$NEW_VERSION_NAME"
    echo "Found: versionCode=$VERIFY_VERSION_CODE, versionName=$VERIFY_VERSION_NAME"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Review the changes in $BUILD_GRADLE"
echo ""
echo "2. Commit the version change:"
echo "   git add $BUILD_GRADLE"
echo "   git commit -m \"Bump version to $NEW_VERSION_NAME (versionCode $NEW_VERSION_CODE)\""
echo ""
echo "3. Build the release:"
echo "   ./scripts/build-release.sh"
echo ""
echo "4. If you need to revert:"
echo "   mv $BACKUP_FILE $BUILD_GRADLE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
