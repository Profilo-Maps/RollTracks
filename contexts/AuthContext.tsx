import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, UserProfile } from '@/adapters/SupabaseAdapter';

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
  signIn: (username: string, pin: string) => Promise<void>;
  signUp: (userData: Omit<User, 'id'> & { password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteUserData: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  toggleDataRangerMode: () => Promise<void>;
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
        const profile = await AuthService.getCurrentUser();
        if (profile) setUser(profile);
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (username: string, pin: string) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.login(username, pin);
      setUser(profile);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (userData: Omit<User, 'id'> & { password: string }) => {
    setIsLoading(true);
    try {
      const profile = await AuthService.register({
        username: userData.displayName,
        displayName: userData.displayName,
        age: userData.age,
        pin: userData.password,
        modeList: userData.modeList,
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
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
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
