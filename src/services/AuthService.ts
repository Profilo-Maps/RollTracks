import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = '@rolltracks:session';
const USER_KEY = '@rolltracks:user';

export interface User {
  id: string; // UUID
  displayName: string;
  createdAt: string;
  // Profile fields (optional, set after registration)
  age?: number;
  modeList?: string[];
  tripHistoryIds?: string[];
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export interface AuthResult {
  user: User;
  session: Session;
}

export class AuthService {
  /**
   * Register a new user with display name and password
   * @param displayName - Unique display name for login
   * @param password - User password (min 8 characters)
   * @returns AuthResult with user and session
   */
  async register(displayName: string, password: string): Promise<AuthResult> {
    if (!supabase) {
      throw new Error('Supabase not configured. Running in offline mode.');
    }

    // Validate inputs
    if (!displayName || displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if display name is available
    const available = await this.isDisplayNameAvailable(displayName);
    if (!available) {
      throw new Error('Display name is already taken');
    }

    let userId: string | null = null;

    try {
      // Hash password using Supabase function
      const { data: hashData, error: hashError } = await supabase
        .rpc('hash_password', { password });

      if (hashError) {
        throw new Error(`Failed to hash password: ${hashError.message}`);
      }

      // Create user account (let database generate UUID)
      const { data: userData, error: userError } = await supabase
        .from('user_accounts')
        .insert({
          display_name: displayName,
          password_hash: hashData,
        })
        .select()
        .single();

      if (userError) {
        throw new Error(`Failed to create account: ${userError.message}`);
      }

      userId = userData.id;

      // Create session
      const session = await this.createSession(userData.id);

      // Store session locally
      await this.storeSession(session);

      const user: User = {
        id: userData.id,
        displayName: userData.display_name,
        createdAt: userData.created_at,
        age: userData.age,
        modeList: userData.mode_list,
        tripHistoryIds: userData.trip_history_ids,
      };

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

      return { user, session };
    } catch (error) {
      // Rollback: Delete the user account if it was created
      if (userId && supabase) {
        console.log('Registration failed, rolling back user account:', userId);
        try {
          await supabase
            .from('user_accounts')
            .delete()
            .eq('id', userId);
          console.log('User account rolled back successfully');
        } catch (rollbackError) {
          console.error('Failed to rollback user account:', rollbackError);
        }
      }
      
      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Login with display name and password
   * @param displayName - User's display name
   * @param password - User's password
   * @returns AuthResult with user and session
   */
  async login(displayName: string, password: string): Promise<AuthResult> {
    if (!supabase) {
      throw new Error('Supabase not configured. Running in offline mode.');
    }

    // Find user by display name
    const { data: userData, error: userError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('display_name', displayName)
      .single();

    if (userError || !userData) {
      throw new Error('Invalid display name or password');
    }

    // Verify password
    const { data: verifyData, error: verifyError } = await supabase
      .rpc('verify_password', {
        password,
        password_hash: userData.password_hash,
      });

    if (verifyError || !verifyData) {
      throw new Error('Invalid display name or password');
    }

    // Create session
    const session = await this.createSession(userData.id);

    // Store session locally
    await this.storeSession(session);

    const user: User = {
      id: userData.id,
      displayName: userData.display_name,
      createdAt: userData.created_at,
      age: userData.age,
      modeList: userData.mode_list,
      tripHistoryIds: userData.trip_history_ids,
    };

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

    return { user, session };
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }

  /**
   * Get current session from local storage
   * @returns Session or null if not logged in
   */
  async getSession(): Promise<Session | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(SESSION_KEY);
      if (!sessionJson) {
        return null;
      }

      const session: Session = JSON.parse(sessionJson);

      // Check if session is expired
      if (Date.now() >= session.expiresAt) {
        // Try to refresh session
        return await this.refreshSession(session);
      }

      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Get current user from local storage
   * @returns User or null if not logged in
   */
  async getUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (!userJson) {
        return null;
      }

      return JSON.parse(userJson);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Check if display name is available
   * @param displayName - Display name to check
   * @returns true if available, false if taken
   */
  async isDisplayNameAvailable(displayName: string): Promise<boolean> {
    if (!supabase) {
      throw new Error('Supabase not configured. Running in offline mode.');
    }

    const { data, error } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('display_name', displayName)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check display name: ${error.message}`);
    }

    return data === null;
  }

  /**
   * Update user profile (age, mode_list)
   * @param userId - User ID
   * @param profile - Profile data to update
   */
  async updateProfile(userId: string, profile: { age?: number; modeList?: string[] }): Promise<User> {
    if (!supabase) {
      throw new Error('Supabase not configured. Running in offline mode.');
    }

    const updateData: any = {};
    if (profile.age !== undefined) {
      updateData.age = profile.age;
    }
    if (profile.modeList !== undefined) {
      updateData.mode_list = profile.modeList;
    }

    const { data, error } = await supabase
      .from('user_accounts')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    const user: User = {
      id: data.id,
      displayName: data.display_name,
      createdAt: data.created_at,
      age: data.age,
      modeList: data.mode_list,
      tripHistoryIds: data.trip_history_ids,
    };

    // Update local storage
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

    return user;
  }

  /**
   * Delete user account and all associated data
   * @param userId - User ID to delete
   */
  async deleteAccount(userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured. Running in offline mode.');
    }

    // Verify current user
    const session = await this.getSession();
    if (!session || session.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete another user\'s account');
    }

    // Delete user account from server (cascade will delete all related data)
    const { error } = await supabase
      .from('user_accounts')
      .delete()
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to delete account: ${error.message}`);
    }

    // Clear user's data from local storage
    // Note: We need to filter out only this user's data, not all data
    try {
      // Get all trips and filter out the deleted user's trips
      const tripsJson = await AsyncStorage.getItem('@rolltracks:trips');
      if (tripsJson) {
        const allTrips = JSON.parse(tripsJson);
        const remainingTrips = allTrips.filter((trip: any) => trip.user_id !== userId);
        await AsyncStorage.setItem('@rolltracks:trips', JSON.stringify(remainingTrips));
      }

      // Get all rated features and filter out the deleted user's features
      const featuresJson = await AsyncStorage.getItem('@rolltracks:rated_features');
      if (featuresJson) {
        const allFeatures = JSON.parse(featuresJson);
        // Get user's trip IDs to filter features
        const tripsJson = await AsyncStorage.getItem('@rolltracks:trips');
        const allTrips = tripsJson ? JSON.parse(tripsJson) : [];
        const userTripIds = allTrips
          .filter((trip: any) => trip.user_id === userId)
          .map((trip: any) => trip.id);
        const remainingFeatures = allFeatures.filter(
          (feature: any) => !userTripIds.includes(feature.tripId)
        );
        await AsyncStorage.setItem('@rolltracks:rated_features', JSON.stringify(remainingFeatures));
      }

      // Clear sync queue items for this user
      const queueJson = await AsyncStorage.getItem('@rolltracks:sync_queue');
      if (queueJson) {
        const allQueueItems = JSON.parse(queueJson);
        const remainingQueueItems = allQueueItems.filter((item: any) => item.userId !== userId);
        await AsyncStorage.setItem('@rolltracks:sync_queue', JSON.stringify(remainingQueueItems));
      }

      // Clear profile if it belongs to this user
      const profileJson = await AsyncStorage.getItem('@rolltracks:profile');
      if (profileJson) {
        const profile = JSON.parse(profileJson);
        if (profile.user_id === userId) {
          await AsyncStorage.removeItem('@rolltracks:profile');
        }
      }

      // Clear session and user data
      await AsyncStorage.multiRemove([
        SESSION_KEY,
        USER_KEY,
        '@rolltracks:active_trip',
        '@rolltracks:gps_points',
      ]);
    } catch (storageError) {
      console.error('Error cleaning up local storage after account deletion:', storageError);
      // Continue even if local cleanup fails - server data is already deleted
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Create a new session for a user
   * @param userId - User ID
   * @returns Session object
   */
  private async createSession(userId: string): Promise<Session> {
    const accessToken = this.generateToken();
    const refreshToken = this.generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    return {
      accessToken,
      refreshToken,
      expiresAt,
      userId,
    };
  }

  /**
   * Store session in local storage
   * @param session - Session to store
   */
  private async storeSession(session: Session): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Refresh an expired session
   * @param session - Expired session
   * @returns New session or null if refresh fails
   */
  private async refreshSession(session: Session): Promise<Session | null> {
    try {
      // Create new session
      const newSession = await this.createSession(session.userId);
      await this.storeSession(newSession);
      return newSession;
    } catch (error) {
      console.error('Error refreshing session:', error);
      await this.logout();
      return null;
    }
  }

  /**
   * Generate a random token
   * @returns Random token string
   */
  private generateToken(): string {
    // Generate a random token
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}-${randomPart2}`;
  }
}
