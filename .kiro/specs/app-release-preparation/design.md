# Design Document: App Release Preparation

## Overview

This design outlines the approach for preparing the React Native application for public testing release. The preparation involves three main activities: cleaning up obsolete tests, consolidating and organizing documentation, and adding required legal documentation. The design focuses on maintaining repository integrity while removing unnecessary files and improving organization.

The cleanup will be performed through systematic analysis and file operations, ensuring that all changes preserve the functionality of the application while improving its structure for public release.

## Architecture

### High-Level Approach

The release preparation follows a phased approach:

1. **Analysis Phase**: Identify files to remove, consolidate, or modify
2. **Test Cleanup Phase**: Remove obsolete and redundant tests
3. **Documentation Consolidation Phase**: Organize and merge documentation
4. **Backend Documentation Removal Phase**: Remove infrastructure-specific docs
5. **Privacy Policy Creation Phase**: Add required legal documentation
6. **Verification Phase**: Ensure repository integrity and functionality

### File Organization Structure

**Current State:**
```
/
├── docs/                          # Mixed documentation
├── supabase/                      # Backend setup docs
├── MAPBOX_*.md                    # Scattered root-level docs
├── LAZY_LOADING_*.md              # Scattered root-level docs
├── PHASE_2_*.md                   # Scattered root-level docs
└── src/
    └── **/__tests__/              # Test files throughout
```

**Target State:**
```
/
├── docs/
│   ├── features/                  # Feature documentation
│   ├── architecture/              # Architecture guides
│   ├── testing/                   # Testing guides
│   ├── PrivacyPolicy.md          # Privacy policy
│   └── README.md                  # Documentation index
└── src/
    └── **/__tests__/              # Only active, relevant tests
```

## Components and Interfaces

### Test Analysis Component

**Purpose**: Identify obsolete and redundant tests

**Analysis Criteria**:
- Tests for features that no longer exist
- Duplicate test coverage
- Tests that haven't been updated in sync with code changes
- Tests with broken imports or dependencies

**Process**:
1. Scan all `__tests__` directories
2. Cross-reference with current feature implementations
3. Identify tests that fail or are skipped
4. Flag tests with outdated patterns or dependencies

### Documentation Consolidation Component

**Purpose**: Organize scattered documentation into logical structure

**Consolidation Rules**:
- Group by topic (Mapbox, Lazy Loading, Architecture, etc.)
- Merge duplicate or overlapping content
- Create index/README for navigation
- Update all internal references and links

**File Mapping**:
```
Root Level → Target Location
─────────────────────────────────────────────────────
MAPBOX_*.md → docs/features/mapbox/
LAZY_LOADING_*.md → docs/architecture/lazy-loading/
PHASE_2_*.md → docs/features/ (or remove if obsolete)
docs/Mapbox*.md → docs/features/mapbox/
docs/LazyLoading*.md → docs/architecture/lazy-loading/
```

### Backend Documentation Filter Component

**Purpose**: Identify and remove backend-specific documentation

**Removal Criteria**:
- Supabase deployment guides
- Database migration documentation
- Infrastructure setup procedures
- Backend API implementation details
- Server configuration guides

**Preservation Criteria**:
- Frontend API usage documentation
- Client-side integration guides
- Testing procedures for frontend developers
- User-facing feature documentation

### Privacy Policy Generator Component

**Purpose**: Create comprehensive privacy policy document

**Required Sections**:
1. **Introduction**: Overview of privacy commitment
2. **Data Collection**: What data is collected (location, user preferences, trip history)
3. **Data Usage**: How data is used (app functionality, improvements)
4. **Data Storage**: Where and how data is stored (local device, cloud sync)
5. **Data Sharing**: Third-party services (Mapbox, analytics if any)
6. **User Rights**: Access, deletion, and control over data
7. **Data Retention**: How long data is kept
8. **Security**: Measures to protect user data
9. **Changes to Policy**: How updates are communicated
10. **Contact Information**: How to reach out with privacy concerns

### Repository Integrity Validator Component

**Purpose**: Ensure repository remains functional after cleanup

**Validation Checks**:
- No broken imports in source files
- No broken links in documentation
- All active tests still run
- Application builds successfully
- No orphaned files or directories

## Data Models

### File Classification Model

