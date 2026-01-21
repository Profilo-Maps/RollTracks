import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { AuthService, User, Session } from '../services/AuthService';

// Import Supabase configuration
import { SUPABASE_CONFIG } from '../config/supabase.config';

const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (displayName: string, password: string) => Promise<void>;
  signUp: (displayName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (profile: { age?: number; modeList?: string[] }) => Promise<void>;
  isDisplayNameAvailable: (displayName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authService] = useState(() => new AuthService());

  // Check if Supabase is configured
  const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && supabase);

  useEffect(() => {
    // Check for existing session on mount
    const loadSession = async () => {
      try {
        if (!supabaseConfigured) {
          setLoading(false);
          return;
        }

        const existingSession = await authService.getSession();
        if (existingSession) {
          setSession(existingSession);
          
          // Get user from local storage first
          let existingUser = await authService.getUser();
          
          // If user exists, refresh their data from Supabase to get latest profile
          if (existingUser && supabase) {
            try {
              const { data: userData, error } = await supabase
                .from('user_accounts')
                .select('*')
                .eq('id', existingUser.id)
                .single();
              
              if (!error && userData) {
                existingUser = {
                  id: userData.id,
                  displayName: userData.display_name,
                  createdAt: userData.created_at,
                  age: userData.age,
                  modeList: userData.mode_list,
                  tripHistoryIds: userData.trip_history_ids,
                };
                // Update local storage with fresh data
                await AsyncStorage.setItem('@rolltracks:user', JSON.stringify(existingUser));
              }

              // Fetch user's existing data from server when session is restored
              try {
                const { SyncService } = await import('../services/SyncService');
                const syncService = new SyncService();
                await syncService.initialize();
                
                const result = await syncService.fetchUserDataFromServer(existingUser.id);
                if (result.success) {
                  console.log('Successfully fetched user data from server on session restore');
                } else {
                  console.warn('Failed to fetch user data from server on session restore:', result.error);
                }
              } catch (fetchError) {
                console.error('Error fetching user data on session restore:', fetchError);
                // Don't throw error here - session restore was successful, data fetch is optional
              }
            } catch (refreshError) {
              console.error('Error refreshing user data:', refreshError);
            }
          }
          
          setUser(existingUser);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [supabaseConfigured, authService]);

  const signUp = async (displayName: string, password: string) => {
    if (!supabaseConfigured) {
      throw new Error('Supabase is not configured. Running in offline mode.');
    }

    const { user: newUser, session: newSession } = await authService.register(displayName, password);
    setUser(newUser);
    setSession(newSession);
  };

  const signIn = async (displayName: string, password: string) => {
    if (!supabaseConfigured) {
      throw new Error('Supabase is not configured. Running in offline mode.');
    }

    const { user: existingUser, session: existingSession } = await authService.login(displayName, password);
    setUser(existingUser);
    setSession(existingSession);

    // Fetch user's existing data from server after successful login
    if (existingUser) {
      try {
        // Import SyncService dynamically to avoid circular dependencies
        const { SyncService } = await import('../services/SyncService');
        const syncService = new SyncService();
        await syncService.initialize();
        
        const result = await syncService.fetchUserDataFromServer(existingUser.id);
        if (result.success) {
          console.log('Successfully fetched user data from server after login');
        } else {
          console.warn('Failed to fetch user data from server:', result.error);
        }
      } catch (error) {
        console.error('Error fetching user data after login:', error);
        // Don't throw error here - login was successful, data fetch is optional
      }
    }
  };

  const signOut = async () => {
    await authService.logout();
    setUser(null);
    setSession(null);
  };

  const deleteAccount = async () => {
    if (!user) {
      throw new Error('No user logged in');
    }

    await authService.deleteAccount(user.id);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (profile: { age?: number; modeList?: string[] }) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    if (!supabaseConfigured) {
      throw new Error('Supabase is not configured. Running in offline mode.');
    }

    const updatedUser = await authService.updateProfile(user.id, profile);
    setUser(updatedUser);
  };

  const isDisplayNameAvailable = async (displayName: string): Promise<boolean> => {
    if (!supabaseConfigured) {
      throw new Error('Supabase is not configured. Running in offline mode.');
    }

    return await authService.isDisplayNameAvailable(displayName);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    updateProfile,
    isDisplayNameAvailable,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
