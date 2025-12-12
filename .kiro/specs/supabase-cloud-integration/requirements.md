# Requirements Document

## Introduction

This document specifies the requirements for integrating Supabase cloud functionality into the Mobility Trip Tracker application. The integration will enable user authentication with display names and passwords, offline-first data synchronization with background sync, secure file uploads, and row-level security to ensure users can only access their own data. The system will use UUIDs for user identification instead of email addresses, and display names will be excluded from final data exports to protect user privacy.

## Glossary

- **Application**: The Mobility Trip Tracker React Native mobile application
- **Supabase Backend**: The Supabase cloud database and authentication service
- **User**: An individual who creates an account and uses the Application
- **Display Name**: A user-chosen identifier for login purposes, not included in data exports
- **UUID**: Universally Unique Identifier used for user identification
- **Trip**: A recorded journey with route data, timestamps, and associated metadata
- **Route Data**: Geographic and temporal information about a user's trip
- **Local Storage**: Device-based data storage using AsyncStorage
- **Cloud Storage**: Supabase-hosted database and file storage
- **Background Sync**: Automatic data synchronization that occurs when the Application detects network connectivity
- **Row Level Security (RLS)**: Database-level security policies that restrict data access based on user identity
- **Anon Key**: Supabase anonymous/public API key used for client-side requests
- **Environment Variables**: Configuration values stored in .env file
- **Sync Queue**: A local queue of pending operations to be synchronized with the cloud
- **Conflict Resolution**: The process of determining which data version to keep when local and cloud data differ

## Requirements

### Requirement 1

**User Story:** As a user, I want to create an account with a display name and password, so that I can securely access my trip data from multiple devices.

#### Acceptance Criteria

1. WHEN a user provides a display name and password THEN the Application SHALL create a new account with a UUID as the primary identifier
2. WHEN a user provides a display name that already exists THEN the Application SHALL reject the registration and display an error message
3. WHEN a user provides a password THEN the Application SHALL enforce a minimum length of 8 characters
4. WHEN account creation succeeds THEN the Application SHALL store the user session in Local Storage
5. WHERE a user has an existing account WHEN the user provides their display name and password THEN the Application SHALL authenticate the user and establish a session

### Requirement 2

**User Story:** As a developer, I want environment variables to be securely managed, so that sensitive credentials are never exposed in the codebase or frontend.

#### Acceptance Criteria

1. WHEN the Application initializes THEN the Supabase Backend connection SHALL use credentials from environment variables
2. THE Application SHALL NOT include the Supabase publishable key in any frontend code or bundle
3. THE .env file SHALL be listed in .gitignore to prevent credential commits
4. WHEN environment variables are missing THEN the Application SHALL operate in offline-only mode without crashing
5. THE Application SHALL use only the Supabase URL and Anon Key for client-side operations

### Requirement 3

**User Story:** As a user, I want my trip data to be saved locally first and synced to the cloud in the background, so that I can use the app without interruption even when offline.

#### Acceptance Criteria

1. WHEN a user creates or modifies trip data THEN the Application SHALL save the data to Local Storage immediately
2. WHEN the Application detects network connectivity THEN the Application SHALL initiate Background Sync for pending local changes
3. WHEN Background Sync completes successfully THEN the Application SHALL mark the synced data as uploaded in Local Storage
4. WHEN Background Sync fails THEN the Application SHALL retry the sync on the next connectivity event
5. WHILE the Application is offline THEN the Application SHALL queue all data changes in the Sync Queue

### Requirement 4

**User Story:** As a user, I want my locally modified data to take precedence during sync, so that my most recent changes are never overwritten by older cloud data.

#### Acceptance Criteria

1. WHEN Conflict Resolution occurs THEN the Application SHALL prioritize locally cached data over cloud data
2. WHEN local data has a more recent timestamp than cloud data THEN the Application SHALL upload the local version to the Supabase Backend
3. WHEN the Application syncs data THEN the Application SHALL preserve the local modification timestamp
4. WHEN multiple devices modify the same trip THEN the Application SHALL apply last-write-wins based on local timestamps
5. THE Application SHALL NOT overwrite local changes with older cloud data during sync

