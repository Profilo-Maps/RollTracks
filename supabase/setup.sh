#!/bin/bash

# Supabase Database Setup Script
# This script helps apply database migrations to your Supabase project

set -e

echo "🚀 Mobility Trip Tracker - Supabase Setup"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and fill in your Supabase credentials."
    exit 1
fi

# Source the .env file
source ../.env

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""
echo "📋 Migration files to apply:"
echo "  1. 20240101000000_initial_schema.sql"
echo "  2. 20240101000001_enable_rls.sql"
echo "  3. 20240101000002_storage_setup.sql"
echo ""
echo "⚠️  IMPORTANT: These migrations should be applied manually via the Supabase Dashboard"
echo ""
echo "Steps to apply migrations:"
echo "1. Go to your Supabase project dashboard: ${SUPABASE_URL/https:\/\//https://app.supabase.com/project/}"
echo "2. Navigate to SQL Editor"
echo "3. Copy and paste each migration file content in order"
echo "4. Execute each migration"
echo ""
echo "Alternatively, if you have Supabase CLI installed:"
echo "  supabase link --project-ref <your-project-ref>"
echo "  supabase db push"
echo ""
echo "✨ After applying migrations, your database will have:"
echo "  - profiles table with RLS policies"
echo "  - trips table with RLS policies"
echo "  - trip_uploads table with RLS policies"
echo "  - trip-uploads storage bucket with access policies"
echo ""