```typescript
interface FileClassification {
  path: string;
  type: 'test' | 'documentation' | 'code';
  status: 'keep' | 'remove' | 'consolidate' | 'move';
  reason: string;
  targetPath?: string;  // For move/consolidate operations
  mergeWith?: string[]; // For consolidation operations
}
```

### Documentation Structure Model

```typescript
interface DocumentationStructure {
  category: 'features' | 'architecture' | 'testing' | 'legal';
  subcategory?: string;
  files: DocumentFile[];
}

interface DocumentFile {
  originalPath: string;
  targetPath: string;
  action: 'move' | 'merge' | 'create';
  mergeSource?: string[]; // Files to merge into this one
}
```

### Privacy Policy Model

```typescript
interface PrivacyPolicy {
  sections: PrivacySection[];
  lastUpdated: string;
  version: string;
}

interface PrivacySection {
  title: string;
  content: string;
  subsections?: PrivacySection[];
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Documentation Relocation Completeness

*For any* set of documentation files identified in the root directory, after the consolidation operation, all those files should exist within the docs/ folder structure and should not exist in the root directory.

**Validates: Requirements 2.1**

### Property 2: Import Integrity After Cleanup

*For any* file removal or move operation performed during cleanup, scanning the entire codebase should reveal zero import statements or module references that point to non-existent file paths.

**Validates: Requirements 1.3, 5.1**

### Property 3: Link Integrity After Reorganization

*For any* documentation file that is moved or renamed during reorganization, all markdown links in all documentation files that previously pointed to the old location should be updated to point to the new location, resulting in zero broken internal links.

**Validates: Requirements 2.4, 5.2**

## Error Handling

### File Operation Errors

**Scenario**: File cannot be moved or deleted due to permissions or locks

**Handling**:
- Log the specific file and error
- Continue with other operations
- Report all failures at the end
- Provide manual remediation steps

### Broken Reference Detection

**Scenario**: Broken imports or links are detected after operations

**Handling**:
- Halt the cleanup process
- Report all broken references with file locations
- Provide option to rollback changes
- Require manual fix before proceeding

### Build Failure

**Scenario**: Application fails to build after cleanup

**Handling**:
- Immediately report the build error
- Provide rollback mechanism
- Identify which cleanup operation likely caused the failure
- Require manual intervention to fix

### Merge Conflicts

**Scenario**: Documentation consolidation creates conflicting content

**Handling**:
- Preserve both versions with clear markers
- Flag for manual review
- Provide guidance on resolution
- Do not auto-delete conflicting content

## Testing Strategy

This feature involves file system operations and repository cleanup, which are best validated through a combination of automated verification scripts and manual testing.

### Automated Verification

**Import Validation Script**:
- Scan all TypeScript/JavaScript files for import statements
- Verify each imported path exists in the file system
- Report any broken imports with file locations
- Run after each cleanup phase

**Link Validation Script**:
- Parse all markdown files for internal links
- Verify each linked file exists
- Check for broken anchors/headers
- Report all broken links with locations

**Build Verification**:
- Run the application build command
- Verify exit code is 0 (success)
- Check for any build warnings or errors
- Run after all cleanup operations complete

### Manual Testing

**Test Scenarios**:

1. **Test Cleanup Completeness**:
   - Verify obsolete tests are removed
   - Confirm active tests remain
   - Check test suite runs successfully

2. **Test Documentation Organization**:
   - Navigate documentation structure
   - Verify logical grouping
   - Check for duplicate content
   - Confirm backend docs are removed

3. **Test Privacy Policy**:
   - Review all required sections present
   - Verify content accuracy
   - Check language clarity
   - Confirm contact information

4. **Test Application Functionality**:
   - Build and run the application
   - Verify core features work
   - Check for any runtime errors
   - Test on both iOS and Android

### Unit Tests

While this feature is primarily about file operations, we can write unit tests for specific validation functions:

- Test import path validation logic
- Test markdown link parsing and validation
- Test file path transformation logic
- Test documentation structure validation

### Integration Testing

- Run full cleanup process on a test branch
- Verify all validation scripts pass
- Build and run application
- Manually review changes
- Confirm rollback capability works

### Property-Based Testing Considerations

The correctness properties defined above (import integrity, link integrity, documentation relocation) should be validated through:

- **Automated scripts** that check these properties after each operation
- **Pre-commit hooks** that prevent committing broken references
- **CI/CD validation** that runs these checks on every commit

These are not traditional property-based tests with random input generation, but rather invariant checks that must hold true after the cleanup operations are performed.
