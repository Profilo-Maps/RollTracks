import React, { createContext, useContext, useState, useEffect } from 'react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { AppMode } from '../types';
import { useAuth } from './AuthContext';

interface ModeContextType extends AppMode {
  // No mode switching functions needed anymore
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean>(false);
  
  // Get auth state to determine if user is authenticated
  const { user } = useAuth();
  const authenticated = !!user;

  useEffect(() => {
    // Detect if Supabase is configured from environment variables
    const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    setSupabaseConfigured(isConfigured);
  }, []);

  const value: ModeContextType = {
    supabaseConfigured,
    authenticated,
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
