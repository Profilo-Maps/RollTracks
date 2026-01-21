@echo off
REM Mapbox Proxy Deployment Script for Windows
REM This script deploys the Mapbox proxy infrastructure to Supabase

echo.
echo Deploying Mapbox Proxy to Supabase...
echo.

REM Check if Supabase CLI is available via npx
npx supabase --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Supabase CLI is not available
    echo Install it with: npm install --save-dev supabase
    pause
    exit /b 1
)

echo [OK] Supabase CLI found

REM Check if we're in a Supabase project
if not exist "supabase\config.toml" (
    echo [ERROR] Not in a Supabase project directory
    echo Run this script from your project root
    pause
    exit /b 1
)

echo [OK] Supabase project detected
echo.

REM Step 1: Apply database migration
echo Step 1: Applying database migration...
call npx supabase db push
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database migration failed
    pause
    exit /b 1
)
echo [OK] Database migration applied successfully
echo.

REM Step 2: Set Mapbox token
echo Step 2: Setting Mapbox token as Supabase secret...
set MAPBOX_TOKEN=pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA

call npx supabase secrets set MAPBOX_ACCESS_TOKEN=%MAPBOX_TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to set Mapbox token
    pause
    exit /b 1
)
echo [OK] Mapbox token set successfully
echo.

REM Step 3: Deploy Edge Function
echo Step 3: Deploying Edge Function...
call npx supabase functions deploy mapbox-tiles
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Edge Function deployment failed
    pause
    exit /b 1
)
echo [OK] Edge Function deployed successfully
echo.

REM Step 4: Verify deployment
echo Step 4: Verifying deployment...
echo.
echo Checking secrets...
call npx supabase secrets list
echo.

echo [SUCCESS] Deployment complete!
echo.
echo Next steps:
echo 1. Test the Edge Function with a sample request
echo 2. Integrate MapboxProxyService in your mobile app
echo 3. Update MapView component to use the proxy
echo.
echo See supabase\MAPBOX_DEPLOYMENT.md for more details
echo.
pause