### Requirement 5

**User Story:** As a user, I want all my trip data to be automatically uploaded to the cloud, so that my data is backed up without manual intervention.

#### Acceptance Criteria

1. WHEN a trip is completed THEN the Application SHALL add the trip to the Sync Queue
2. WHEN Background Sync runs THEN the Application SHALL upload all trips in the Sync Queue to the Supabase Backend
3. WHEN a trip is uploaded THEN the Supabase Backend SHALL store the trip with the user's UUID and a unique trip ID
4. WHEN trip upload succeeds THEN the Application SHALL remove the trip from the Sync Queue
5. THE Application SHALL minimize Local Storage usage by removing successfully synced trip data older than 30 days

### Requirement 6

**User Story:** As a user, I want to upload files associated with my trips, so that I can attach photos or GPS tracks to my journey records.

#### Acceptance Criteria

1. WHEN a user attaches a file to a trip THEN the Application SHALL store the file reference in Local Storage
2. WHEN Background Sync runs THEN the Application SHALL upload pending files to the Supabase Backend storage bucket
3. WHEN a file is uploaded THEN the Supabase Backend SHALL organize the file under the user's UUID folder
4. WHEN file upload succeeds THEN the Application SHALL store the cloud file URL in the trip metadata
5. THE Application SHALL support file uploads for images and GPS track files

### Requirement 7

**User Story:** As a user, I want my data to be protected so that other users cannot access my trip information, so that my privacy is maintained.

#### Acceptance Criteria

1. THE Supabase Backend SHALL enable Row Level Security on all user data tables
2. WHEN a user queries trip data THEN the Supabase Backend SHALL return only trips where the user_id matches the authenticated user's UUID
3. WHEN a user attempts to insert trip data THEN the Supabase Backend SHALL verify the user_id matches the authenticated user's UUID
4. WHEN a user attempts to access another user's files THEN the Supabase Backend SHALL deny the request
5. THE Supabase Backend SHALL enforce RLS policies at the database level for all SELECT, INSERT, UPDATE, and DELETE operations

### Requirement 8

**User Story:** As a user, I want to delete my account and all associated data from the user profile page, so that I can remove my information from the system when I no longer use the app.

#### Acceptance Criteria

1. WHEN a user requests account deletion from the profile page THEN the Application SHALL display a confirmation dialog
2. WHEN the user confirms account deletion THEN the Application SHALL delete all user data from the Supabase Backend
3. WHEN account deletion completes THEN the Supabase Backend SHALL cascade delete all trips, files, and profile data associated with the user's UUID
4. WHEN account deletion completes THEN the Application SHALL clear all Local Storage data
5. WHEN account deletion completes THEN the Application SHALL log out the user and return to the login screen

### Requirement 9

**User Story:** As a researcher, I want display names to be isolated from research data, so that user privacy is protected when accessing data from Supabase.

#### Acceptance Criteria

1. THE Supabase Backend SHALL store display names only in the user_accounts table
2. THE trips table SHALL NOT contain any display name field
3. THE rated_features table SHALL NOT contain any display name field
4. THE profiles table SHALL NOT contain any display name field
5. WHEN a user registers THEN the Application SHALL display a warning not to include personal identifying information in the display name

### Requirement 10

**User Story:** As a system administrator, I want a data retention policy placeholder, so that future compliance requirements can be implemented.

#### Acceptance Criteria

1. THE codebase SHALL include a TODO comment indicating where data retention policy logic should be implemented
2. THE data retention TODO SHALL specify that automatic deletion of data older than a configurable threshold may be required
3. THE Supabase Backend schema SHALL support timestamp-based queries for data retention enforcement
4. THE Application SHALL be designed to allow future implementation of retention policies without schema changes
5. THE data retention TODO SHALL be placed in the sync service module
