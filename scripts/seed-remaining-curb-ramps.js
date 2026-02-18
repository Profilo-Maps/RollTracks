/**
 * Seed remaining curb ramps using batch SQL via console output
 * This generates SQL that can be executed via Supabase MCP
 * Run with: node scripts/seed-remaining-curb-ramps.js
 */

const fs = require('fs');
const path = require('path');

function escapeSql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

const geojsonPath = path.join(__dirname, '../assets/data/curb_ramps.geojson');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// Skip first 16405 records (already inserted)
const SKIP = 16405;
const remaining = geojson.features.slice(SKIP);

console.error(`Generating SQL for ${remaining.length} remaining curb ramps (skipping first ${SKIP})...`);

// Generate in batches of 500
const BATCH_SIZE = 500;
const batches = Math.ceil(remaining.length / BATCH_SIZE);

for (let b = 0; b < batches; b++) {
  const start = b * BATCH_SIZE;
  const end = Math.min(start + BATCH_SIZE, remaining.length);
  const batch = remaining.slice(start, end);
  
  const values = batch.map(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties;
    
    return `  (${escapeSql(props.CNN)}, ${escapeSql(props.LocationDescription)}, ${escapeSql(props.curbReturnLoc)}, ${escapeSql(props.positionOnReturn)}, ${escapeSql(props.conditionScore)}, ${escapeSql(props.detectableSurf)}, ${escapeSql(props.Location)}, ST_GeogFromText('POINT(${lng} ${lat})'))`;
  });
  
  console.log(`-- Batch ${b + 1}/${batches}: Records ${SKIP + start + 1} to ${SKIP + end}`);
  console.log('INSERT INTO curb_ramps (cnn, location_description, curb_return_loc, position_on_return, condition_score, detectable_surf, location_text, geometry) VALUES');
  console.log(values.join(',\n'));
  console.log(';\n');
}

console.error(`\n✓ Generated ${batches} SQL batches for remaining records`);
