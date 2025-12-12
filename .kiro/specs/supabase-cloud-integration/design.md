# Design Document

## Overview

This design document outlines the architecture for integrating Supabase cloud functionality into the Mobility Trip Tracker application. The integration implements a secure, offline-first synchronization system that enables user authentication via display names and passwords, automatic background data sync, file uploads, and row-level security. The system uses UUIDs for user identification and excludes display names from data exports to protect user privacy.

The design follows an offline-first architecture where all data operations occur locally first, then sync to the cloud when connectivity is available. Local data takes precedence during conflict resolution to ensure users never lose their most recent changes.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth Service  │  │ Sync Service │  │  File Service  │  │
│  └────────┬───────┘  └──────┬───────┘  └────────┬───────┘  │
│           │                  │                    │          │
│  ┌────────▼──────────────────▼────────────────────▼───────┐ │
│  │           Local Storage (AsyncStorage)                 │ │
│  │  - User Profile    - Trips    - Sync Queue            │ │
│  │  - Session Tokens  - GPS Points  - Rated Features     │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    Network Boundary
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    Supabase Backend                          │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Auth System   │  │  PostgreSQL  │  │ Storage Bucket │  │
│  │  (Custom)      │  │  + RLS       │  │  (trip-files)  │  │
│  └────────────────┘  └──────────────┘  └────────────────┘  │
│                                                              │
│  Tables: user_accounts, profiles, trips,                    │
│          trip_uploads, rated_features                       │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Write Operations**: User action → Local Storage → Sync Queue → Background Sync → Supabase
2. **Read Operations**: Local Storage (primary) → Supabase (if not cached)
3. **Sync Operations**: Periodic background sync checks queue → Uploads pending items → Updates local status

## Components and Interfaces

### 1. Authentication Service

**Purpose**: Manages user registration, login, logout, and session persistence using display names and passwords.

**Interface**:
```typescript
interface AuthService {
  // Register new user with display name and password
  register(displayName: string, password: string): Promise<AuthResult>;
  
  // Login with display name and password
  login(displayName: string, password: string): Promise<AuthResult>;
  
  // Logout current user
  logout(): Promise<void>;
  
  // Get current session
  getSession(): Promise<Session | null>;
  
  // Check if display name is available
  isDisplayNameAvailable(displayName: string): Promise<boolean>;
  
  // Delete user account and all data
  deleteAccount(userId: string): Promise<void>;
}

interface AuthResult {
  user: User;
  session: Session;
}

interface User {
  id: string; // UUID
  displayName: string;
  createdAt: string;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

**Implementation Details**:
- Uses Supabase custom authentication with a `user_accounts` table
- Display names are stored in `user_accounts` table with unique constraint
- Passwords are hashed using Supabase's built-in auth functions
- Session tokens stored in AsyncStorage with automatic refresh
- Display name uniqueness checked before registration

### 2. Sync Service

**Purpose**: Manages offline-first data synchronization between local storage and Supabase backend.

**Interface**:
```typescript
interface SyncService {
  // Initialize sync service with network listener
  initialize(): Promise<void>;
  
  // Manually trigger sync
  syncNow(): Promise<SyncResult>;
  
  // Add item to sync queue
  queueForSync(item: SyncItem): Promise<void>;
  
  // Get sync status
  getSyncStatus(): Promise<SyncStatus>;
  
  // Clear sync queue (for testing)
  clearQueue(): Promise<void>;
}

interface SyncItem {
  id: string;
  type: 'profile' | 'trip' | 'rated_feature' | 'file';
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
}

interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  errors: SyncError[];
}

interface SyncError {
  itemId: string;
  error: string;
  retryable: boolean;
}

interface SyncStatus {
  queueLength: number;
  lastSyncTime: number | null;
  isOnline: boolean;
  isSyncing: boolean;
}
```

**Implementation Details**:
- Monitors network connectivity using NetInfo
- Automatically triggers sync when network becomes available
- Implements exponential backoff for failed sync attempts (max 3 retries)
- Local data always takes precedence during conflicts (last-write-wins based on local timestamp)
- Sync queue persisted in AsyncStorage
- Batch uploads for efficiency (max 10 items per batch)

### 3. File Upload Service

**Purpose**: Handles file uploads to Supabase storage with offline queueing.

**Interface**:
```typescript
interface FileService {
  // Upload file to Supabase storage
  uploadFile(file: FileUpload): Promise<FileUploadResult>;
  
