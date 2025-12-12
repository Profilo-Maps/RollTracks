import {
  createAppError,
  getUserFriendlyMessage,
  handleError,
  ErrorCode,
} from '../errors';

describe('Error Handling Utilities', () => {
  describe('createAppError', () => {
    it('should convert generic error to AppError', () => {
      const error = new Error('Something went wrong');
      const appError = createAppError(error);

      expect(appError).toHaveProperty('code');
      expect(appError).toHaveProperty('message');
      expect(appError).toHaveProperty('retryable');
      expect(appError).toHaveProperty('details');
    });

    it('should identify network errors as retryable', () => {
      const error = new Error('Network request failed');
      const appError = createAppError(error);

      expect(appError.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(appError.retryable).toBe(true);
    });

    it('should identify validation errors as non-retryable', () => {
      const error = new Error('invalid age value');
      const appError = createAppError(error);

      expect(appError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(appError.retryable).toBe(false);
    });

    it('should identify active trip error', () => {
      const error = new Error('There is already an active trip');
      const appError = createAppError(error);

      expect(appError.code).toBe(ErrorCode.ACTIVE_TRIP_EXISTS);
      expect(appError.retryable).toBe(false);
    });

    it('should identify profile not found error', () => {
      const error = new Error('Profile not found');
      const appError = createAppError(error);

      expect(appError.code).toBe(ErrorCode.PROFILE_NOT_FOUND);
      expect(appError.retryable).toBe(false);
    });

    it('should return existing AppError unchanged', () => {
      const appError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        retryable: true,
      };

      const result = createAppError(appError);
      expect(result).toEqual(appError);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for network error', () => {
      const message = getUserFriendlyMessage(ErrorCode.NETWORK_ERROR);
      expect(message).toContain('Network error');
      expect(message).toContain('check your connection');
    });

    it('should return user-friendly message for validation error', () => {
      const message = getUserFriendlyMessage(ErrorCode.VALIDATION_ERROR);
      expect(message).toContain('check your input');
    });

    it('should return user-friendly message for active trip exists', () => {
      const message = getUserFriendlyMessage(ErrorCode.ACTIVE_TRIP_EXISTS);
      expect(message).toContain('already have an active trip');
      expect(message).toContain('stop it before starting');
    });

    it('should return original message for validation errors when provided', () => {
      const originalMessage = 'Age must be between 13 and 120';
      const message = getUserFriendlyMessage(
        ErrorCode.VALIDATION_ERROR,
        originalMessage
      );
      expect(message).toBe(originalMessage);
    });

    it('should return generic message for unknown error', () => {
      const message = getUserFriendlyMessage(ErrorCode.UNKNOWN_ERROR);
      expect(message).toContain('unexpected error');
    });
  });

  describe('handleError', () => {
    it('should create AppError and return it', () => {
      const error = new Error('Test error');
      const appError = handleError(error);

      expect(appError).toHaveProperty('code');
      expect(appError).toHaveProperty('message');
      expect(appError).toHaveProperty('retryable');
    });

    it('should handle null/undefined errors', () => {
      const appError = handleError(null);
      expect(appError.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should preserve error details', () => {
      const error = new Error('Test error');
      const appError = handleError(error);

      expect(appError.details).toBe(error);
    });
  });

  describe('Error Code Coverage', () => {
    it('should have user-friendly messages for all error codes', () => {
      const errorCodes = Object.values(ErrorCode);

      errorCodes.forEach((code) => {
        const message = getUserFriendlyMessage(code as ErrorCode);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Retryable Error Detection', () => {
    const retryableErrors = [
      { message: 'Network error occurred', expected: true },
      { message: 'Connection timeout', expected: true },
      { message: 'No internet connection', expected: true },
      { message: 'Service unavailable', expected: true },
    ];

    const nonRetryableErrors = [
      { message: 'Invalid input', expected: false },
      { message: 'Profile already exists', expected: false },
      { message: 'Trip not found', expected: false },
      { message: 'Age must be valid', expected: false },
    ];

    retryableErrors.forEach(({ message, expected }) => {
      it(`should mark "${message}" as retryable=${expected}`, () => {
        const error = new Error(message);
        const appError = createAppError(error);
        expect(appError.retryable).toBe(expected);
      });
    });

    nonRetryableErrors.forEach(({ message, expected }) => {
      it(`should mark "${message}" as retryable=${expected}`, () => {
        const error = new Error(message);
        const appError = createAppError(error);
        expect(appError.retryable).toBe(expected);
      });
    });
  });
});
