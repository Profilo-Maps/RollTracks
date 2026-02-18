import { DataRangerService } from '@/services/DataRangerService';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════
// DATA RANGER CONTEXT
// ═══════════════════════════════════════════════════════════
// Manages DataRanger mode state and feature data initialization.
// When DataRanger mode is enabled, downloads and caches curb ramp
// features from Supabase Storage, checking for updates on app launch.

interface DataRangerContextType {
  isDataRangerMode: boolean;
  isInitializing: boolean;
  isReady: boolean;
  error: string | null;
}

const DataRangerContext = createContext<DataRangerContextType | undefined>(undefined);

export function DataRangerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DataRanger mode comes from user profile
  const isDataRangerMode = user?.dataRangerMode ?? false;

  useEffect(() => {
    async function initializeDataRanger() {
      // Wait for user to be loaded before checking DataRanger mode
      if (!user) {
        // User not loaded yet, don't initialize
        if (isReady) {
          DataRangerService.cleanup(false);
          setIsReady(false);
        }
        return;
      }

      if (!isDataRangerMode) {
        // DataRanger mode is off, cleanup if needed
        if (isReady) {
          DataRangerService.cleanup(false); // Don't clear cache, user might re-enable
          setIsReady(false);
        }
        return;
      }

      // DataRanger mode is on, initialize features
      setIsInitializing(true);
      setError(null);

      try {
        // Check for updates on initialization
        await DataRangerService.initialize(true);
        setIsReady(true);
        console.log('[DataRangerContext] DataRanger features initialized');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize DataRanger features';
        setError(errorMessage);
        console.error('[DataRangerContext] Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    initializeDataRanger();
  }, [isDataRangerMode, user]);

  return (
    <DataRangerContext.Provider
      value={{
        isDataRangerMode,
        isInitializing,
        isReady,
        error,
      }}
    >
      {children}
    </DataRangerContext.Provider>
  );
}

export function useDataRanger() {
  const context = useContext(DataRangerContext);
  if (context === undefined) {
    throw new Error('useDataRanger must be used within a DataRangerProvider');
  }
  return context;
}
