# Context Providers

## ModeProvider

The `ModeProvider` manages the application's operating mode (demo or cloud) and provides mode-related state and functions throughout the app.

### Features

- **Automatic Mode Detection**: Detects if Supabase is configured from environment variables
- **Authentication-Based Switching**: Automatically switches to cloud mode when user is authenticated
- **Manual Mode Switching**: Provides functions to manually switch between modes

### Usage

The `ModeProvider` should wrap your app content and be placed inside the `AuthProvider` since it depends on authentication state:

```tsx
import { AuthProvider } from './src/contexts/AuthContext';
import { ModeProvider } from './src/contexts/ModeContext';

function App() {
  return (
    <AuthProvider>
      <ModeProvider>
        <AppContent />
      </ModeProvider>
    </AuthProvider>
  );
}
```

### Hook: useMode()

Access mode state and functions using the `useMode` hook:

```tsx
import { useMode } from './src/contexts/ModeContext';

function MyComponent() {
  const { mode, supabaseConfigured, authenticated, switchToCloudMode, switchToDemoMode } = useMode();

  return (
    <View>
      <Text>Current Mode: {mode}</Text>
      <Text>Supabase Configured: {supabaseConfigured ? 'Yes' : 'No'}</Text>
      <Text>Authenticated: {authenticated ? 'Yes' : 'No'}</Text>
    </View>
  );
}
```

### Mode States

- **Demo Mode**: Default mode, uses local storage only, no authentication required
- **Cloud Mode**: Activated when Supabase is configured and user is authenticated

### Requirements Validation

This implementation satisfies:
- **Requirement 5.1**: Allows immediate access without authentication (demo mode)
- **Requirement 5.2**: Persists data to local storage in demo mode
- **Requirement 5.3**: Provides visual indicator for current mode (via ModeIndicator component)

## ModeIndicator Component

The `ModeIndicator` component displays the current app mode and sync status.

### Features

- **Demo Mode Badge**: Shows "Demo Mode" badge in orange when in demo mode
- **Cloud Sync Status**: Shows sync status (Syncing, Synced, Error) when in cloud mode
- **Color-Coded Status**: Different colors for different states

### Usage

```tsx
import { ModeIndicator } from './src/components/ModeIndicator';

function MyScreen() {
  return (
    <View>
      <ModeIndicator syncStatus="synced" />
      {/* Your screen content */}
    </View>
  );
}
```

### Props

- `syncStatus` (optional): Current sync status - 'idle' | 'syncing' | 'synced' | 'error'
  - Default: 'idle'

### Visual States

- **Demo Mode**: Orange badge with "Demo Mode" text
- **Cloud Mode (idle)**: Blue badge with "Cloud Mode" text
- **Syncing**: Yellow badge with "Syncing..." text
- **Synced**: Green badge with "Synced" text
- **Error**: Red badge with "Sync Error" text