  // Queue file for upload when online
  queueFileUpload(file: FileUpload): Promise<void>;
  
  // Get file URL from storage
  getFileUrl(path: string): Promise<string>;
  
  // Delete file from storage
  deleteFile(path: string): Promise<void>;
}

interface FileUpload {
  localUri: string;
  fileName: string;
  fileType: string;
  tripId: string;
  userId: string;
}

interface FileUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}
```

**Implementation Details**:
- Files organized in storage as: `{userId}/{tripId}/{fileName}`
- Supports image files (JPEG, PNG) and GPS track files (GPX, KML)
- Files queued locally if offline, uploaded during next sync
- File metadata stored in `trip_uploads` table
- Maximum file size: 10MB per file

### 4. Supabase Client Configuration

**Purpose**: Securely initialize Supabase client with environment variables.

**Interface**:
```typescript
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function initializeSupabase(config: SupabaseConfig): SupabaseClient;
function getSupabaseClient(): SupabaseClient | null;
```

**Implementation Details**:
- Reads credentials from environment variables only
- Never exposes publishable key in frontend code
- Falls back to offline-only mode if credentials missing
- Uses `react-native-dotenv` for environment variable management
- Validates `.env` is in `.gitignore`

## Data Models

### Database Schema

#### user_accounts Table
```sql
CREATE TABLE user_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_accounts_display_name ON user_accounts(display_name);
```

#### profiles Table (Updated)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  mode_list TEXT[] NOT NULL,
  trip_history_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

#### trips Table (Updated)
```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  boldness INTEGER NOT NULL CHECK (boldness >= 1 AND boldness <= 10),
  purpose TEXT CHECK (purpose IN ('work', 'recreation', 'other')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  distance_miles NUMERIC(10, 2),
  geometry TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_start_time ON trips(start_time DESC);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_synced_at ON trips(synced_at) WHERE synced_at IS NULL;
```

#### trip_uploads Table
```sql
CREATE TABLE trip_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trip_uploads_trip_id ON trip_uploads(trip_id);
CREATE INDEX idx_trip_uploads_user_id ON trip_uploads(user_id);
```

#### rated_features Table (New)
```sql
CREATE TABLE rated_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  user_rating INTEGER NOT NULL CHECK (user_rating >= 1 AND user_rating <= 10),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  properties JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, trip_id, feature_id)
);

CREATE INDEX idx_rated_features_user_id ON rated_features(user_id);
CREATE INDEX idx_rated_features_trip_id ON rated_features(trip_id);
CREATE INDEX idx_rated_features_location ON rated_features USING GIST (
  ll_to_earth(latitude, longitude)
);
```

#### sync_queue Table (Local Only - AsyncStorage)
```typescript
interface SyncQueueItem {
  id: string;
  type: 'profile' | 'trip' | 'rated_feature' | 'file';
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  lastAttempt: number | null;
  error: string | null;
}
```

### Row Level Security Policies

#### user_accounts RLS
```sql
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own account
CREATE POLICY "Users can view own account"
  ON user_accounts FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own account
CREATE POLICY "Users can update own account"
  ON user_accounts FOR UPDATE
  USING (auth.uid() = id);

-- Users can delete their own account
CREATE POLICY "Users can delete own account"
  ON user_accounts FOR DELETE
  USING (auth.uid() = id);
```

#### profiles RLS
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);
```

#### trips RLS
```sql
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (auth.uid() = user_id);
```

#### trip_uploads RLS
```sql
ALTER TABLE trip_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploads"
  ON trip_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads"
  ON trip_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads"
  ON trip_uploads FOR DELETE
  USING (auth.uid() = user_id);
```

