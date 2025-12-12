const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('copy-geojson-to-assets script', () => {
  const scriptPath = path.join(__dirname, '../../scripts/copy-geojson-to-assets.js');
  const destDir = path.join(__dirname, '../../android/app/src/main/assets');
  const destFile = path.join(destDir, 'curb_ramps.geojson');
  const sourceFile = path.join(__dirname, '../../MapData/curb_ramps.geojson');

  beforeEach(() => {
    // Clean up destination file if it exists
    if (fs.existsSync(destFile)) {
      fs.unlinkSync(destFile);
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(destFile)) {
      fs.unlinkSync(destFile);
    }
  });

  it('should create assets directory if it does not exist', () => {
    // Remove assets directory if it exists
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    // Run the script (will exit 0 even if source doesn't exist)
    try {
      execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    } catch (error) {
      // Script may exit with warning if source file doesn't exist
    }

    // Check that directory was created
    expect(fs.existsSync(destDir)).toBe(true);
  });

  it('should copy file correctly when source exists', () => {
    // Skip if source file doesn't exist
    if (!fs.existsSync(sourceFile)) {
      console.log('Skipping test: source file not found');
      return;
    }

    // Run the script
    execSync(`node ${scriptPath}`, { stdio: 'pipe' });

    // Verify destination file exists
    expect(fs.existsSync(destFile)).toBe(true);

    // Verify file sizes match
    const sourceStats = fs.statSync(sourceFile);
    const destStats = fs.statSync(destFile);
    expect(destStats.size).toBe(sourceStats.size);
  });

  it('should handle missing source file gracefully', () => {
    // Temporarily rename source file if it exists
    const tempSource = sourceFile + '.temp';
    let sourceExisted = false;

    if (fs.existsSync(sourceFile)) {
      fs.renameSync(sourceFile, tempSource);
      sourceExisted = true;
    }

    try {
      // Run the script - should exit successfully even without source
      const result = execSync(`node ${scriptPath}`, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      const output = result.toString();

      // Should exit successfully (exit code 0)
      expect(output).toBeDefined();
    } catch (error) {
      // If it throws, check that it's not a real error (exit code should be 0)
      fail('Script should exit successfully even without source file');
    } finally {
      // Restore source file if it existed
      if (sourceExisted && fs.existsSync(tempSource)) {
        fs.renameSync(tempSource, sourceFile);
      }
    }
  });

  it('should verify file size after copy', () => {
    // Skip if source file doesn't exist
    if (!fs.existsSync(sourceFile)) {
      console.log('Skipping test: source file not found');
      return;
    }

    // Run the script
    const result = execSync(`node ${scriptPath}`, { stdio: 'pipe' });
    const output = result.toString();

    // Should contain verification message
    expect(output).toContain('File size verified');
  });
});
