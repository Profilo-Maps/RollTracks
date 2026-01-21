#!/bin/bash

# Mapbox Proxy Deployment Script
# This script deploys the Mapbox proxy infrastructure to Supabase

set -e

echo "🚀 Deploying Mapbox Proxy to Supabase..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is available via npx
if ! npx supabase --version &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not available${NC}"
    echo "Install it with: npm install --save-dev supabase"
    exit 1
fi

echo -e "${GREEN}✓${NC} Supabase CLI found"

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Not in a Supabase project directory${NC}"
    echo "Run this script from your project root"
    exit 1
fi

echo -e "${GREEN}✓${NC} Supabase project detected"
echo ""

# Step 1: Apply database migration
echo "📦 Step 1: Applying database migration..."
if npx supabase db push; then
    echo -e "${GREEN}✓${NC} Database migration applied successfully"
else
    echo -e "${RED}❌ Database migration failed${NC}"
    exit 1
fi
echo ""

# Step 2: Set Mapbox token
echo "🔐 Step 2: Setting Mapbox token as Supabase secret..."
MAPBOX_TOKEN="pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA"

if npx supabase secrets set MAPBOX_ACCESS_TOKEN="$MAPBOX_TOKEN"; then
    echo -e "${GREEN}✓${NC} Mapbox token set successfully"
else
    echo -e "${RED}❌ Failed to set Mapbox token${NC}"
    exit 1
fi
echo ""

# Step 3: Deploy Edge Function
echo "⚡ Step 3: Deploying Edge Function..."
if npx supabase functions deploy mapbox-tiles; then
    echo -e "${GREEN}✓${NC} Edge Function deployed successfully"
else
    echo -e "${RED}❌ Edge Function deployment failed${NC}"
    exit 1
fi
echo ""

# Step 4: Verify deployment
echo "🔍 Step 4: Verifying deployment..."
echo ""
echo "Checking secrets..."
npx supabase secrets list
echo ""

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the Edge Function with a sample request"
echo "2. Integrate MapboxProxyService in your mobile app"
echo "3. Update MapView component to use the proxy"
echo ""
echo "For testing, use:"
echo "  curl -X POST 'https://your-project.supabase.co/functions/v1/mapbox-tiles' \\"
echo "    -H 'Authorization: Bearer YOUR_JWT' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"z\":10,\"x\":163,\"y\":395}'"
echo ""
echo "See supabase/MAPBOX_DEPLOYMENT.md for more details"
