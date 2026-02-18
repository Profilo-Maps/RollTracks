/**
 * Generate batched SQL for curb ramps seeding
 * This creates smaller SQL files that can be executed via Supabase
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

console.log(`Processing ${geojson.features.length} curb ramps...`);

// Create batches of 1000 records each
const BATCH_SIZE = 1000;
const totalBatches = Math.ceil(geojson.features.length / BATCH_SIZE);

console.log(`Creating ${totalBatches} batch files...`);

for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
  const start = batchNum * BATCH_SIZE;
  const end = Math.min(start + BATCH_SIZE, geojson.features.length);
  const batch = geojson.features.slice(start, end);
  
  const values = batch.map(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties;
    
    return `(${escapeSql(props.CNN)}, ${escapeSql(props.LocationDescription)}, ${escapeSql(props.curbReturnLoc)}, ${escapeSql(props.positionOnReturn)}, ${escapeSql(props.conditionScore)}, ${escapeSql(props.detectableSurf)}, ${escapeSql(props.Location)}, ST_GeogFromText('POINT(${lng} ${lat})'))`;
  });
  
  const sql = `-- Batch ${batchNum + 1} of ${totalBatches} (records ${start + 1} to ${end})
INSERT INTO curb_ramps (cnn, location_description, curb_return_loc, position_on_return, condition_score, detectable_surf, location_text, geometry) 
VALUES ${values.join(',\n')};`;
  
  const filename = `curb_ramps_batch_${String(batchNum + 1).padStart(3, '0')}.sql`;
  fs.writeFileSync(path.join(__dirname, filename), sql);
  
  console.log(`Created ${filename} (${batch.length} records)`);
}

console.log(`\n✓ Generated ${totalBatches} SQL batch files`);
console.log('Execute them in order using Supabase MCP execute_sql tool');
