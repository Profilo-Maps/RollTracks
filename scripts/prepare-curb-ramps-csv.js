/**
 * Convert curb ramps GeoJSON to CSV for COPY command
 * Run with: node scripts/prepare-curb-ramps-csv.js > scripts/curb_ramps.csv
 */

const fs = require('fs');
const path = require('path');

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const geojsonPath = path.join(__dirname, '../assets/data/curb_ramps.geojson');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// CSV header
console.log('cnn,location_description,curb_return_loc,position_on_return,condition_score,detectable_surf,location_text,lng,lat');

// CSV rows
geojson.features.forEach(feature => {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  
  const row = [
    escapeCsv(props.CNN),
    escapeCsv(props.LocationDescription),
    escapeCsv(props.curbReturnLoc),
    escapeCsv(props.positionOnReturn),
    escapeCsv(props.conditionScore),
    escapeCsv(props.detectableSurf),
    escapeCsv(props.Location),
    lng,
    lat
  ];
  
  console.log(row.join(','));
});

console.error(`\n✓ Generated CSV with ${geojson.features.length} records`);
