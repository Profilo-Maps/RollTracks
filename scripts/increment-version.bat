@echo off
REM Android Version Increment Script (Windows)
REM This script increments versionCode and updates versionName in build.gradle

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Android Version Increment Tool
echo ========================================
echo.

REM Project paths
set "BUILD_GRADLE=android\app\build.gradle"

REM Verify build.gradle exists
if not exist "%BUILD_GRADLE%" (
    echo [ERROR] build.gradle not found at %BUILD_GRADLE%
    exit /b 1
)

REM Extract current versionCode
echo [Step 1] Reading current version information...
for /f "tokens=2" %%a in ('findstr /R "versionCode" "%BUILD_GRADLE%"') do (
    set "CURRENT_VERSION_CODE=%%a"
)

REM Extract current versionName (remove quotes)
for /f "tokens=2 delims=^" %%a in ('findstr /R "versionName" "%BUILD_GRADLE%"') do (
    set "TEMP_VERSION=%%a"
    set "CURRENT_VERSION_NAME=!TEMP_VERSION:~1,-1!"
)

if not defined CURRENT_VERSION_CODE (
    echo [ERROR] Could not find versionCode in %BUILD_GRADLE%
    exit /b 1
)

if not defined CURRENT_VERSION_NAME (
    echo [ERROR] Could not find versionName in %BUILD_GRADLE%
    exit /b 1
)

echo.
echo Current version information:
echo ========================================
echo   versionCode: %CURRENT_VERSION_CODE%
echo   versionName: %CURRENT_VERSION_NAME%
echo ========================================
echo.

REM Calculate new versionCode
set /a NEW_VERSION_CODE=%CURRENT_VERSION_CODE% + 1

echo [OK] versionCode will be incremented to: %NEW_VERSION_CODE%
echo.

REM Prompt for versionName update
echo ========================================
echo   Version Name Update
echo ========================================
echo.
echo Semantic versioning format: MAJOR.MINOR.PATCH
echo.
echo   MAJOR: Incompatible API changes
echo   MINOR: Add functionality (backward compatible)
echo   PATCH: Bug fixes (backward compatible)
echo.
echo Current versionName: %CURRENT_VERSION_NAME%
echo.

REM Parse current version for suggestions
for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT_VERSION_NAME%") do (
    set "MAJOR=%%a"
    set "MINOR=%%b"
    set "PATCH=%%c"
)

REM Remove any suffix from PATCH (e.g., "0-beta" -> "0")
for /f "tokens=1 delims=-" %%a in ("%PATCH%") do set "PATCH=%%a"

REM Calculate suggestions
set /a SUGGESTED_PATCH_NUM=%PATCH% + 1
set "SUGGESTED_PATCH=%MAJOR%.%MINOR%.%SUGGESTED_PATCH_NUM%"

set /a SUGGESTED_MINOR_NUM=%MINOR% + 1
set "SUGGESTED_MINOR=%MAJOR%.%SUGGESTED_MINOR_NUM%.0"

set /a SUGGESTED_MAJOR_NUM=%MAJOR% + 1
set "SUGGESTED_MAJOR=%SUGGESTED_MAJOR_NUM%.0.0"

echo Suggestions:
echo   [1] Patch release (bug fixes):     %SUGGESTED_PATCH%
echo   [2] Minor release (new features):  %SUGGESTED_MINOR%
echo   [3] Major release (breaking):      %SUGGESTED_MAJOR%
echo   [4] Custom version
echo   [5] Keep current version
echo.

set /p "OPTION=Select option [1-5]: "

if "%OPTION%"=="1" (
    set "NEW_VERSION_NAME=%SUGGESTED_PATCH%"
) else if "%OPTION%"=="2" (
    set "NEW_VERSION_NAME=%SUGGESTED_MINOR%"
) else if "%OPTION%"=="3" (
    set "NEW_VERSION_NAME=%SUGGESTED_MAJOR%"
) else if "%OPTION%"=="4" (
    set /p "NEW_VERSION_NAME=Enter custom version (e.g., 1.2.3): "
) else if "%OPTION%"=="5" (
    set "NEW_VERSION_NAME=%CURRENT_VERSION_NAME%"
) else (
    echo [ERROR] Invalid option
    exit /b 1
)

