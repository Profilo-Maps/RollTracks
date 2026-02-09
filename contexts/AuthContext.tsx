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
  signIn: (displayName: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (userData: Omit<User, 'id' | 'dataRangerMode'> & { password: string; captchaToken?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteUserData: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  toggleDataRangerMode: () => Promise<void>;
  checkDisplayNameAvailability: (displayName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Add timeout to prevent infinite loading (30 seconds)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 30000)
        );
        
        const profile = await Promise.race([
          AuthService.getCurrentUser(),
          timeoutPromise
        ]) as UserProfile | null;
        
        if (profile) setUser(profile);
      } catch (error) {
        console.error('Session check failed:', error);
        // Continue to app even if session check fails
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

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

  const signUp = async (userData: Omit<User, 'id' | 'dataRangerMode'> & { password: string; captchaToken?: string }) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.register({
        username: userData.displayName, // Use displayName as username
        displayName: userData.displayName,
        age: userData.age,
        password: userData.password,
        modeList: userData.modeList,
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
        signIn,
        signUp,
        signOut,
        deleteUserData,
        updateUser,
        toggleDataRangerMode,
        checkDisplayNameAvailability,
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
