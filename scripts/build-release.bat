@echo off
REM Android Release Build Script (Windows)
REM This script builds a signed release AAB for Google Play Console upload

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Android Release Build Script
echo ========================================
echo.

REM Project paths
set "ANDROID_DIR=android"
set "GRADLE_PROPS=%ANDROID_DIR%\gradle.properties"
set "GRADLE_PROPS_EXAMPLE=%ANDROID_DIR%\gradle.properties.example"
set "AAB_OUTPUT=%ANDROID_DIR%\app\build\outputs\bundle\release\app-release.aab"

REM Step 1: Verify gradle.properties exists
echo [Step 1] Verifying gradle.properties configuration...
if not exist "%GRADLE_PROPS%" (
    echo.
    echo [ERROR] gradle.properties not found
    echo.
    echo Release signing is not configured. To set up:
    echo.
    echo 1. Copy the example file:
    echo    copy %GRADLE_PROPS_EXAMPLE% %GRADLE_PROPS%
    echo.
    echo 2. Edit %GRADLE_PROPS% and fill in your keystore details:
    echo    - RELEASE_STORE_FILE: Path to your release keystore
    echo    - RELEASE_STORE_PASSWORD: Your keystore password
    echo    - RELEASE_KEY_ALIAS: Your key alias
    echo    - RELEASE_KEY_PASSWORD: Your key password
    echo.
    echo 3. Run this script again
    echo.
    exit /b 1
)

echo [OK] gradle.properties found
echo.

REM Step 2: Verify required properties are set
echo [Step 2] Verifying signing properties...

set "PROPS_OK=1"
findstr /R "^RELEASE_STORE_FILE=.*[^^_here]$" "%GRADLE_PROPS%" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] RELEASE_STORE_FILE not configured
    set "PROPS_OK=0"
)

findstr /R "^RELEASE_STORE_PASSWORD=.*[^^_here]$" "%GRADLE_PROPS%" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] RELEASE_STORE_PASSWORD not configured
    set "PROPS_OK=0"
)

findstr /R "^RELEASE_KEY_ALIAS=.*[^^_here]$" "%GRADLE_PROPS%" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] RELEASE_KEY_ALIAS not configured
    set "PROPS_OK=0"
)

findstr /R "^RELEASE_KEY_PASSWORD=.*[^^_here]$" "%GRADLE_PROPS%" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] RELEASE_KEY_PASSWORD not configured
    set "PROPS_OK=0"
)

if "%PROPS_OK%"=="0" (
    echo.
    echo [ERROR] Required signing properties not configured
    echo.
    echo Edit %GRADLE_PROPS% and replace placeholder values with your actual keystore details.
    echo.
    exit /b 1
)

echo [OK] All signing properties configured
echo.

REM Step 3: Clean previous build
echo [Step 3] Cleaning previous build...
cd "%ANDROID_DIR%"
call gradlew.bat clean >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Clean failed, continuing anyway...
) else (
    echo [OK] Clean successful
)
echo.

REM Step 4: Build release AAB
echo [Step 4] Building release AAB...
echo This may take a few minutes...
echo.

call gradlew.bat bundleRelease
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed
    echo.
    echo Common issues:
    echo   - Incorrect keystore password or path
    echo   - Missing dependencies
    echo   - Compilation errors in code
    echo.
    echo Check the error messages above for details.
    cd ..
    exit /b 1
)

echo.
echo [OK] Build successful
echo.

REM Go back to project root
cd ..

REM Step 5: Verify AAB exists
echo [Step 5] Verifying AAB output...
if not exist "%AAB_OUTPUT%" (
    echo [ERROR] AAB file not found at expected location
    echo Expected: %AAB_OUTPUT%
    exit /b 1
)

echo [OK] AAB file generated
echo.

REM Step 6: Display AAB information
echo ========================================
echo   AAB Information
echo ========================================
echo.
echo Location: %AAB_OUTPUT%

REM Get file size
for %%A in ("%AAB_OUTPUT%") do set "FILE_SIZE=%%~zA"
set /a SIZE_MB=!FILE_SIZE! / 1048576
set /a SIZE_KB=!FILE_SIZE! / 1024

if !SIZE_MB! GTR 0 (
    echo Size: !SIZE_MB! MB ^(!FILE_SIZE! bytes^)
) else (
    echo Size: !SIZE_KB! KB ^(!FILE_SIZE! bytes^)
)
echo.

REM Step 7: Run bundletool validation (if available)
echo [Step 6] Validating AAB with bundletool...

where bundletool >nul 2>&1
if errorlevel 1 (
    if exist "bundletool.jar" (
        echo Running validation...
        java -jar bundletool.jar validate --bundle="%AAB_OUTPUT%"
        if errorlevel 1 (
            echo [ERROR] AAB validation failed
            echo The AAB file may have issues. Review the errors above.
            exit /b 1
        )
        echo [OK] AAB validation passed
    ) else (
        echo [WARNING] bundletool not found - skipping validation
        echo.
        echo To install bundletool for validation:
        echo   1. Download from: https://github.com/google/bundletool/releases
        echo   2. Add to PATH or place bundletool.jar in project root
        echo.
        echo Validation is recommended but not required for upload.
    )
) else (
    echo Running validation...
    bundletool validate --bundle="%AAB_OUTPUT%"
    if errorlevel 1 (
        echo [ERROR] AAB validation failed
        echo The AAB file may have issues. Review the errors above.
        exit /b 1
    )
    echo [OK] AAB validation passed
)
echo.

REM Success summary
echo ========================================
echo   Release build complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Test the AAB on a device ^(optional^):
echo    bundletool build-apks --bundle=%AAB_OUTPUT% --output=app.apks
echo    bundletool install-apks --apks=app.apks
echo.
echo 2. Upload to Google Play Console:
echo    - Go to: https://play.google.com/console
echo    - Navigate to: Release ^> Production ^> Create new release
echo    - Upload: %AAB_OUTPUT%
echo.
echo 3. Before uploading, ensure:
echo    - Version code has been incremented in android\app\build.gradle
echo    - Release notes are prepared
echo    - All Play Console requirements are met
echo.
echo ========================================
echo.

endlocal
