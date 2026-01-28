# Implementation Plan: Android Release Configuration

## Overview

This implementation plan transforms the React Native Android app from using a debug keystore for releases to a production-ready release configuration suitable for Google Play Console uploads. The approach focuses on secure credential management, proper signing configuration, and comprehensive documentation.

## Tasks

- [x] 1. Set up secure credential infrastructure
  - [x] 1.1 Create gradle.properties.example template file
    - Create file in project root with placeholder values for RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD, RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD
    - Add comments explaining each property
    - _Requirements: 2.3_
  
  - [x] 1.2 Update .gitignore to exclude gradle.properties
    - Add gradle.properties entry to .gitignore
    - Verify gradle.properties is not tracked by git
    - _Requirements: 2.2, 7.2_
  
  - [ ]* 1.3 Write unit test for .gitignore configuration
    - Test that gradle.properties entry exists in .gitignore
    - Test that gradle.properties.example is NOT in .gitignore
    - _Requirements: 2.2_

- [x] 2. Configure Gradle signing for release builds
  - [x] 2.1 Update android/app/build.gradle with signing configurations
    - Add signingConfigs block with debug and release configurations
    - Configure release signing to read from gradle.properties
    - Add validation to fail build if properties are missing
    - Add clear error message for missing configuration
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 2.2 Update buildTypes to use signing configurations
    - Configure debug buildType to use debug signing
    - Configure release buildType to use release signing
    - Enable minifyEnabled and shrinkResources for release
    - Configure ProGuard files for release
    - _Requirements: 3.1, 3.2, 5.4, 10.4, 10.5_
  
  - [ ]* 2.3 Write property test for release signing configuration
    - **Property 2: Release Builds Use Production Keystore**
    - **Validates: Requirements 3.1**
  
  - [ ]* 2.4 Write property test for debug signing configuration
    - **Property 3: Debug Builds Use Debug Keystore**
    - **Validates: Requirements 3.2, 10.5**
  
  - [ ]* 2.5 Write property test for credential source consistency
    - **Property 4: Credential Source Consistency**
    - **Validates: Requirements 2.4, 10.3**
  
  - [ ]* 2.6 Write property test for required signing properties validation
    - **Property 10: Required Signing Properties Validation**
    - **Validates: Requirements 3.5**

- [x] 3. Implement version management configuration
  - [x] 3.1 Update versionCode and versionName in build.gradle
    - Set initial versionCode to 1
    - Set initial versionName to "1.0.0"
    - Add comments explaining versioning strategy
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 3.2 Write property test for version configuration validity
    - **Property 5: Version Configuration Validity**
    - **Validates: Requirements 4.1, 4.2, 4.3, 9.4, 9.5**

- [-] 4. Create keystore generation documentation
  - [ ] 4.1 Create docs/RELEASE_SETUP.md with keystore generation instructions
    - Document keytool command with all parameters
    - Explain PKCS12 format, key size, validity period
    - Document recommended keystore location (outside project)
    - Include security best practices
    - Document backup procedures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.3, 7.4, 8.1, 8.2_
  
  - [ ] 4.2 Add gradle.properties setup instructions to RELEASE_SETUP.md
    - Document how to copy gradle.properties.example
    - Explain each property and where to get values
    - Include troubleshooting for common errors
    - _Requirements: 2.1, 2.5, 7.5, 8.3_
  
  - [ ] 4.3 Add release build instructions to RELEASE_SETUP.md
    - Document bundleRelease command
    - Document output location
    - Document bundletool validation command
    - Include version increment checklist
    - _Requirements: 5.1, 5.3, 5.5, 4.4, 8.4_

- [ ] 5. Create Play Console preparation documentation
  - [ ] 5.1 Create docs/PLAY_CONSOLE_CHECKLIST.md
    - List all required assets (icon, screenshots, feature graphic)
    - Document asset specifications (dimensions, formats)
    - Reference privacy policy location (docs/PrivacyPolicy.md)
    - List store listing content requirements
    - Document content rating questionnaire steps
    - Document target audience configuration
    - Include pre-upload checklist
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.5_

- [x] 6. Checkpoint - Verify configuration and documentation
  - Ensure all configuration files are created
  - Verify .gitignore excludes gradle.properties
  - Verify gradle.properties.example has correct structure
  - Verify build.gradle has signing configurations
  - Verify documentation is complete and clear
  - Ask the user if questions arise

- [-] 7. Create helper scripts for release process
  - [ ] 7.1 Create scripts/generate-keystore.sh
    - Script to generate keystore with correct parameters
    - Prompt for keystore details (name, organization, etc.)
    - Validate inputs before generating
    - Output keystore location and next steps
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 7.2 Create scripts/build-release.sh
    - Script to build release AAB
    - Verify gradle.properties exists before building
    - Execute bundleRelease command
    - Run bundletool validation on output
    - Display AAB location and size
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [ ] 7.3 Create scripts/increment-version.sh
    - Script to increment versionCode in build.gradle
    - Prompt for versionName update
    - Validate semantic versioning format
    - Update build.gradle with new versions
    - _Requirements: 4.1, 4.2, 9.4, 9.5_

- [ ] 8. Integration testing and validation
  - [ ]* 8.1 Write property test for keystore generation compliance
    - **Property 1: Keystore Generation Compliance**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 7.1**
  
  - [ ]* 8.2 Write property test for release bundle generation
    - **Property 6: Release Bundle Generation**
    - **Validates: Requirements 5.1, 5.3**
  
  - [ ]* 8.3 Write property test for release bundle signing
    - **Property 7: Release Bundle Signing**
    - **Validates: Requirements 5.2, 3.3**
  
  - [ ]* 8.4 Write property test for code optimization
    - **Property 8: Code Optimization Enabled**
    - **Validates: Requirements 5.4**
  
  - [ ]* 8.5 Write property test for bundle integrity validation
    - **Property 9: Bundle Integrity Validation**
    - **Validates: Requirements 5.5**
  
  - [ ]* 8.6 Create integration test for complete release workflow
    - Test keystore generation script
    - Test gradle.properties setup
    - Test release build script
    - Test version increment script
    - Verify end-to-end release process works
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [x] 9. Final checkpoint - Complete release configuration validation
  - Run all unit tests and property tests
  - Execute complete release workflow manually
  - Verify AAB is generated and signed correctly
  - Verify bundletool validation passes
  - Verify documentation is accurate and complete
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Helper scripts automate repetitive tasks and reduce human error
- Documentation ensures any team member can execute releases
