# Error Handling Guide

This document explains how to use the centralized error handling utilities in the Mobility Trip Tracker app.

## Overview

The app provides a comprehensive error handling system with:
- Centralized error handling utilities
- Toast notifications for user feedback
- Loading state management
- User-friendly error messages

## Components

### 1. Error Utilities (`utils/errors.ts`)

The error utilities provide centralized error handling with user-friendly messages.

#### AppError Interface

```typescript
interface AppError {
  code: string;        // Error code (e.g., 'NETWORK_ERROR')
  message: string;     // User-friendly error message
  details?: any;       // Original error details
  retryable: boolean;  // Whether the operation can be retried
}
```

#### Error Codes

Common error codes include:
- `NETWORK_ERROR` - Network connectivity issues
- `VALIDATION_ERROR` - Input validation failures
- `AUTH_ERROR` - Authentication problems
- `ACTIVE_TRIP_EXISTS` - Attempting to start a trip when one is active
- `PROFILE_NOT_FOUND` - Profile doesn't exist
- And many more...

#### Usage

```typescript
import { handleError } from '../utils/errors';

try {
  await someOperation();
} catch (error) {
  const appError = handleError(error);
  // appError.message contains user-friendly message
  // appError.retryable indicates if operation can be retried
}
```

### 2. Toast Notifications (`contexts/ToastContext.tsx`)

The toast system provides non-intrusive notifications to users.

#### Usage

```typescript
import { useToast } from '../contexts/ToastContext';

function MyComponent() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleAction = async () => {
    try {
      await someOperation();
      showSuccess('Operation completed successfully');
    } catch (error) {
      const appError = handleError(error);
      showError(appError.message);
    }
  };
}
```

#### Toast Methods

- `showSuccess(message, duration?)` - Green toast for success messages
- `showError(message, duration?)` - Red toast for error messages (default 4s)
- `showWarning(message, duration?)` - Orange toast for warnings
- `showInfo(message, duration?)` - Blue toast for informational messages
- `showToast(message, type, duration?)` - Generic toast with custom type

### 3. Async Operation Hook (`hooks/useAsyncOperation.ts`)

A custom hook for managing async operations with loading and error states.

#### Usage

```typescript
import { useAsyncOperation } from '../hooks/useAsyncOperation';

function MyComponent() {
  const { loading, error, data, execute } = useAsyncOperation();

  const loadData = async () => {
    await execute(
      async () => {
        return await fetchData();
      },
      {
        onSuccess: (data) => {
          console.log('Data loaded:', data);
        },
        onError: (error) => {
          console.error('Failed to load:', error);
        },
      }
    );
  };

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>{error.message}</Text>;
  return <Text>{data}</Text>;
}
```

## Best Practices

### 1. Always Use handleError

When catching errors, always use `handleError` to convert them to AppError:

```typescript
try {
  await operation();
} catch (error) {
  const appError = handleError(error);
  showError(appError.message);
}
```

### 2. Provide User Feedback

Always inform users about the result of their actions:

```typescript
// Success
showSuccess('Profile updated successfully');

// Error
showError('Failed to update profile. Please try again.');
```

### 3. Show Loading States

Always show loading indicators during async operations:

```typescript
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  setLoading(true);
  try {
    await saveData();
    showSuccess('Saved successfully');
  } catch (error) {
    const appError = handleError(error);
    showError(appError.message);
  } finally {
    setLoading(false);
  }
};
```

### 4. Handle Retryable Errors

Check if an error is retryable and provide retry options:

```typescript
catch (error) {
  const appError = handleError(error);
  showError(appError.message);
  
  if (appError.retryable) {
    // Show retry button or automatically retry
  }
}
```

## Examples

### Example 1: Form Submission with Error Handling

```typescript
import { useToast } from '../contexts/ToastContext';
import { handleError } from '../utils/errors';

function ProfileForm() {
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await profileService.updateProfile(formData);
      showSuccess('Profile updated successfully');
    } catch (error) {
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TouchableOpacity onPress={handleSubmit} disabled={saving}>
      {saving ? <ActivityIndicator /> : <Text>Save</Text>}
    </TouchableOpacity>
  );
}
```

### Example 2: Data Fetching with Loading State

```typescript
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { useToast } from '../contexts/ToastContext';

function TripList() {
  const { showError } = useToast();
  const { loading, error, data, execute } = useAsyncOperation();

  useEffect(() => {
    execute(
      async () => await tripService.getTrips(),
      {
        onError: (error) => showError(error.message),
      }
    );
  }, []);

  if (loading) return <ActivityIndicator />;
  if (error) return <ErrorView message={error.message} />;
  return <TripList trips={data} />;
}
```

### Example 3: Network Error with Retry

```typescript
const handleSync = async () => {
  try {
    await syncData();
    showSuccess('Data synced successfully');
  } catch (error) {
    const appError = handleError(error);
    showError(appError.message);
    
    if (appError.retryable) {
      // Automatically retry after delay
      setTimeout(() => handleSync(), 5000);
    }
  }
};
```

## Error Message Customization

To customize error messages, update the `getUserFriendlyMessage` function in `utils/errors.ts`:

```typescript
case ErrorCode.MY_CUSTOM_ERROR:
  return 'Your custom user-friendly message here';
```

## Testing Error Handling

When testing components with error handling:

```typescript
it('should display error toast on failure', async () => {
  const mockError = new Error('Test error');
  jest.spyOn(service, 'operation').mockRejectedValue(mockError);
  
  const { getByText } = render(<MyComponent />);
  
  // Trigger operation
  fireEvent.press(getByText('Submit'));
  
  // Verify error handling
  await waitFor(() => {
    expect(getByText(/error occurred/i)).toBeTruthy();
  });
});
```

## Requirements Validation

This error handling implementation satisfies **Requirement 7.5**:
- ✅ Centralized error handler utility created
- ✅ Toast/snackbar system implemented for error messages
- ✅ Loading states added for async operations
- ✅ User-friendly error messages for common errors
- ✅ Clear error messages with actionable guidance
