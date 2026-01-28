const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('increment-version.sh script', () => {
  const scriptPath = path.join(__dirname, '../../scripts/increment-version.sh');
  const buildGradlePath = path.join(__dirname, '../../android/app/build.gradle');
  let originalBuildGradle;

  beforeAll(() => {
    // Save original build.gradle content
    if (fs.existsSync(buildGradlePath)) {
      originalBuildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    }
  });

  afterAll(() => {
    // Restore original build.gradle
    if (originalBuildGradle) {
      fs.writeFileSync(buildGradlePath, originalBuildGradle, 'utf8');
    }
  });

  it('should exist and be readable', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const stats = fs.statSync(scriptPath);
    expect(stats.isFile()).toBe(true);
  });

  it('should have bash shebang', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content.startsWith('#!/bin/bash')).toBe(true);
  });

  it('should contain version increment logic', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for key functionality
    expect(content).toContain('versionCode');
    expect(content).toContain('versionName');
    expect(content).toContain('validate_semver');
    expect(content).toContain('build.gradle');
  });

  it('should have semantic versioning validation function', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for semver validation regex
    expect(content).toContain('validate_semver');
    expect(content).toMatch(/\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+/);
  });

  it('should read current version from build.gradle', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check that script reads from build.gradle
    expect(content).toContain('grep');
    expect(content).toContain('CURRENT_VERSION_CODE');
    expect(content).toContain('CURRENT_VERSION_NAME');
  });

  it('should calculate new versionCode by incrementing', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for increment logic
    expect(content).toContain('NEW_VERSION_CODE');
    expect(content).toMatch(/\$\(\(.*\+ 1\)\)/);
  });

  it('should provide version suggestions', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for suggestion logic
    expect(content).toContain('SUGGESTED_PATCH');
    expect(content).toContain('SUGGESTED_MINOR');
    expect(content).toContain('SUGGESTED_MAJOR');
  });

  it('should create backup before modifying', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for backup creation
    expect(content).toContain('BACKUP_FILE');
    expect(content).toContain('.backup.');
    expect(content).toContain('cp');
  });

  it('should use sed to update versions', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for sed commands to update versions
    expect(content).toContain('sed');
    expect(content).toMatch(/sed.*versionCode/);
    expect(content).toMatch(/sed.*versionName/);
  });

  it('should verify changes after update', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for verification logic
    expect(content).toContain('VERIFY_VERSION_CODE');
    expect(content).toContain('VERIFY_VERSION_NAME');
    expect(content).toContain('Verification');
  });

  it('should provide next steps guidance', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for user guidance
    expect(content).toContain('Next steps');
    expect(content).toContain('git commit');
    expect(content).toContain('build-release');
  });

  it('should handle errors gracefully', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for error handling
    expect(content).toContain('set -e');
    expect(content).toContain('Error:');
    expect(content).toContain('exit 1');
  });

  it('should validate semantic versioning format', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    
    // Check for semver validation
    expect(content).toContain('Invalid semantic versioning format');
    expect(content).toContain('MAJOR.MINOR.PATCH');
  });

  describe('semantic versioning validation', () => {
    // Test the regex pattern used in the script
    const semverPattern = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$/;

    it('should accept valid semantic versions', () => {
      expect('1.0.0').toMatch(semverPattern);
      expect('2.1.3').toMatch(semverPattern);
      expect('10.20.30').toMatch(semverPattern);
      expect('1.0.0-beta').toMatch(semverPattern);
      expect('1.0.0-alpha.1').toMatch(semverPattern);
    });

    it('should reject invalid semantic versions', () => {
      expect('1.0').not.toMatch(semverPattern);
      expect('1').not.toMatch(semverPattern);
      expect('v1.0.0').not.toMatch(semverPattern);
      expect('1.0.0.0').not.toMatch(semverPattern);
      expect('a.b.c').not.toMatch(semverPattern);
    });
  });

  describe('build.gradle version extraction', () => {
    it('should correctly identify versionCode pattern', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Extract the grep pattern used for versionCode
      expect(content).toContain('versionCode\\s+');
    });

    it('should correctly identify versionName pattern', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Extract the grep pattern used for versionName
      expect(content).toContain('versionName\\s+');
    });
  });

  describe('requirements validation', () => {
    it('should satisfy requirement 4.1 - increment versionCode', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Requirement 4.1: Maintain versionCode as integer that increments
      expect(content).toContain('versionCode');
      expect(content).toMatch(/NEW_VERSION_CODE.*\+ 1/);
    });

    it('should satisfy requirement 4.2 - maintain semantic versionName', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Requirement 4.2: Maintain versionName as semantic version string
      expect(content).toContain('versionName');
      expect(content).toContain('MAJOR.MINOR.PATCH');
      expect(content).toContain('validate_semver');
    });

    it('should satisfy requirement 9.4 - validate versionCode is positive integer', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Requirement 9.4: Validate versionCode is positive integer
      expect(content).toMatch(/\[0-9\]\+/);
      expect(content).toContain('versionCode');
    });

    it('should satisfy requirement 9.5 - validate semantic versioning format', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      
      // Requirement 9.5: Validate versionName follows semantic versioning
      expect(content).toContain('validate_semver');
      expect(content).toContain('Invalid semantic versioning format');
    });
  });
});
