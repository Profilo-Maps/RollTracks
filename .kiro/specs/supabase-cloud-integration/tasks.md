# Implementation Plan

- [x] 1. Set up environment and database schema

  - [x] 1.1 Update .env.example with Supabase credentials placeholders


    - Add SUPABASE_URL and SUPABASE_ANON_KEY placeholders
    - Document that .env should never be committed
    - _Requirements: 2.3_

  - [x] 1.2 Create actual .env file with real credentials


    - Add the provided Supabase URL: https://vavqokubsuaiaaqmizso.supabase.co
    - Add the provided Anon Key (not publishable key - clarify with user)
    - Verify .env is in .gitignore
    - _Requirements: 2.1, 2.3_

  - [x] 1.3 Create database migration files for Supabase


    - Create migration for user_accounts table with display_name and password_hash
    - Create migration for updated profiles table with mode_list
    - Create migration for updated trips table with new fields (mode, boldness, purpose, distance_miles, synced_at)
    - Create migration for rated_features table
    - Create migration for trip_uploads table with user_id
    - _Requirements: 1.1, 5.3, 6.4, 7.1_

  - [x] 1.4 Create RLS policies migration


    - Enable RLS on all tables
    - Create policies for user_accounts, profiles, trips, trip_uploads, rated_features
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.5 Create storage bucket and policies migration


    - Create trip-files storage bucket (private)
    - Create storage policies for user-based file isolation
    - _Requirements: 6.3, 7.4_

- [x] 2. Implement authentication service

  - [x] 2.1 Create AuthService class with custom authentication


    - Implement register() method with display name uniqueness check
    - Implement login() method with display name and password
    - Implement logout() method
    - Implement getSession() method
    - Implement isDisplayNameAvailable() method
    - Implement deleteAccount() method with cascade deletion
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.2, 8.3_

  - [ ]* 2.2 Write property test for display name uniqueness
    - **Property 1: Display name uniqueness**
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test for UUID assignment
    - **Property 2: UUID assignment**
    - **Validates: Requirements 1.1**

  - [x] 2.4 Update AuthContext to use new AuthService


    - Replace existing auth logic with AuthService
    - Handle session persistence in AsyncStorage
    - Implement automatic token refresh
    - _Requirements: 1.4, 1.5_

  - [ ]* 2.5 Write unit tests for authentication edge cases
    - Test empty display name rejection
    - Test password minimum length enforcement
    - Test duplicate display name rejection
    - Test session expiration handling
    - _Requirements: 1.2, 1.3_

- [x] 3. Implement sync service

  - [x] 3.1 Create SyncService class with queue management


    - Implement initialize() method with network listener
    - Implement syncNow() method with batch processing
    - Implement queueForSync() method
    - Implement getSyncStatus() method
    - Implement clearQueue() method for testing
    - Add TODO comment for data retention policy
    - _Requirements: 3.1, 3.2, 3.4, 10.1, 10.2, 10.5_

  - [x] 3.2 Implement sync queue persistence in AsyncStorage

    - Create SyncQueueItem interface
    - Implement queue storage and retrieval
    - Implement retry logic with exponential backoff
    - _Requirements: 3.4, 3.5_

  - [x] 3.3 Implement conflict resolution with local-first strategy


    - Compare timestamps between local and cloud data
    - Prioritize local data when timestamps conflict
    - Update cloud with local version
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 3.4 Write property test for local-first write
    - **Property 3: Local-first write**
    - **Validates: Requirements 3.1**

  - [ ]* 3.5 Write property test for sync queue persistence
    - **Property 4: Sync queue persistence**
    - **Validates: Requirements 3.4**

  - [ ]* 3.6 Write property test for local data precedence
    - **Property 5: Local data precedence**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.7 Write property test for offline operation
    - **Property 11: Offline operation**
    - **Validates: Requirements 2.4**

  - [ ]* 3.8 Write property test for sync retry
    - **Property 12: Sync retry**
    - **Validates: Requirements 3.4**

- [x] 4. Implement file upload service

  - [x] 4.1 Create FileService class


    - Implement uploadFile() method with storage path construction
    - Implement queueFileUpload() method
    - Implement getFileUrl() method
    - Implement deleteFile() method
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 4.2 Integrate FileService with SyncService


    - Add file upload items to sync queue
    - Process file uploads during sync
    - Update trip metadata with file URLs
    - _Requirements: 6.2, 6.4_

  - [ ]* 4.3 Write property test for file path isolation
    - **Property 7: File path isolation**
    - **Validates: Requirements 7.4**

  - [ ]* 4.4 Write unit tests for file upload
    - Test file size validation (max 10MB)
    - Test supported file types (JPEG, PNG, GPX, KML)
    - Test file path construction
    - Test offline queueing
    - _Requirements: 6.5_

