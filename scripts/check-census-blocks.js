/**
 * Check Census Blocks
 * 
 * Diagnostic script to check if census block geometries are actually different
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = (match[2] || '').trim();
    value = value.replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get first 5 blocks
  const { data, error } = await supabase
    .from('census_blocks')
    .select('geoid20, name20, geom')
    .limit(5);

  if (error) {
    console.error('Error fetching blocks:', error);
    process.exit(1);
  }

  console.log(`\nFetched ${data.length} blocks:\n`);
  
  data.forEach((block, i) => {
    const geomStr = JSON.stringify(block.geom);
    console.log(`Block ${i + 1}:`);
    console.log(`  GEOID: ${block.geoid20}`);
    console.log(`  Name: ${block.name20}`);
    console.log(`  Geometry (first 100 chars): ${geomStr.substring(0, 100)}...`);
    console.log(`  Geometry length: ${geomStr.length} chars`);
    console.log('');
  });

  // Check if all geometries are identical
  const geoms = data.map(b => JSON.stringify(b.geom));
  const uniqueGeoms = new Set(geoms);
  
  console.log(`Unique geometries: ${uniqueGeoms.size} out of ${data.length}`);
  
  if (uniqueGeoms.size === 1) {
    console.log('\n⚠️  WARNING: All geometries are identical! This is the problem.');
  } else {
    console.log('\n✓ Geometries are different (as expected)');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
