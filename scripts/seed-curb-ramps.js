/**
 * Seed curb ramps data from GeoJSON to Supabase
 * Uses SECURITY DEFINER function to bypass RLS
 * Run with: node scripts/seed-curb-ramps.js
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

async function seedCurbRamps() {
  const env = loadEnv();
  const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
  }
  
  // Dynamic import of supabase-js
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('Loading curb ramps GeoJSON...');
  
  const geojsonPath = path.join(__dirname, '../assets/data/curb_ramps.geojson');
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  
  console.log(`Found ${geojson.features.length} curb ramps`);
  
  // Check if data already exists
  const { count } = await supabase
    .from('curb_ramps')
    .select('*', { count: 'exact', head: true });
  
  if (count > 0) {
    console.log(`Table already contains ${count} records. Skipping seed.`);
    console.log('To re-seed, truncate the table first with: DELETE FROM curb_ramps;');
    return;
  }
  
  console.log('Seeding data using SECURITY DEFINER function...');
  
  // Insert using RPC calls to the SECURITY DEFINER function
  let inserted = 0;
  const BATCH_SIZE = 50; // Reduced batch size to avoid network issues
  const MAX_RETRIES = 3;
  
  for (let i = 0; i < geojson.features.length; i += BATCH_SIZE) {
    const batch = geojson.features.slice(i, i + BATCH_SIZE);
    
    let retries = 0;
    let success = false;
    
    while (!success && retries < MAX_RETRIES) {
      try {
        // Execute batch as individual RPC calls in parallel
        const promises = batch.map(feature => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties;
          
          return supabase.rpc('seed_curb_ramp', {
            p_cnn: props.CNN,
            p_location_description: props.LocationDescription,
            p_curb_return_loc: props.curbReturnLoc,
            p_position_on_return: props.positionOnReturn,
            p_condition_score: props.conditionScore,
            p_detectable_surf: props.detectableSurf,
            p_location_text: props.Location,
            p_lng: lng,
            p_lat: lat
          });
        });
        
        const results = await Promise.all(promises);
        
        // Check for errors
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          throw new Error(`Supabase error: ${errors[0].error.message}`);
        }
        
        success = true;
        inserted += batch.length;
        const progress = ((inserted / geojson.features.length) * 100).toFixed(1);
        console.log(`Inserted ${inserted} / ${geojson.features.length} (${progress}%)...`);
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, retrying (${retries}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
        } else {
          console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1} after ${MAX_RETRIES} retries:`, error);
          process.exit(1);
        }
      }
    }
  }
  
  console.log('✓ Curb ramps seeded successfully!');
  
  // Update asset metadata
  const { error: metadataError } = await supabase
    .from('asset_metadata')
    .update({
      last_updated: new Date().toISOString(),
      file_size_bytes: fs.statSync(geojsonPath).size
    })
    .eq('asset_name', 'CurbRamps');
  
  if (metadataError) {
    console.warn('Warning: Could not update asset metadata:', metadataError);
  } else {
    console.log('✓ Asset metadata updated');
  }
}

seedCurbRamps()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