- [x] 5. Update storage adapters for cloud sync

  - [x] 5.1 Update LocalStorageAdapter to track sync status


    - Add synced_at field to trip storage
    - Add sync status tracking methods
    - Mark items for sync when modified
    - _Requirements: 3.3, 5.4_

  - [x] 5.2 Create SupabaseStorageAdapter implementing StorageAdapter interface


    - Implement all CRUD operations for profiles
    - Implement all CRUD operations for trips
    - Implement all CRUD operations for rated features
    - Enforce RLS through authenticated client
    - _Requirements: 5.2, 5.3, 7.2_

  - [x] 5.3 Create HybridStorageAdapter that uses both local and cloud


    - Write to local storage first
    - Queue for cloud sync
    - Read from local storage primarily
    - _Requirements: 3.1, 5.5_

  - [ ]* 5.4 Write unit tests for storage adapters
    - Test local storage operations
    - Test cloud storage operations with mock Supabase client
    - Test hybrid adapter coordination
    - _Requirements: 3.1, 5.2_

- [x] 6. Update UI components for authentication


  - [x] 6.1 Create LoginScreen component


    - Display name input field
    - Password input field
    - Login button
    - Register link
    - Error message display
    - _Requirements: 1.5_

  - [x] 6.2 Create RegisterScreen component


    - Display name input with availability check
    - Password input with strength indicator
    - Confirm password field
    - Register button
    - Display name uniqueness validation
    - Privacy warning: "Do not include your name or identifying information in your display name"
    - _Requirements: 1.1, 1.2, 1.3, 9.5_

  - [x] 6.3 Update ProfileScreen with account deletion


    - Add "Delete Account" button
    - Implement confirmation dialog
    - Call AuthService.deleteAccount()
    - Clear local storage on success
    - Navigate to login screen
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 6.4 Write property test for display name isolation
    - **Property 9: Display name isolation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ]* 6.5 Write unit tests for UI components
    - Test form validation
    - Test privacy warning display
    - Test error display
    - Test navigation flows
    - _Requirements: 1.2, 1.3, 8.1, 9.5_

- [x] 7. Integrate sync service with app lifecycle

  - [x] 7.1 Update App.tsx to initialize SyncService


    - Initialize SyncService on app start
    - Set up network listener
    - Trigger sync when app comes to foreground
    - _Requirements: 3.2_

  - [x] 7.2 Add sync status indicator to UI


    - Show sync status in header or footer
    - Display last sync time
    - Show pending items count
    - _Requirements: 3.2, 3.3_

  - [ ]* 7.3 Write integration tests for sync lifecycle
    - Test sync on app start
    - Test sync on network reconnection
    - Test sync on foreground
    - _Requirements: 3.2_

- [x] 8. Implement data migration for existing users

  - [x] 8.1 Create migration utility for existing local data


    - Detect first login after Supabase integration
    - Upload all existing trips to cloud
    - Upload all existing rated features
    - Mark as synced in local storage
    - _Requirements: 5.1, 5.2_

  - [ ]* 8.2 Write unit tests for data migration
    - Test migration detection
    - Test batch upload
    - Test sync status update
    - _Requirements: 5.1_

- [x] 9. Security and environment validation

  - [x] 9.1 Create environment validation utility


    - Check for required environment variables
    - Validate Supabase URL format
    - Validate Anon Key format
    - Fall back to offline mode if missing
    - _Requirements: 2.1, 2.4_

  - [ ]* 9.2 Write property test for environment variable isolation
    - **Property 10: Environment variable isolation**
    - **Validates: Requirements 2.2**

  - [x] 9.3 Verify .env is in .gitignore

    - Check .gitignore contains .env entry
    - Add if missing
    - _Requirements: 2.3_

  - [ ]* 9.4 Write security tests
    - Test RLS policy enforcement (requires test database)
    - Test file storage isolation
    - Test session token encryption
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 10. Documentation and deployment preparation

  - [x] 10.1 Create Supabase setup guide



    - Document how to apply migrations
    - Document how to verify RLS policies
    - Document how to test authentication
    - Document how to access research data from Table Editor
    - _Requirements: 7.1, 9.1_

  - [x] 10.2 Update README with Supabase integration instructions


    - Environment variable setup
    - Database migration steps
    - Authentication flow
    - Offline-first behavior
    - _Requirements: 2.1, 2.3_

  - [x] 10.3 Create troubleshooting guide


    - Common sync issues
    - Authentication problems
    - File upload errors
    - RLS policy debugging
    - _Requirements: 3.4, 7.2_

- [x] 11. Final checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
