import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// ═══════════════════════════════════════════════════════════
// DATABASE ADAPTER — PUBLIC INTERFACES
// ═══════════════════════════════════════════════════════════
// These interfaces define the contract that services and views depend on.
// To switch databases, create a new adapter implementing these same
// interfaces. No other components need modification.

export interface UserProfile {
  id: string;
  displayName: string;
  age: number;
  modeList: string[];
  dataRangerMode: boolean;
}

export interface IAuthService {
  /** Register a new anonymous user with recovery credentials */
  register(params: {
    username: string;
    displayName: string;
    age: number;
    pin: string;
    modeList: string[];
  }): Promise<UserProfile>;

  /** Log in via recovery credentials (username + PIN) from any device */
  login(username: string, pin: string): Promise<UserProfile>;

  /** Get the current user's profile, or null if not authenticated */
  getCurrentUser(): Promise<UserProfile | null>;

  /** Sign out the current user */
  logout(): Promise<void>;

  /** Delete all data associated with the current user */
  deleteUserData(): Promise<void>;

  /** Update editable profile fields */
  updateProfile(
    updates: Partial<Pick<UserProfile, 'displayName' | 'age' | 'modeList' | 'dataRangerMode'>>,
  ): Promise<UserProfile>;

  /** Toggle DataRanger mode on/off, returns the new value */
  toggleDataRangerMode(): Promise<boolean>;
}

export interface IDataService {
  // TODO: Implement for main stack screens
  // - Write trip data (Trip Service)
  // - Read trip data (History Service)
  // - Write ratings/corrections (DataRanger Service)
  // - Check asset updates
}

// ═══════════════════════════════════════════════════════════
// SUPABASE CLIENT (Private)
// ═══════════════════════════════════════════════════════════

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ═══════════════════════════════════════════════════════════
// PRIVATE SUPABASE FUNCTIONS
// Low-level functions that interact directly with Supabase.
// Public module functions call these — never Supabase directly.
// ═══════════════════════════════════════════════════════════

// --- Utilities ---

async function _hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

// --- Session ---

async function _createAnonymousSession(): Promise<Session> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(error?.message ?? 'Failed to create anonymous session.');
  }
  return data.session;
}

async function _getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// --- user_profiles ---

async function _insertUserProfile(
  userId: string,
  profile: {
    displayName: string;
    passwordHash: string;
    age: number;
    modeList: string[];
  },
): Promise<void> {
  const { error } = await supabase.from('user_profiles').insert({
    id: userId,
    display_name: profile.displayName,
    password_hash: profile.passwordHash,
    age: profile.age,
    mode_list: profile.modeList,
    dataranger_mode: false,
  });
  if (error) throw new Error(`Failed to create profile: ${error.message}`);
}

async function _getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    age: data.age,
    modeList: data.mode_list,
    dataRangerMode: data.dataranger_mode,
  };
}

async function _updateUserProfile(
  userId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw new Error(`Failed to update profile: ${error.message}`);
}

async function _deleteUserProfile(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId);
  if (error) throw new Error(`Failed to delete profile: ${error.message}`);
}

// --- account_recovery ---

