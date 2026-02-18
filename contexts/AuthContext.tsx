import { AuthService, UserProfile } from '@/adapters/DatabaseAdapter';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

/**
 * Auth Context
 * Wrapper for User Profiles — controls navigation between Auth and Main stacks.
 * Delegates all data operations to the AuthService module of the Database Adapter.
 */

type User = UserProfile;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasNetworkError: boolean;
  signIn: (displayName: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (userData: Omit<User, 'id'> & { password: string; captchaToken?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteUserData: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  toggleDataRangerMode: () => Promise<void>;
  checkDisplayNameAvailability: (displayName: string) => Promise<boolean>;
  retryConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNetworkError, setHasNetworkError] = useState(false);

  const checkSession = async () => {
    try {
      console.log('[AuthContext] Starting session check...');
      setIsLoading(true);
      setHasNetworkError(false);
      
      // Add timeout to prevent infinite loading (5 seconds for initial check)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 5000)
      );
      
      const profile = await Promise.race([
        AuthService.getCurrentUser(),
        timeoutPromise
      ]) as UserProfile | null;
      
      console.log('[AuthContext] Session check succeeded, profile:', profile ? 'found' : 'null');
      if (profile) setUser(profile);
    } catch (error) {
      console.error('[AuthContext] Session check failed:', error);
      
      // Check if it's a network error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = 
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Session check timeout') ||
        errorMessage.includes('fetch failed');
      
      console.log('[AuthContext] Is network error?', isNetworkError);
      
      if (isNetworkError) {
        console.log('[AuthContext] Setting hasNetworkError to true');
        setHasNetworkError(true);
      }
      // Continue to app even if session check fails
      // User will be redirected to login screen
    } finally {
      console.log('[AuthContext] Session check complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const retryConnection = async () => {
    await checkSession();
  };

  const signIn = async (displayName: string, password: string, captchaToken?: string) => {
    setIsLoading(true);
    try {
      // Use displayName as username for login
      const profile = await AuthService.login(displayName, password, captchaToken);
      setUser(profile);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (userData: Omit<User, 'id'> & { password: string; captchaToken?: string }) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.register({
        username: userData.displayName, // Use displayName as username
        displayName: userData.displayName,
        age: userData.age,
        password: userData.password,
        modeList: userData.modeList,
        dataRangerMode: userData.dataRangerMode,
        captchaToken: userData.captchaToken,
      });
      setUser(profile);
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // Logout just clears local state - session persists in AsyncStorage
    // This allows the user to log back in on the same device without
    // creating a new profile or migrating data
    try {
      await AuthService.logout();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      // Even if logout fails, clear local state
      setUser(null);
    }
  };

  const deleteUserData = async () => {
    setIsLoading(true);
    try {
      await AuthService.deleteUserData();
      setUser(null);
    } catch (error) {
      console.error('Delete user data failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      const updated = await AuthService.updateProfile(updates);
      setUser(updated);
    } catch (error) {
      console.error('Update user failed:', error);
      throw error;
    }
  };

  const toggleDataRangerMode = async () => {
    if (!user) return;
    try {
      const newMode = await AuthService.toggleDataRangerMode();
      setUser({ ...user, dataRangerMode: newMode });
    } catch (error) {
      console.error('Toggle DataRanger mode failed:', error);
      throw error;
    }
  };

  const checkDisplayNameAvailability = async (displayName: string): Promise<boolean> => {
    try {
      return await AuthService.checkDisplayNameAvailability(displayName);
    } catch (error) {
      console.error('Check display name availability failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasNetworkError,
        signIn,
        signUp,
        signOut,
        deleteUserData,
        updateUser,
        toggleDataRangerMode,
        checkDisplayNameAvailability,
        retryConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