#### rated_features RLS
```sql
ALTER TABLE rated_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rated features"
  ON rated_features FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rated features"
  ON rated_features FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rated features"
  ON rated_features FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rated features"
  ON rated_features FOR DELETE
  USING (auth.uid() = user_id);
```

### Storage Bucket Policies

```sql
-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-files', 'trip-files', false);

-- Users can upload files to their own folder
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own files
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trip-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Display name uniqueness
*For any* two user accounts, their display names must be different
**Validates: Requirements 1.2**

### Property 2: UUID assignment
*For any* newly created user account, the system must assign a valid UUID as the primary identifier
**Validates: Requirements 1.1**

### Property 3: Local-first write
*For any* data modification operation, the data must be written to local storage before being added to the sync queue
**Validates: Requirements 3.1**

### Property 4: Sync queue persistence
*For any* item added to the sync queue while offline, the item must remain in the queue until successfully synced
**Validates: Requirements 3.4**

### Property 5: Local data precedence
*For any* conflict between local and cloud data, the version with the more recent local timestamp must be preserved
**Validates: Requirements 4.1, 4.2**

### Property 6: RLS enforcement
*For any* database query, the returned results must only include rows where the user_id matches the authenticated user's UUID
**Validates: Requirements 7.2**

### Property 7: File path isolation
*For any* file upload, the storage path must begin with the authenticated user's UUID
**Validates: Requirements 7.4**

### Property 8: Cascade deletion
*For any* user account deletion, all associated trips, files, and rated features must be deleted
**Validates: Requirements 8.3**

### Property 9: Display name isolation
*For any* data table except user_accounts, the schema must not include a display_name field
**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 10: Environment variable isolation
*For any* frontend code bundle, the Supabase publishable key must not appear in the compiled output
**Validates: Requirements 2.2**

### Property 11: Offline operation
*For any* data operation while offline, the application must complete the operation locally without throwing network errors
**Validates: Requirements 2.4**

### Property 12: Sync retry
*For any* failed sync operation marked as retryable, the system must attempt the operation again on the next sync cycle
**Validates: Requirements 3.4**

## Error Handling

### Error Categories

1. **Network Errors**: Connection failures, timeouts
   - Strategy: Queue operation for retry, continue offline
   - User feedback: Silent (background sync)

2. **Authentication Errors**: Invalid credentials, expired session
   - Strategy: Prompt re-login, preserve local data
   - User feedback: Login screen with error message

3. **Validation Errors**: Invalid data format, constraint violations
   - Strategy: Show error, prevent submission
   - User feedback: Inline validation messages

4. **Storage Errors**: Quota exceeded, file too large
   - Strategy: Notify user, suggest cleanup
   - User feedback: Alert dialog with action

5. **Sync Conflicts**: Concurrent modifications
   - Strategy: Apply local-first resolution
   - User feedback: Silent (automatic resolution)

### Error Recovery

```typescript
interface ErrorHandler {
  handleError(error: AppError): Promise<ErrorResolution>;
}

interface ErrorResolution {
  action: 'retry' | 'queue' | 'notify' | 'ignore';
  message?: string;
  retryDelay?: number;
}
```

### Retry Logic

- Network errors: Exponential backoff (1s, 2s, 4s, max 3 attempts)
- Authentication errors: No retry, prompt login
- Validation errors: No retry, user correction required
- Storage errors: No retry, user action required

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples and edge cases:

- Display name validation (empty, too long, special characters)
- Password strength enforcement (minimum length)
- UUID generation format
- Sync queue operations (add, remove, clear)
- File path construction
- RLS policy SQL syntax
- Error handling for specific error codes
- Session token expiration logic

### Property-Based Testing

Property-based tests will verify universal properties using the `fast-check` library (already in package.json). Each test will run a minimum of 100 iterations with randomly generated inputs.

**Testing Framework**: fast-check (JavaScript/TypeScript property-based testing library)

**Property Test Requirements**:
- Each property-based test must run at least 100 iterations
- Each test must be tagged with a comment referencing the design document property
- Tag format: `// Feature: supabase-cloud-integration, Property {number}: {property_text}`

**Property Tests to Implement**:

