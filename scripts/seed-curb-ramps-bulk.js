/**
 * Seed remaining curb ramps using bulk JSONB function
 * Much faster than individual RPC calls
 * Run with: node scripts/seed-curb-ramps-bulk.js
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

async function seedCurbRampsBulk() {
  const env = loadEnv();
  const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('Loading curb ramps GeoJSON...');
  
  const geojsonPath = path.join(__dirname, '../assets/data/curb_ramps.geojson');
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  
  console.log(`Total features: ${geojson.features.length}`);
  
  // Check current count
  const { count } = await supabase
    .from('curb_ramps')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Currently in database: ${count}`);
  
  if (count >= geojson.features.length) {
    console.log('✓ All curb ramps already seeded!');
    return;
  }
  
  // Skip already inserted records
  const remaining = geojson.features.slice(count);
  console.log(`Seeding ${remaining.length} remaining records using bulk function...`);
  
  // Process in batches of 1000 (JSONB can handle this)
  const BATCH_SIZE = 1000;
  let totalInserted = 0;
  
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    
    // Transform to simple JSON format
    const jsonData = batch.map(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      
      return {
        cnn: props.CNN,
        location_description: props.LocationDescription,
        curb_return_loc: props.curbReturnLoc,
        position_on_return: props.positionOnReturn,
        condition_score: props.conditionScore,
        detectable_surf: props.detectableSurf,
        location_text: props.Location,
        lng,
        lat
      };
    });
    
    try {
      const { data, error } = await supabase.rpc('seed_curb_ramps_bulk', {
        p_data: jsonData
      });
      
      if (error) {
        console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        process.exit(1);
      }
      
      totalInserted += data;
      const progress = (((count + totalInserted) / geojson.features.length) * 100).toFixed(1);
      console.log(`Inserted ${count + totalInserted} / ${geojson.features.length} (${progress}%)...`);
      
    } catch (err) {
      console.error(`Exception in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err);
      process.exit(1);
    }
  }
  
  console.log(`\n✓ Seeded ${totalInserted} new curb ramps!`);
  console.log(`✓ Total in database: ${count + totalInserted}`);
  
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

seedCurbRampsBulk()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
