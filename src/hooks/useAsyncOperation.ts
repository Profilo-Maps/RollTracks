import { useState, useCallback } from 'react';
import { handleError, AppError } from '../utils/errors';

/**
 * Custom hook for managing async operations with loading and error states
 * Provides a consistent pattern for handling async operations throughout the app
 */
export function useAsyncOperation<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [data, setData] = useState<T | null>(null);

  /**
   * Execute an async operation with automatic loading and error handling
   */
  const execute = useCallback(
    async (
      operation: () => Promise<T>,
      options?: {
        onSuccess?: (data: T) => void;
        onError?: (error: AppError) => void;
        onFinally?: () => void;
      }
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await operation();
        setData(result);
        
        if (options?.onSuccess) {
          options.onSuccess(result);
        }
        
        return result;
      } catch (err: any) {
        const appError = handleError(err);
        setError(appError);
        
        if (options?.onError) {
          options.onError(appError);
        }
        
        return null;
      } finally {
        setLoading(false);
        
        if (options?.onFinally) {
          options.onFinally();
        }
      }
    },
    []
  );

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
}
