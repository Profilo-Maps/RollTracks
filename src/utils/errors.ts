/**
 * Error handling utilities for the Mobility Trip Tracker
 * Provides centralized error handling and user-friendly error messages
 */

export interface AppError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

/**
 * Error codes for common error scenarios
 */
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  NO_INTERNET = 'NO_INTERNET',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // Authentication errors
  AUTH_ERROR = 'AUTH_ERROR',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',

  // Data errors
  DATA_ERROR = 'DATA_ERROR',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // Trip errors
  ACTIVE_TRIP_EXISTS = 'ACTIVE_TRIP_EXISTS',
  NO_ACTIVE_TRIP = 'NO_ACTIVE_TRIP',
  TRIP_ALREADY_COMPLETED = 'TRIP_ALREADY_COMPLETED',

  // Profile errors
  PROFILE_EXISTS = 'PROFILE_EXISTS',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
}

/**
 * Create an AppError from a generic error
 */
export function createAppError(error: any): AppError {
  // If it's already an AppError, return it
  if (error && typeof error === 'object' && 'code' in error && 'retryable' in error) {
    return error as AppError;
  }

  // Extract error message
  const message = error?.message || 'An unexpected error occurred';

  // Determine error code and retryability based on message
  let code = ErrorCode.UNKNOWN_ERROR;
  let retryable = false;

  // Location permission errors (check before "required" check)
  if (message.includes('Location permission') || message.includes('location permission')) {
    code = ErrorCode.UNAUTHORIZED;
    retryable = true;
  }
  // Network errors
  else if (message.includes('network') || message.includes('Network')) {
    code = ErrorCode.NETWORK_ERROR;
    retryable = true;
  } else if (message.includes('timeout') || message.includes('Timeout')) {
    code = ErrorCode.CONNECTION_TIMEOUT;
    retryable = true;
  } else if (message.includes('internet') || message.includes('offline')) {
    code = ErrorCode.NO_INTERNET;
    retryable = true;
  } else if (message.includes('unavailable')) {
    code = ErrorCode.SERVICE_UNAVAILABLE;
    retryable = true;
  }
  // Validation errors
  else if (message.includes('validation') || message.includes('invalid')) {
    code = ErrorCode.VALIDATION_ERROR;
    retryable = false;
  } else if (message.includes('required')) {
    code = ErrorCode.MISSING_REQUIRED_FIELD;
    retryable = false;
  }
  // Authentication errors
  else if (message.includes('credentials') || message.includes('password')) {
    code = ErrorCode.INVALID_CREDENTIALS;
    retryable = false;
  } else if (message.includes('session') || message.includes('expired')) {
    code = ErrorCode.SESSION_EXPIRED;
    retryable = false;
  } else if (message.includes('unauthorized') || message.includes('Unauthorized')) {
    code = ErrorCode.UNAUTHORIZED;
    retryable = false;
  }
  // Trip errors
  else if (message.includes('already an active trip')) {
    code = ErrorCode.ACTIVE_TRIP_EXISTS;
    retryable = false;
  } else if (message.includes('already completed')) {
    code = ErrorCode.TRIP_ALREADY_COMPLETED;
    retryable = false;
  } else if (message.includes('Trip not found')) {
    code = ErrorCode.RECORD_NOT_FOUND;
    retryable = false;
  }
  // Profile errors
  else if (message.includes('Profile already exists')) {
    code = ErrorCode.PROFILE_EXISTS;
    retryable = false;
  } else if (message.includes('Profile not found')) {
    code = ErrorCode.PROFILE_NOT_FOUND;
    retryable = false;
  }
  // Data errors
  else if (message.includes('duplicate') || message.includes('already exists')) {
    code = ErrorCode.DUPLICATE_RECORD;
    retryable = false;
  } else if (message.includes('not found')) {
    code = ErrorCode.RECORD_NOT_FOUND;
    retryable = false;
  }

  return {
    code,
    message: getUserFriendlyMessage(code, message),
    details: error,
    retryable,
  };
}

/**
 * Get user-friendly error message based on error code
 */
export function getUserFriendlyMessage(code: ErrorCode, originalMessage?: string): string {
  switch (code) {
    // Network errors
    case ErrorCode.NETWORK_ERROR:
      return 'Network error occurred. Please check your connection and try again.';
    case ErrorCode.CONNECTION_TIMEOUT:
      return 'Connection timed out. Please try again.';
    case ErrorCode.NO_INTERNET:
      return 'No internet connection. Please check your network settings.';
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 'Service is temporarily unavailable. Please try again later.';

    // Validation errors
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
      return originalMessage || 'Please check your input and try again.';
    case ErrorCode.MISSING_REQUIRED_FIELD:
      return originalMessage || 'Please fill in all required fields.';
    case ErrorCode.INVALID_FILE_TYPE:
      return 'Invalid file type. Please select a supported file.';
    case ErrorCode.FILE_TOO_LARGE:
      return 'File is too large. Please select a smaller file.';

    // Authentication errors
    case ErrorCode.AUTH_ERROR:
      return 'Authentication error occurred. Please try logging in again.';
    case ErrorCode.INVALID_CREDENTIALS:
      return 'Invalid email or password. Please try again.';
    case ErrorCode.SESSION_EXPIRED:
      return 'Your session has expired. Please log in again.';
    case ErrorCode.UNAUTHORIZED:
      // Check if it's a location permission error
      if (originalMessage && (originalMessage.includes('Location permission') || originalMessage.includes('location permission'))) {
        return originalMessage;
      }
      return 'You are not authorized to perform this action.';

    // Data errors
    case ErrorCode.DATA_ERROR:
      return 'A data error occurred. Please try again.';
    case ErrorCode.DUPLICATE_RECORD:
      return originalMessage || 'This record already exists.';
    case ErrorCode.RECORD_NOT_FOUND:
      return originalMessage || 'Record not found.';
    case ErrorCode.CONSTRAINT_VIOLATION:
      return 'Operation violates data constraints. Please check your input.';

    // Trip errors
    case ErrorCode.ACTIVE_TRIP_EXISTS:
      return 'You already have an active trip. Please stop it before starting a new one.';
    case ErrorCode.NO_ACTIVE_TRIP:
      return 'No active trip found.';
    case ErrorCode.TRIP_ALREADY_COMPLETED:
      return 'This trip has already been completed.';

    // Profile errors
    case ErrorCode.PROFILE_EXISTS:
      return 'Profile already exists. You can update your existing profile.';
    case ErrorCode.PROFILE_NOT_FOUND:
      return 'Profile not found. Please create a profile first.';

    // Generic errors
    case ErrorCode.UNKNOWN_ERROR:
    case ErrorCode.OPERATION_FAILED:
    default:
      return originalMessage || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Log error for debugging purposes
 */
export function logError(error: AppError): void {
  if (__DEV__) {
    console.error('[AppError]', {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    });
  }
}

/**
 * Handle error with centralized error handling logic
 */
export function handleError(error: any): AppError {
  const appError = createAppError(error);
  logError(appError);
  return appError;
}
