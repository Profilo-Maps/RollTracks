#!/usr/bin/env node

/**
 * Upload DataRanger Assets to Supabase Storage
 * 
 * This script uploads curb_ramps.geojson and sidewalks.geojson to Supabase Storage
 * and updates the asset_metadata table with version information.
 * 
 * Usage:
 *   node scripts/upload-dataranger-assets.js
 * 
 * Environment variables required:
 *   EXPO_PUBLIC_SUPABASE_URL - Supabase project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY - Supabase anonymous key (for public uploads)
 *   or
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (for admin operations)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET_NAME = 'dataranger-assets';

// Asset files to upload
const ASSETS = [
  {
    name: 'ProximityNetwork',
    localPath: process.env.PROXIMITY_PARQUET_PATH || 'C:/Dev/Proximity/Output/San_Francisco_County_California_USA_network.parquet',
    remotePath: 'San_Francisco_County_California_USA_network.parquet',
    contentType: 'application/octet-stream',
    description: 'Proximity graph network parquet — all segment/feature data (streets, sidewalks, bikeways, curb ramps)',
  },
];

async function uploadAssets() {
  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   EXPO_PUBLIC_SUPABASE_URL');
    console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🚀 Starting DataRanger asset upload...\n');

  for (const asset of ASSETS) {
    const fullPath = path.resolve(asset.localPath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${asset.name}: File not found at ${asset.localPath}`);
      continue;
    }

    try {
      // Read file
      const fileBuffer = fs.readFileSync(fullPath);
      const fileSizeBytes = fileBuffer.length;
      const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);

      console.log(`📦 Uploading ${asset.name}...`);
      console.log(`   File: ${asset.localPath}`);
      console.log(`   Size: ${fileSizeMB} MB`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(asset.remotePath, fileBuffer, {
          contentType: asset.contentType || 'application/octet-stream',
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        console.error(`   ❌ Upload failed: ${uploadError.message}`);
        continue;
      }

      console.log(`   ✅ Uploaded to storage: ${asset.remotePath}`);

      // Update asset_metadata table
      const { error: metadataError } = await supabase
        .from('asset_metadata')
        .upsert({
          asset_name: asset.name,
          last_updated: new Date().toISOString(),
          file_size_bytes: fileSizeBytes,
          description: asset.description,
        });

      if (metadataError) {
        console.error(`   ⚠️  Metadata update failed: ${metadataError.message}`);
      } else {
        console.log(`   ✅ Updated metadata table`);
      }

      console.log('');
    } catch (error) {
      console.error(`   ❌ Error processing ${asset.name}:`, error.message);
      console.log('');
    }
  }

  console.log('✨ Upload complete!\n');
  console.log('Next steps:');
  console.log('1. Verify uploads in Supabase Dashboard > Storage > dataranger-assets');
  console.log('2. Check asset_metadata table for version timestamps');
  console.log('3. Test download in app by enabling DataRanger mode\n');
}

// Run the upload
uploadAssets().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
