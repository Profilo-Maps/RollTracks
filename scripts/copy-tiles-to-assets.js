const fs = require('fs');
const path = require('path');

const SOURCE_PATH = 'C:\\MobilityTripTracker1\\MapData\\sf_tiles';
const DEST_PATH = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'sf_tiles');

console.log('📦 Copying map tiles to Android assets...\n');
console.log(`Source: ${SOURCE_PATH}`);
console.log(`Destination: ${DEST_PATH}\n`);

// Check if source exists
if (!fs.existsSync(SOURCE_PATH)) {
  console.error('❌ Error: Source tiles directory not found!');
  console.error(`   Please ensure tiles exist at: ${SOURCE_PATH}`);
  process.exit(1);
}

// Create destination directory
const assetsDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('✓ Created assets directory');
}

// Function to copy directory recursively
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  // Remove existing tiles if present
  if (fs.existsSync(DEST_PATH)) {
    console.log('🗑️  Removing old tiles...');
    fs.rmSync(DEST_PATH, { recursive: true, force: true });
  }

  // Copy tiles
  console.log('📋 Copying tiles...');
  copyRecursive(SOURCE_PATH, DEST_PATH);

  // Count tiles
  let tileCount = 0;
  function countTiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        countTiles(filePath);
      } else if (file.endsWith('.png')) {
        tileCount++;
      }
    });
  }
  countTiles(DEST_PATH);

  console.log(`\n✅ Success! Copied ${tileCount} tiles to Android assets.`);
  console.log('\n📱 The tiles are now bundled with the app and will be included in the APK.');
  console.log('   You can now build the app with: npm run android\n');

} catch (error) {
  console.error('\n❌ Error copying tiles:', error.message);
  console.error('\nPlease check:');
  console.error('  1. Source path exists and is readable');
  console.error('  2. You have write permissions for the android directory');
  console.error('  3. No files are locked or in use\n');
  process.exit(1);
}
