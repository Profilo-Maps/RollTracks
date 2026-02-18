/**
 * Generate SQL INSERT statements for curb ramps
 * Run with: node scripts/generate-curb-ramps-sql.js
 * Output: Prints first 100 records as sample
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
  // Escape single quotes by doubling them
  return `'${String(value).replace(/'/g, "''")}'`;
}

console.log('Loading curb ramps GeoJSON...');

const geojsonPath = path.join(__dirname, '../assets/data/curb_ramps.geojson');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

console.log(`Found ${geojson.features.length} curb ramps\n`);

// Take first 100 as sample
const sample = geojson.features.slice(0, 100);

console.log('-- Sample: First 100 curb ramps');
console.log('INSERT INTO curb_ramps (cnn, location_description, curb_return_loc, position_on_return, condition_score, detectable_surf, location_text, geometry) VALUES');

const values = sample.map((feature, idx) => {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  
  const row = `  (${escapeSql(props.CNN)}, ${escapeSql(props.LocationDescription)}, ${escapeSql(props.curbReturnLoc)}, ${escapeSql(props.positionOnReturn)}, ${escapeSql(props.conditionScore)}, ${escapeSql(props.detectableSurf)}, ${escapeSql(props.Location)}, ST_GeogFromText('POINT(${lng} ${lat})'))`;
  
  return idx < sample.length - 1 ? row + ',' : row + ';';
});

console.log(values.join('\n'));

console.log(`\n-- Total features in file: ${geojson.features.length}`);
console.log('-- This is a sample of 100 records for testing');
