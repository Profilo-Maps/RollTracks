import { DataRangerService } from '@/services/DataRangerService';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════
// DATA RANGER CONTEXT
// ═══════════════════════════════════════════════════════════
// Manages DataRanger mode state and proximity network initialization.
// When DataRanger mode is enabled, downloads and caches the proximity
// parquet from Supabase Storage, checking for updates on app launch.

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
  const taskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  // DataRanger mode comes from user profile
  const isDataRangerMode = user?.dataRangerMode ?? false;

  useEffect(() => {
    // Cancel any pending deferred task when dependencies change
    taskRef.current?.cancel();

    if (!user) {
      if (isReady) {
        DataRangerService.cleanup(false);
        setIsReady(false);
      }
      return;
    }

    if (!isDataRangerMode) {
      if (isReady) {
        DataRangerService.cleanup(false);
        setIsReady(false);
      }
      return;
    }

    // Defer parquet initialization until after the map and any entrance
    // animations have fully rendered, so the basemap appears immediately.
    setIsInitializing(true);
    setError(null);

    taskRef.current = InteractionManager.runAfterInteractions(async () => {
      try {
        console.log('[DataRangerContext] Starting background parquet initialization...');
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
    });

    return () => {
      taskRef.current?.cancel();
    };
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
