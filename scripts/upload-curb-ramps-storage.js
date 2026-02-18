/**
 * Upload curb_ramps.geojson to Supabase Storage
 * This makes the file available for DataRanger service to download
 * Run with: node scripts/upload-curb-ramps-storage.js
 */

const fs = require('fs');
const path = require('path');

// Simple .env parser
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  });
  
  return env;
}

async function uploadToStorage() {
  const env = loadEnv();
  const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL in .env file');
    process.exit(1);
  }
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env file');
    console.error('\nThis script requires the service role key to upload files.');
    console.error('Add to your .env file:');
    console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.error('\nFind it in: Supabase Dashboard → Project Settings → API → service_role key');
    console.error('⚠️  WARNING: Keep this key secret! Never commit it to version control.');
    process.exit(1);
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Reading curb_ramps.geojson...');
  
  const geojsonPath = path.join(__dirname, '../assets/data/curb_ramps.geojson');
  const fileBuffer = fs.readFileSync(geojsonPath);
  const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2);
  
  console.log(`File size: ${fileSize} MB`);
  
  // Check if bucket exists
  // Note: We use list() instead of listBuckets() because anon key can't list all buckets
  // but can list files in a public bucket
  console.log('Checking if dataranger-assets bucket exists...');
  const { data: files, error: listError } = await supabase.storage
    .from('dataranger-assets')
    .list('', { limit: 1 });
  
  if (listError) {
    console.error('Error: dataranger-assets bucket does not exist or is not accessible.');
    console.error('The bucket must be created via Supabase Dashboard or with service role key.');
    console.error('\nTo create the bucket:');
    console.error('1. Go to Supabase Dashboard → Storage → New Bucket');
    console.error('2. Name: dataranger-assets');
    console.error('3. Public: Yes');
    console.error('4. File size limit: 50 MB');
    console.error('5. Allowed MIME types: application/json, application/geo+json');
    console.error('\nOr run the migration: 20250212000000_dataranger_assets.sql');
    process.exit(1);
  }
  
  console.log('✓ Bucket exists and is accessible');
  
  // Check if file already exists
  const { data: existingFile } = await supabase.storage
    .from('dataranger-assets')
    .list('', {
      search: 'curb_ramps.geojson'
    });
  
  if (existingFile && existingFile.length > 0) {
    console.log('File already exists, removing old version...');
    const { error: removeError } = await supabase.storage
      .from('dataranger-assets')
      .remove(['curb_ramps.geojson']);
    
    if (removeError) {
      console.warn('Warning: Could not remove old file:', removeError);
    }
  }
  
  // Upload file
  console.log('Uploading curb_ramps.geojson to Supabase Storage...');
  
  const { data, error } = await supabase.storage
    .from('dataranger-assets')
    .upload('curb_ramps.geojson', fileBuffer, {
      contentType: 'application/json',
      upsert: true
    });
  
  if (error) {
    console.error('Error uploading file:', error);
    process.exit(1);
  }
  
  console.log('✓ File uploaded successfully!');
  console.log('Path:', data.path);
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('dataranger-assets')
    .getPublicUrl('curb_ramps.geojson');
  
  console.log('Public URL:', urlData.publicUrl);
  
  // Update asset metadata table
  console.log('\nUpdating asset_metadata table...');
  
  const { error: metadataError } = await supabase
    .from('asset_metadata')
    .upsert({
      asset_name: 'CurbRamps',
      last_updated: new Date().toISOString(),
      file_size_bytes: fileBuffer.length
    }, {
      onConflict: 'asset_name'
    });
  
  if (metadataError) {
    console.warn('Warning: Could not update asset metadata:', metadataError);
  } else {
    console.log('✓ Asset metadata updated');
  }
}

uploadToStorage()
  .then(() => {
    console.log('\n✓ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
