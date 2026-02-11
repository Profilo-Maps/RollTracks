/**
 * Apply Geometry Fix
 *
 * Updates the census_blocks table to accept MultiPolygon geometries
 * and fixes the batch_insert_census_blocks function.
 *
 * Usage:
 *   node scripts/apply-geometry-fix.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ── Load .env ──────────────────────────────────────────────

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

// ── Main ───────────────────────────────────────────────────

async function main() {
  loadEnv();

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'Missing environment variables.\n' +
        'Ensure .env contains EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Applying geometry type fix...\n');

  // Step 1: Alter column type
  console.log('1. Updating census_blocks.geom column type...');
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE public.census_blocks ALTER COLUMN geom TYPE geometry(GEOMETRY, 4326);'
  });

  if (alterError) {
    console.error('   Error:', alterError.message);
    console.log('\n⚠️  The exec_sql function may not exist. Please run this SQL manually in Supabase SQL Editor:');
    console.log('\n' + fs.readFileSync(path.join(__dirname, 'apply-geometry-fix.sql'), 'utf8'));
    process.exit(1);
  }

  console.log('   ✓ Column type updated');

  // Step 2: Update function
  console.log('2. Updating batch_insert_census_blocks function...');
  const functionSql = `
    CREATE OR REPLACE FUNCTION public.batch_insert_census_blocks(p_blocks JSONB)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      insert_count INTEGER;
    BEGIN
      WITH inserted AS (
        INSERT INTO public.census_blocks (geoid20, name20, geom)
        SELECT
          (block ->> 'geoid20')::VARCHAR(15),
          (block ->> 'name20')::VARCHAR(50),
          ST_SetSRID(ST_GeomFromGeoJSON(block ->> 'geojson')::geometry, 4326)
        FROM jsonb_array_elements(p_blocks) AS block
        ON CONFLICT (geoid20) DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::integer INTO insert_count FROM inserted;
      RETURN insert_count;
    END;
    $$;
  `;

  const { error: funcError } = await supabase.rpc('exec_sql', {
    sql: functionSql
  });

  if (funcError) {
    console.error('   Error:', funcError.message);
    process.exit(1);
  }

  console.log('   ✓ Function updated');
  console.log('\n✅ Geometry fix applied successfully!');
  console.log('\nYou can now run: node scripts/seed-census-blocks.js');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
  console.log('\n' + fs.readFileSync(path.join(__dirname, 'apply-geometry-fix.sql'), 'utf8'));
  process.exit(1);
});