async function _insertRecoveryCredentials(
  username: string,
  pinHash: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('account_recovery')
    .insert({ username, pin_hash: pinHash })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to store recovery credentials: ${error?.message}`,
    );
  }
  return data.id;
}

async function _getRecoveryCredentials(
  username: string,
): Promise<{ id: string; pinHash: string } | null> {
  const { data, error } = await supabase
    .from('account_recovery')
    .select('id, pin_hash')
    .eq('username', username)
    .single();
  if (error || !data) return null;
  return { id: data.id, pinHash: data.pin_hash };
}

// --- user_recovery_links ---

async function _linkRecoveryToUser(
  recoveryId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_recovery_links')
    .insert({ recovery_id: recoveryId, user_id: userId });
  if (error) throw new Error(`Failed to link recovery: ${error.message}`);
}

async function _getLinkedUserId(recoveryId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_recovery_links')
    .select('user_id')
    .eq('recovery_id', recoveryId)
    .single();
  if (error || !data) return null;
  return data.user_id;
}

async function _updateRecoveryLink(
  recoveryId: string,
  newUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_recovery_links')
    .update({ user_id: newUserId })
    .eq('recovery_id', recoveryId);
  if (error)
    throw new Error(`Failed to update recovery link: ${error.message}`);
}

// --- Data migration ---

async function _migrateUserData(
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  // Migrate trips
  const { data: trips, error: tripsErr } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', fromUserId);
  if (tripsErr)
    throw new Error(`Failed to read trips for migration: ${tripsErr.message}`);

  if (trips && trips.length > 0) {
    const migrated = trips.map(({ trip_id: _id, ...rest }) => ({
      ...rest,
      user_id: toUserId,
    }));
    const { error } = await supabase.from('trips').insert(migrated);
    if (error) throw new Error(`Failed to migrate trips: ${error.message}`);
  }

  // Migrate rated features
  const { data: ratings, error: ratingsErr } = await supabase
    .from('rated_features')
    .select('*')
    .eq('user_id', fromUserId);
  if (ratingsErr)
    throw new Error(
      `Failed to read ratings for migration: ${ratingsErr.message}`,
    );

  if (ratings && ratings.length > 0) {
    const migrated = ratings.map(({ id: _id, ...rest }) => ({
      ...rest,
      user_id: toUserId,
    }));
    const { error } = await supabase.from('rated_features').insert(migrated);
    if (error) throw new Error(`Failed to migrate ratings: ${error.message}`);
  }

  // Migrate corrected segments
  const { data: corrections, error: correctionsErr } = await supabase
    .from('corrected_segments')
    .select('*')
    .eq('user_id', fromUserId);
  if (correctionsErr)
    throw new Error(
      `Failed to read corrections for migration: ${correctionsErr.message}`,
    );

  if (corrections && corrections.length > 0) {
    const migrated = corrections.map(({ id: _id, ...rest }) => ({
      ...rest,
      user_id: toUserId,
    }));
    const { error } = await supabase
      .from('corrected_segments')
      .insert(migrated);
    if (error)
      throw new Error(`Failed to migrate corrections: ${error.message}`);
  }
}

// --- Cleanup ---

async function _deleteAllUserData(userId: string): Promise<void> {
  // Delete in dependency order: child rows first, then profile
  await supabase.from('rated_features').delete().eq('user_id', userId);
  await supabase.from('corrected_segments').delete().eq('user_id', userId);
  await supabase.from('trips').delete().eq('user_id', userId);

  // Remove recovery credentials and links
  const { data: links } = await supabase
    .from('user_recovery_links')
    .select('recovery_id')
    .eq('user_id', userId);

  if (links && links.length > 0) {
    const recoveryIds = links.map((l) => l.recovery_id);
    await supabase
      .from('user_recovery_links')
      .delete()
      .eq('user_id', userId);
    await supabase.from('account_recovery').delete().in('id', recoveryIds);
  }

  await _deleteUserProfile(userId);
}

// ═══════════════════════════════════════════════════════════
// AUTH SERVICE MODULE (Public API)
// Called by Auth Stack screens via AuthContext.
// ═══════════════════════════════════════════════════════════

export const AuthService: IAuthService = {
  async register({ username, displayName, age, pin, modeList }) {
    // 1. Create anonymous Supabase session
    const session = await _createAnonymousSession();
    const userId = session.user.id;

    // 2. Hash the PIN
    const pinHash = await _hashPin(pin);

    // 3. Create user profile
    await _insertUserProfile(userId, {
      displayName,
      age,
      modeList,
      passwordHash: pinHash,
    });

    // 4. Store recovery credentials
    const recoveryId = await _insertRecoveryCredentials(username, pinHash);

    // 5. Link recovery record to this anonymous user
    await _linkRecoveryToUser(recoveryId, userId);

    return { id: userId, displayName, age, modeList, dataRangerMode: false };
  },

  async login(username, pin) {
    // 1. Look up recovery credentials by username
    const recovery = await _getRecoveryCredentials(username);
    if (!recovery) throw new Error('Username not found.');

    // 2. Verify PIN
    const pinHash = await _hashPin(pin);
    if (pinHash !== recovery.pinHash) throw new Error('Incorrect PIN.');

    // 3. Get the user ID linked to these credentials
    const previousUserId = await _getLinkedUserId(recovery.id);
    if (!previousUserId)
      throw new Error('No account linked to this username.');

    // 4. Load previous profile
    const oldProfile = await _getUserProfile(previousUserId);
    if (!oldProfile) throw new Error('User profile not found.');

    // 5. Create a new anonymous session on this device
    const session = await _createAnonymousSession();
    const newUserId = session.user.id;

    // 6. Migrate all data from previous user to new user
    await _migrateUserData(previousUserId, newUserId);

    // 7. Create profile for the new anonymous user
    await _insertUserProfile(newUserId, {
      displayName: oldProfile.displayName,
      age: oldProfile.age,
      modeList: oldProfile.modeList,
      passwordHash: pinHash,
    });

    // 8. Point recovery link to the new user
    await _updateRecoveryLink(recovery.id, newUserId);

    // 9. Clean up old profile
    await _deleteUserProfile(previousUserId);

    return {
      id: newUserId,
      displayName: oldProfile.displayName,
      age: oldProfile.age,
      modeList: oldProfile.modeList,
      dataRangerMode: oldProfile.dataRangerMode,
    };
  },

  async getCurrentUser() {
    const session = await _getSession();
    if (!session) return null;
    return _getUserProfile(session.user.id);
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Logout failed: ${error.message}`);
  },

  async deleteUserData() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    await _deleteAllUserData(session.user.id);
    await supabase.auth.signOut();
  },

  async updateProfile(updates) {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    const userId = session.user.id;

    // Map camelCase fields to snake_case column names
    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined)
      dbUpdates.display_name = updates.displayName;
    if (updates.age !== undefined) dbUpdates.age = updates.age;
    if (updates.modeList !== undefined)
      dbUpdates.mode_list = updates.modeList;
    if (updates.dataRangerMode !== undefined)
      dbUpdates.dataranger_mode = updates.dataRangerMode;

    await _updateUserProfile(userId, dbUpdates);

    const profile = await _getUserProfile(userId);
    if (!profile) throw new Error('Profile not found after update.');
    return profile;
  },

  async toggleDataRangerMode() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    const userId = session.user.id;

    const profile = await _getUserProfile(userId);
    if (!profile) throw new Error('Profile not found.');

    const newMode = !profile.dataRangerMode;
    await _updateUserProfile(userId, { dataranger_mode: newMode });
    return newMode;
  },
};

// ═══════════════════════════════════════════════════════════
// DATA SERVICE MODULE (Public API) — Placeholder
// Called by Main Stack screens via services.
// ═══════════════════════════════════════════════════════════

export const DataService: IDataService = {
  // TODO: Implement for main stack screens
  // - Write trip data (Trip Service)
  // - Read trip data (History Service)
  // - Write ratings/corrections (DataRanger Service)
  // - Check asset updates
};
