const fs = require('fs');
const path = require('path');

// Source and destination paths
const source = path.join(__dirname, '../MapData/curb_ramps.geojson');
const destDir = path.join(__dirname, '../android/app/src/main/assets');
const dest = path.join(destDir, 'curb_ramps.geojson');

try {
  // Create assets directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log('Created assets directory:', destDir);
  }

  // Check if source file exists
  if (!fs.existsSync(source)) {
    console.warn('Warning: Source GeoJSON file not found at:', source);
    console.warn('Skipping GeoJSON file copy. The app will work without obstacle data.');
    process.exit(0); // Exit successfully to not block the build
  }

  // Copy the file
  fs.copyFileSync(source, dest);
  console.log('✓ Copied GeoJSON file to Android assets');
  console.log('  Source:', source);
  console.log('  Destination:', dest);

  // Verify the copy
  const sourceStats = fs.statSync(source);
  const destStats = fs.statSync(dest);
  
  if (sourceStats.size === destStats.size) {
    console.log('✓ File size verified:', Math.round(sourceStats.size / 1024), 'KB');
  } else {
    console.error('Error: File size mismatch after copy');
    process.exit(1);
  }

} catch (error) {
  console.error('Error copying GeoJSON file:', error.message);
  console.warn('The app will work without obstacle data.');
  process.exit(0); // Exit successfully to not block the build
}
