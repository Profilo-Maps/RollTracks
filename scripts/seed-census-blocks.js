/**
 * Seed Census Blocks
 *
 * Loads census block polygons from assets/data/Blocks.geojson into the
 * census_blocks Supabase table. These blocks are used by the Tier 1 Level 1
 * anonymization trigger to clip trip origins and destinations.
 *
 * Usage:
 *   node scripts/seed-census-blocks.js
 *
 * Environment:
 *   Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from .env
 *   The anon key is sufficient because the batch_insert_census_blocks RPC
 *   function is SECURITY DEFINER and bypasses RLS.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
    // Strip surrounding quotes
    value = value.replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ── Process Features ───────────────────────────────────────

async function processFeatures(supabase, geojsonPath, failedBlocks = []) {
  const BATCH_SIZE = 100;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalProcessed = 0;
  let newFailedBlocks = [];
  
  let batch = [];
  let inFeatures = false;
  let featureBuffer = '';
  let braceDepth = 0;

  const fileStream = fs.createReadStream(geojsonPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    // Look for the features array
    if (line.includes('"features"')) {
      inFeatures = true;
      continue;
    }

    if (!inFeatures) continue;

    // Track brace depth to identify complete feature objects
    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
      
      featureBuffer += char;

      // When we close a feature object at depth 0, we have a complete feature
      if (braceDepth === 0 && featureBuffer.trim().length > 0) {
        try {
          // Clean up the buffer (remove trailing commas)
          const cleanBuffer = featureBuffer.trim().replace(/,$/, '');
          if (cleanBuffer.startsWith('{')) {
            const feature = JSON.parse(cleanBuffer);
            
            batch.push({
              geoid20: feature.properties.GEOID20,
              name20: feature.properties.NAME20 || null,
              geojson: JSON.stringify(feature.geometry),
            });

            totalProcessed++;

            // Process batch when full
            if (batch.length >= BATCH_SIZE) {
              const result = await processBatch(supabase, batch);
              totalInserted += result.inserted;
              totalSkipped += result.skipped;
              totalErrors += result.errors;
              
              if (result.failed.length > 0) {
                newFailedBlocks.push(...result.failed);
              }

              process.stdout.write(
                `\r  Progress: ${totalProcessed} features ` +
                  `(inserted: ${totalInserted}, skipped: ${totalSkipped}, errors: ${totalErrors})`
              );

              batch = [];
            }
          }
        } catch (e) {
          // Skip malformed features
        }
        featureBuffer = '';
      }
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const result = await processBatch(supabase, batch);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
    
    if (result.failed.length > 0) {
      newFailedBlocks.push(...result.failed);
    }
  }

  return {
    totalInserted,
    totalSkipped,
    totalErrors,
    totalProcessed,
    failedBlocks: newFailedBlocks
  };
}

// ── Process Single Batch ───────────────────────────────────

async function processBatch(supabase, batch) {
  let success = false;
  let retries = 3;
  
  while (!success && retries > 0) {
    const { data, error } = await supabase.rpc('batch_insert_census_blocks', {
      p_blocks: batch,
    });

    if (error) {
      // Check if it's a network error that we should retry
      if (error.message.includes('fetch failed') && retries > 1) {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        continue;
      }
      
      // Failed after retries - save these blocks for later retry
      return {
        inserted: 0,
        skipped: 0,
        errors: batch.length,
        failed: batch
      };
    } else {
      const inserted = data || 0;
      const skipped = batch.length - inserted;
      return {
        inserted,
        skipped,
        errors: 0,
        failed: []
      };
    }
  }
  
  // Shouldn't reach here, but just in case
  return {
    inserted: 0,
    skipped: 0,
    errors: batch.length,
    failed: batch
  };
}

// ── Retry Failed Blocks ────────────────────────────────────

async function retryFailedBlocks(supabase, failedBlocks, attemptNumber) {
  if (failedBlocks.length === 0) {
    return { inserted: 0, skipped: 0, errors: 0, failedBlocks: [] };
  }

  console.log(`\n\nRetry attempt ${attemptNumber}: Processing ${failedBlocks.length} failed blocks...`);
  
  const BATCH_SIZE = 100;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let newFailedBlocks = [];

  for (let i = 0; i < failedBlocks.length; i += BATCH_SIZE) {
    const batch = failedBlocks.slice(i, i + BATCH_SIZE);
    const result = await processBatch(supabase, batch);
    
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
    
    if (result.failed.length > 0) {
      newFailedBlocks.push(...result.failed);
    }

    process.stdout.write(
      `\r  Progress: ${Math.min(i + BATCH_SIZE, failedBlocks.length)}/${failedBlocks.length} ` +
        `(inserted: ${totalInserted}, skipped: ${totalSkipped}, errors: ${totalErrors})`
    );
  }

  return {
    totalInserted,
    totalSkipped,
    totalErrors,
    failedBlocks: newFailedBlocks
  };
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

  // Read GeoJSON
  const geojsonPath = path.resolve(
    __dirname,
    '..',
    'assets',
    'data',
    'Blocks.geojson'
  );

  if (!fs.existsSync(geojsonPath)) {
    console.error(`File not found: ${geojsonPath}`);
    process.exit(1);
  }

  console.log(`Streaming ${geojsonPath}...`);
  
  // First pass through the file
  let result = await processFeatures(supabase, geojsonPath);
  let totalInserted = result.totalInserted;
  let totalSkipped = result.totalSkipped;
  let totalErrors = result.totalErrors;
  let failedBlocks = result.failedBlocks;

  // Retry failed blocks up to 2 times
  const MAX_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RETRIES && failedBlocks.length > 0; attempt++) {
    const retryResult = await retryFailedBlocks(supabase, failedBlocks, attempt);
    totalInserted += retryResult.totalInserted;
    totalSkipped += retryResult.totalSkipped;
    totalErrors = retryResult.totalErrors; // Use the latest error count
    failedBlocks = retryResult.failedBlocks;
  }

  console.log('\n');
  console.log('Seeding complete.');
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped (duplicates): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  
  if (failedBlocks.length > 0) {
    console.log(`\n⚠️  Warning: ${failedBlocks.length} blocks failed after ${MAX_RETRIES} retry attempts`);
  }

  // Verify count
  const { count, error: countError } = await supabase
    .from('census_blocks')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\n  Total census blocks in database: ${count}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