1. **Display Name Uniqueness Test**
   - Generate random arrays of user accounts
   - Verify no two accounts have the same display name
   - Tag: `// Feature: supabase-cloud-integration, Property 1: Display name uniqueness`

2. **UUID Assignment Test**
   - Generate random user registration requests
   - Verify each created account has a valid UUID format
   - Tag: `// Feature: supabase-cloud-integration, Property 2: UUID assignment`

3. **Local-First Write Test**
   - Generate random data modifications
   - Verify local storage is updated before sync queue
   - Tag: `// Feature: supabase-cloud-integration, Property 3: Local-first write`

4. **Sync Queue Persistence Test**
   - Generate random sync items while simulating offline state
   - Verify all items remain in queue until sync succeeds
   - Tag: `// Feature: supabase-cloud-integration, Property 4: Sync queue persistence`

5. **Local Data Precedence Test**
   - Generate random pairs of conflicting local and cloud data
   - Verify local data with newer timestamp is preserved
   - Tag: `// Feature: supabase-cloud-integration, Property 5: Local data precedence`

6. **File Path Isolation Test**
   - Generate random file uploads with different user IDs
   - Verify each file path starts with the correct user UUID
   - Tag: `// Feature: supabase-cloud-integration, Property 7: File path isolation`

7. **Display Name Exclusion Test**
   - Generate random data export queries
   - Verify display_name field is not in result set
   - Tag: `// Feature: supabase-cloud-integration, Property 9: Display name exclusion`

8. **Offline Operation Test**
   - Generate random data operations while simulating offline state
   - Verify operations complete without network errors
   - Tag: `// Feature: supabase-cloud-integration, Property 11: Offline operation`

### Integration Testing

Integration tests will verify:
- End-to-end registration and login flow
- Complete sync cycle (local → queue → cloud)
- File upload and retrieval
- Account deletion cascade
- RLS policy enforcement (requires test database)

### Security Testing

Security tests will verify:
- RLS policies prevent unauthorized access
- File storage policies enforce user isolation
- Environment variables not exposed in bundle
- Session tokens properly encrypted in storage

## Implementation Notes

### Environment Variable Security

1. Use `react-native-dotenv` for environment variable management
2. Add `.env` to `.gitignore` (already present)
3. Create `.env.example` with placeholder values
4. Never commit actual credentials
5. Validate environment variables at app startup

### Offline-First Implementation

1. All write operations go to AsyncStorage first
2. Sync queue tracks pending operations
3. Network listener triggers sync when online
4. Exponential backoff for failed syncs
5. Local data always wins conflicts

### Data Migration

For users with existing local data:
1. Detect first login after Supabase integration
2. Upload all existing trips to cloud
3. Mark as synced in local storage
4. Continue normal sync operation

### Performance Considerations

1. Batch sync operations (max 10 items per batch)
2. Compress large geometry data before upload
3. Lazy load trip history (paginate)
4. Cache frequently accessed data
5. Index database tables for common queries

### TODO: Data Retention Policy

```typescript
// TODO: Implement data retention policy
// Location: src/services/SyncService.ts
// Requirements:
// - Automatically delete cloud data older than configurable threshold (e.g., 2 years)
// - Preserve local data based on user preference
// - Run retention check during background sync
// - Log retention actions for audit
// - Allow users to opt-out of automatic deletion
```

## Security Considerations

1. **Authentication**: Custom display name + password auth
2. **Authorization**: Row-level security on all tables
3. **Data Isolation**: User UUID enforced at database level
4. **File Security**: Private storage bucket with user-based paths
5. **Credential Management**: Environment variables only, never in code
6. **Session Management**: Automatic token refresh, secure storage
7. **Privacy**: Display names excluded from exports

## Deployment Checklist

1. Apply database migrations to Supabase project
2. Enable RLS on all tables
3. Create storage bucket with policies
4. Configure environment variables
5. Test authentication flow
6. Verify RLS policies with test users
7. Test offline sync functionality
8. Validate file upload permissions
9. Test account deletion cascade
10. Verify display name exclusion in exports
