#!/usr/bin/env node

/**
 * Import Validation Script
 * 
 * Scans all TypeScript/JavaScript files for import statements and verifies
 * that each imported path exists in the file system.
 */

const fs = require('fs');
const path = require('path');

// Directories to scan
const SCAN_DIRS = ['src', 'App.tsx', '__tests__'];

// File extensions to check
const VALID_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Patterns to ignore
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /android/,
  /ios/,
  /coverage/,
  /\.bundle/,
];

// Track results
const results = {
  filesScanned: 0,
  importsChecked: 0,
  brokenImports: [],
};

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Get all files recursively from a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) {
    return arrayOfFiles;
  }

  const stat = fs.statSync(dirPath);
  
  if (stat.isFile()) {
    if (VALID_EXTENSIONS.includes(path.extname(dirPath)) && !shouldIgnore(dirPath)) {
      arrayOfFiles.push(dirPath);
    }
    return arrayOfFiles;
  }

  if (stat.isDirectory() && !shouldIgnore(dirPath)) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
      getAllFiles(path.join(dirPath, file), arrayOfFiles);
    });
  }

  return arrayOfFiles;
}

/**
 * Extract import statements from file content
 */
function extractImports(content) {
  const imports = [];
  
  // Match ES6 imports: import ... from '...'
  const es6ImportRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6ImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match require statements: require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath, fromFile) {
  // Skip external packages (no relative path)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null; // External package, skip validation
  }
  
  const fromDir = path.dirname(fromFile);
  let resolvedPath = path.resolve(fromDir, importPath);
  
  // If path already has extension and exists, return it
  if (path.extname(resolvedPath) && fs.existsSync(resolvedPath)) {
    return resolvedPath;
  }
  
  // Try with various extensions if no extension provided
  if (!path.extname(resolvedPath)) {
    for (const ext of VALID_EXTENSIONS) {
      if (fs.existsSync(resolvedPath + ext)) {
        return resolvedPath + ext;
      }
    }
    
    // Try index files in directory
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      for (const ext of VALID_EXTENSIONS) {
        const indexPath = path.join(resolvedPath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }
  }
  
  return resolvedPath;
}

/**
 * Check if an import path exists
 */
function validateImport(importPath, fromFile) {
  const resolvedPath = resolveImportPath(importPath, fromFile);
  
  // Skip external packages
  if (resolvedPath === null) {
    return true;
  }
  
  // Check if file exists with resolved path
  if (fs.existsSync(resolvedPath)) {
    return true;
  }
  
  return false;
}

/**
 * Validate all imports in a file
 */
function validateFileImports(filePath) {
  results.filesScanned++;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = extractImports(content);
  
  imports.forEach(importPath => {
    results.importsChecked++;
    
    if (!validateImport(importPath, filePath)) {
      results.brokenImports.push({
        file: filePath,
        import: importPath,
      });
    }
  });
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Starting import validation...\n');
  
  // Collect all files to scan
  const allFiles = [];
  SCAN_DIRS.forEach(dir => {
    getAllFiles(dir, allFiles);
  });
  
  console.log(`Found ${allFiles.length} files to scan\n`);
  
  // Validate imports in each file
  allFiles.forEach(file => {
    validateFileImports(file);
  });
  
  // Report results
  console.log('📊 Validation Results:');
  console.log(`   Files scanned: ${results.filesScanned}`);
  console.log(`   Imports checked: ${results.importsChecked}`);
  console.log(`   Broken imports: ${results.brokenImports.length}\n`);
  
  if (results.brokenImports.length > 0) {
    console.log('❌ Broken imports found:\n');
    results.brokenImports.forEach(({ file, import: importPath }) => {
      console.log(`   ${file}`);
      console.log(`   └─ import: "${importPath}"\n`);
    });
    process.exit(1);
  } else {
    console.log('✅ All imports are valid!');
    process.exit(0);
  }
}

main();
