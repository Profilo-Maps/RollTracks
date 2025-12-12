# Storage Layer

This folder contains storage adapters for the Mobility Trip Tracker application.

## Structure

- `types.ts` - Storage adapter interface definitions
- `LocalStorageAdapter.ts` - AsyncStorage implementation for demo mode (to be implemented)
- `SupabaseStorageAdapter.ts` - Supabase implementation for cloud mode (optional, to be implemented)

## Storage Adapters

### LocalStorageAdapter
Uses AsyncStorage for local-first data persistence. This is the default adapter used in demo mode.

### SupabaseStorageAdapter (Optional)
Uses Supabase for cloud-based data persistence. Only used when Supabase is configured and user is authenticated.

## Usage

Storage adapters implement the `StorageAdapter` interface, providing a consistent API for:
- Profile CRUD operations
- Trip CRUD operations
- Data persistence and retrieval