REM Basic validation for semantic versioning (check for two dots)
echo %NEW_VERSION_NAME% | findstr /R "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9]" >nul
if errorlevel 1 (
    echo.
    echo [ERROR] Invalid semantic versioning format
    echo.
    echo Version must follow format: MAJOR.MINOR.PATCH
    echo Examples: 1.0.0, 2.1.3, 1.0.0-beta
    echo.
    exit /b 1
)

echo.
echo [OK] versionName will be updated to: %NEW_VERSION_NAME%
echo.

REM Confirm changes
echo ========================================
echo   Summary of changes:
echo ========================================
echo.
echo   versionCode: %CURRENT_VERSION_CODE% -^> %NEW_VERSION_CODE%
echo   versionName: %CURRENT_VERSION_NAME% -^> %NEW_VERSION_NAME%
echo.
echo File to be modified: %BUILD_GRADLE%
echo.

set /p "CONFIRM=Apply these changes? [y/N]: "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo [CANCELLED] Changes cancelled
    exit /b 0
)

REM Create backup
set "BACKUP_FILE=%BUILD_GRADLE%.backup.%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "BACKUP_FILE=%BACKUP_FILE: =0%"
copy "%BUILD_GRADLE%" "%BACKUP_FILE%" >nul
echo.
echo [OK] Backup created: %BACKUP_FILE%

REM Create temporary file for modifications
set "TEMP_FILE=%BUILD_GRADLE%.tmp"

REM Update versionCode and versionName
(
    for /f "delims=" %%a in ('type "%BUILD_GRADLE%"') do (
        set "LINE=%%a"
        echo !LINE! | findstr /R "versionCode" >nul
        if not errorlevel 1 (
            echo !LINE! | findstr /R "versionName" >nul
            if errorlevel 1 (
                REM This is versionCode line
                echo         versionCode %NEW_VERSION_CODE%
            ) else (
                REM This is versionName line
                echo         versionName "%NEW_VERSION_NAME%"
            )
        ) else (
            echo !LINE! | findstr /R "versionName" >nul
            if not errorlevel 1 (
                REM This is versionName line
                echo         versionName "%NEW_VERSION_NAME%"
            ) else (
                echo !LINE!
            )
        )
    )
) > "%TEMP_FILE%"

REM Replace original file with modified version
move /y "%TEMP_FILE%" "%BUILD_GRADLE%" >nul

echo [OK] versionCode updated to %NEW_VERSION_CODE%
echo [OK] versionName updated to %NEW_VERSION_NAME%
echo.

echo ========================================
echo   Version updated successfully!
echo ========================================
echo.

REM Verify changes
echo [Verification]
echo.

for /f "tokens=2" %%a in ('findstr /R "versionCode" "%BUILD_GRADLE%"') do (
    set "VERIFY_VERSION_CODE=%%a"
)

for /f "tokens=2 delims=^" %%a in ('findstr /R "versionName" "%BUILD_GRADLE%"') do (
    set "TEMP_VERSION=%%a"
    set "VERIFY_VERSION_NAME=!TEMP_VERSION:~1,-1!"
)

echo   versionCode: %VERIFY_VERSION_CODE%
echo   versionName: %VERIFY_VERSION_NAME%
echo.

if "%VERIFY_VERSION_CODE%"=="%NEW_VERSION_CODE%" (
    if "%VERIFY_VERSION_NAME%"=="%NEW_VERSION_NAME%" (
        echo [OK] Changes verified successfully
    ) else (
        echo [WARNING] versionName verification failed
    )
) else (
    echo [WARNING] versionCode verification failed
)

echo.
echo ========================================
echo   Next steps:
echo ========================================
echo.
echo 1. Review the changes in %BUILD_GRADLE%
echo.
echo 2. Commit the version change:
echo    git add %BUILD_GRADLE%
echo    git commit -m "Bump version to %NEW_VERSION_NAME% (versionCode %NEW_VERSION_CODE%)"
echo.
echo 3. Build the release:
echo    scripts\build-release.bat
echo.
echo 4. If you need to revert:
echo    copy %BACKUP_FILE% %BUILD_GRADLE%
echo.
echo ========================================
echo.

endlocal
