import React, { createContext, useContext, useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { AppMode } from '../types';
import { useAuth } from './AuthContext';

interface ModeContextType extends AppMode {
  switchToCloudMode: () => void;
  switchToDemoMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'demo' | 'cloud'>('demo');
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean>(false);
  
  // Get auth state to determine if user is authenticated
  const { user } = useAuth();
  const authenticated = !!user;

  useEffect(() => {
    // Detect if Supabase is configured from environment variables
    const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    setSupabaseConfigured(isConfigured);
    
    // If Supabase is configured and user is authenticated, switch to cloud mode
    if (isConfigured && authenticated) {
      setMode('cloud');
    } else {
      setMode('demo');
    }
  }, [authenticated]);

  const switchToCloudMode = () => {
    if (supabaseConfigured) {
      setMode('cloud');
    } else {
      console.warn('Cannot switch to cloud mode: Supabase is not configured');
    }
  };

  const switchToDemoMode = () => {
    setMode('demo');
  };

  const value: ModeContextType = {
    mode,
    supabaseConfigured,
    authenticated,
    switchToCloudMode,
    switchToDemoMode,
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

export const useMode = (): ModeContextType => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};
