import AsyncStorage from '@react-native-async-storage/async-storage';
import argon2 from '@sphereon/react-native-argon2';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

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
  /**
   * Register a new anonymous user with recovery credentials.
   * Creates a Supabase anonymous user (random UUID) and stores recovery credentials
   * (username + argon2-hashed password) server-side in account_recovery table.
   * The Supabase SDK automatically manages JWT tokens in AsyncStorage.
   * Includes captchaToken for Cloudflare Turnstile verification.
   */
  register(params: {
    username: string;
    displayName: string;
    age: number;
    password: string;
    modeList: string[];
    captchaToken?: string;
  }): Promise<UserProfile>;

  /**
   * Log in via recovery credentials (username + password) from any device.
   * On device recovery, correct credentials trigger data migration: all trips and ratings
   * are copied to a newly created anonymous user. No encrypted backups are stored—the
   * recovery credentials simply prove ownership for data transfer between anonymous accounts.
   * Includes optional captchaToken for verification after failed login attempts.
   */
  login(username: string, password: string, captchaToken?: string): Promise<UserProfile>;

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

  /** Check if a display name is available (not already taken) */
  checkDisplayNameAvailability(displayName: string): Promise<boolean>;
}

// --- Data Types ---

export type TimeOfDayBin = 'late_night' | 'early_morning' | 'morning_rush' | 'midday' | 'evening_rush' | 'evening' | 'night';

export interface Trip {
  tripId: string;
  userId: string;
  mode: string;
  comfort: number;
  purpose: string;
  timeOfDay: TimeOfDayBin; // Binned time of day
  weekday: number; // 1 for weekdays, 0 for weekends/holidays
  durationS?: number;
  distanceMi?: number;
  status: 'active' | 'paused' | 'completed';
  reachedDest?: boolean; // Whether user reported reaching their destination
  geometry: string; // Encoded polyline string (Mapbox Polyline format)
  relativeTimes?: number[]; // Relative timestamps (seconds from trip start) for each coordinate - enables speed analysis
  odGeoids?: [string, string] | null; // [origin_geoid, destination_geoid] for clipped blocks
  odBlockPolygons?: [GeoJSON.Polygon, GeoJSON.Polygon] | null; // Block geometries for display
  featuresRated?: number; // DataRanger mode: count of rated features
  segmentsCorrected?: number; // DataRanger mode: count of corrected segments
  devicePlatform?: string; // Device platform (ios, android, web)
  deviceOsVersion?: string; // OS version (e.g., "iOS 17.2", "Android 14")
  appVersion?: string; // App version from package.json
}

export interface RatedFeature {
  id?: string;
  userId: string;
  tripId: string;
  crisId: string;
  conditionScore: number;
  userRating: number;
  lat: number;
  long: number;
  timeStamp: string;
}

export interface CorrectedSegment {
  id?: string;
  userId: string;
  tripId: string;
  correctedSegmentId: string;
  userReportedMaterial: string;
  geometry: GeoJSON.LineString;
  timeStamp: string;
}

export interface TripSummary {
  tripId: string;
  mode: string;
  purpose: string;
  timeOfDay: TimeOfDayBin;
  weekday: number;
  durationS: number;
  distanceMi: number;
  reachedDest?: boolean;
  ratingCount?: number;
  correctionCount?: number;
}

export interface IDataService {
  // --- Trip Operations ---
  /** Write a new trip to the database (accepts startTime for binning, not stored) */
  writeTrip(tripData: Omit<Trip, 'tripId' | 'timeOfDay' | 'weekday'> & { startTime: string }): Promise<Trip>;

  /** Update an existing trip (e.g., status, end_time, duration) */
  updateTrip(tripId: string, updates: Partial<Trip>): Promise<Trip>;

  /** Get a specific trip by ID */
  getTrip(tripId: string): Promise<Trip | null>;

  /** Get all trips for the current user, ordered by start_time desc */
  getUserTrips(): Promise<Trip[]>;

  /** Get trip summaries for history display */
  getTripSummaries(): Promise<TripSummary[]>;

  /** Delete a trip and all associated ratings/corrections */
  deleteTrip(tripId: string): Promise<void>;

  // --- Rating Operations ---
  /** Write a feature rating */
  writeRating(rating: Omit<RatedFeature, 'id'>): Promise<RatedFeature>;

  /** Get all ratings for a specific trip */
  getRatingsForTrip(tripId: string): Promise<RatedFeature[]>;

  /** Get all ratings for the current user */
  getUserRatings(): Promise<RatedFeature[]>;

  // --- Correction Operations ---
  /** Write a segment correction */
  writeCorrection(correction: Omit<CorrectedSegment, 'id'>): Promise<CorrectedSegment>;

  /** Get all corrections for a specific trip */
  getCorrectionsForTrip(tripId: string): Promise<CorrectedSegment[]>;

  /** Get all corrections for the current user */
  getUserCorrections(): Promise<CorrectedSegment[]>;

  // --- Asset Management ---
  /** Check if local assets need updating (returns last modified timestamp from Supabase) */
  checkAssetUpdates(assetName: 'CurbRamps' | 'Sidewalks'): Promise<string | null>;
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

/**
 * Hash a password using Argon2id (recommended for password hashing).
 * Argon2id is the winner of the Password Hashing Competition and provides
 * better security than bcrypt against GPU/ASIC attacks.
 *
 * Configuration:
 * - type: argon2id (hybrid mode, resistant to both side-channel and GPU attacks)
 * - memoryCost: 65536 (64 MiB) - balanced for mobile devices
 * - timeCost: 3 iterations - provides good security without impacting UX
 * - parallelism: 4 threads
 *
 * Uses @sphereon/react-native-argon2 which provides native implementations:
 * - Android: argon2kt (official Argon2 C library binding)
 * - iOS: CatCrypto (Swift wrapper around official Argon2)
 */
async function _hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error(`Invalid password provided for hashing: ${typeof password}, value: ${password}`);
  }

  console.log('[_hashPassword] Input:', { type: typeof password, length: password.length });

  try {
    // Generate a random salt using expo-crypto (cryptographically secure)
    const saltBytes = await Crypto.getRandomBytesAsync(32); // 32 bytes for hex string
    const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const result = await argon2(password, salt, {
      hashLength: 32,
      memory: 65536, // 64 MiB
      parallelism: 4,
      mode: 'argon2id',
      iterations: 3,
    });

    console.log('[_hashPassword] Success:', { encodedLength: result.encodedHash.length });
    return result.encodedHash; // Returns the full encoded hash with salt and parameters
  } catch (error) {
    console.error('[_hashPassword] Error:', error);
    throw new Error(`Password hashing failed: ${error}`);
  }
}

/**
 * Compare a plaintext password against an Argon2 hash.
 * Parses the encoded hash to extract salt and parameters, then hashes the input
 * password with the same parameters and compares the results.
 * Also checks for legacy bcrypt hashes and rejects them.
 */
async function _verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Check if it's an Argon2 hash (starts with $argon2)
    if (hash.startsWith('$argon2')) {
      // Parse the encoded hash format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
      const parts = hash.split('$');
      if (parts.length < 6) {
        console.error('[_verifyPassword] Invalid Argon2 hash format');
        return false;
      }

      // Extract parameters from the encoded hash
      const mode = parts[1] as 'argon2d' | 'argon2i' | 'argon2id';
      const paramsStr = parts[3]; // "m=65536,t=3,p=4"
      const saltBase64 = parts[4];

      // Parse parameters
      const params = paramsStr.split(',').reduce((acc, param) => {
        const [key, value] = param.split('=');
        acc[key] = parseInt(value, 10);
        return acc;
      }, {} as Record<string, number>);

      // Decode base64 salt to hex string
      const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
      const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Hash the input password with the same parameters
      const result = await argon2(password, salt, {
        hashLength: 32, // Standard length
        memory: params.m,
        parallelism: params.p,
        mode: mode,
        iterations: params.t,
      });

      // Compare the encoded hashes
      return result.encodedHash === hash;
    }

    // Legacy bcrypt support - if you need to support old hashes during migration
    // Remove this block after all users have migrated
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      throw new Error('Legacy bcrypt hashes are no longer supported. Please reset your password.');
    }

    return false;
  } catch (error) {
    console.error('[_verifyPassword] Error:', error);
    return false;
  }
}

// --- Time Binning Utilities ---

/**
 * Bin a timestamp into a time of day category.
 * Bins:
 * - late_night:    00:00 - 05:00
 * - early_morning: 05:00 - 07:00
 * - morning_rush:  07:00 - 10:00
 * - midday:        10:00 - 16:00
 * - evening_rush:  16:00 - 19:00
 * - evening:       19:00 - 22:00
 * - night:         22:00 - 24:00
 */
function _getTimeOfDayBin(timestamp: string): TimeOfDayBin {
  const date = new Date(timestamp);
  const hour = date.getHours();

  if (hour >= 0 && hour < 5) return 'late_night';
  if (hour >= 5 && hour < 7) return 'early_morning';
  if (hour >= 7 && hour < 10) return 'morning_rush';
  if (hour >= 10 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 19) return 'evening_rush';
  if (hour >= 19 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Determine if a timestamp is a weekday or weekend/holiday.
 * Returns 1 for weekdays (Mon-Fri), 0 for weekends (Sat-Sun).
 * Note: Holiday detection not yet implemented, treats holidays as regular weekdays.
 */
function _getWeekdayBin(timestamp: string): number {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Return 1 for weekdays (Mon-Fri), 0 for weekends (Sat-Sun)
  return (dayOfWeek >= 1 && dayOfWeek <= 5) ? 1 : 0;
}

// --- Device Info Utilities ---

/**
 * Get device and app information for tracking and debugging.
 * Returns platform, OS version, and app version.
 */
function _getDeviceInfo(): {
  devicePlatform: string;
  deviceOsVersion: string;
  appVersion: string;
} {
  const platform = Platform.OS; // 'ios', 'android', 'web'
  const osVersion = Platform.Version?.toString() || 'unknown';
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return {
    devicePlatform: platform,
    deviceOsVersion: `${platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Web'} ${osVersion}`,
    appVersion,
  };
}

// --- Session ---

async function _createAnonymousSession(captchaToken?: string): Promise<Session> {
  // Skip captcha verification for test tokens or if no token provided
  const isTestToken = !captchaToken || 
                      captchaToken === 'dev-bypass-token' || 
                      captchaToken === 'test-key-always-passes-token';
  
  const { data, error } = await supabase.auth.signInAnonymously({
    options: isTestToken ? {} : {
      captchaToken,
    },
  });
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
  skipDisplayNameCheck: boolean = false,
): Promise<void> {
  // Check if display name is already taken using SECURITY DEFINER function
  // Skip this check during login (when migrating existing user data)
  if (!skipDisplayNameCheck) {
    const { data: isAvailable, error: checkError } = await supabase.rpc(
      'check_display_name_available',
      { p_display_name: profile.displayName }
    );
    
    if (checkError) {
      throw new Error(`Failed to check display name: ${checkError.message}`);
    }
    
    if (!isAvailable) {
      throw new Error('This display name is already taken. Please choose a different one.');
    }
  }

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
  passwordHash: string,
): Promise<string> {
  // Use secure SECURITY DEFINER function instead of direct INSERT
  // This prevents username enumeration and enforces validation
  const { data, error } = await supabase.rpc('create_recovery_credentials', {
    p_username: username,
    p_password_hash: passwordHash,
  });
  
  if (error || !data) {
    throw new Error(
      error?.message || 'Failed to store recovery credentials',
    );
  }
  
  return data; // Returns recovery_id UUID
}

async function _getRecoveryCredentials(
  username: string,
): Promise<{ id: string; passwordHash: string } | null> {
  // Use SECURITY DEFINER function to prevent direct table access
  // This prevents bulk scraping and username enumeration via SQL
  const { data, error } = await supabase
    .rpc('verify_login_credentials', {
      p_username: username,
    });
  
  if (error) {
    console.error('Error calling verify_login_credentials:', error);
    return null;
  }
  
  // RPC returns an array, get first result
  if (!data || data.length === 0) return null;
  
  const result = data[0];
  return { id: result.recovery_id, passwordHash: result.password_hash };
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
  console.log('[_deleteAllUserData] Starting permanent deletion for user:', userId);
  
  // Delete in dependency order: child rows first, then profile
  // All deletes are permanent and cannot be recovered
  const { error: featuresError } = await supabase
    .from('rated_features')
    .delete()
    .eq('user_id', userId);
  if (featuresError) {
    console.error('[_deleteAllUserData] Error deleting rated_features:', featuresError);
    throw new Error(`Failed to delete rated features: ${featuresError.message}`);
  }

  const { error: segmentsError } = await supabase
    .from('corrected_segments')
    .delete()
    .eq('user_id', userId);
  if (segmentsError) {
    console.error('[_deleteAllUserData] Error deleting corrected_segments:', segmentsError);
    throw new Error(`Failed to delete corrected segments: ${segmentsError.message}`);
  }

  const { error: tripsError } = await supabase
    .from('trips')
    .delete()
    .eq('user_id', userId);
  if (tripsError) {
    console.error('[_deleteAllUserData] Error deleting trips:', tripsError);
    throw new Error(`Failed to delete trips: ${tripsError.message}`);
  }

  // Remove recovery credentials and links
  const { data: links, error: linksError } = await supabase
    .from('user_recovery_links')
    .select('recovery_id')
    .eq('user_id', userId);

  if (linksError) {
    console.error('[_deleteAllUserData] Error fetching recovery links:', linksError);
    throw new Error(`Failed to fetch recovery links: ${linksError.message}`);
  }

  if (links && links.length > 0) {
    const recoveryIds = links.map((l) => l.recovery_id);
    
    const { error: linkDeleteError } = await supabase
      .from('user_recovery_links')
      .delete()
      .eq('user_id', userId);
    if (linkDeleteError) {
      console.error('[_deleteAllUserData] Error deleting recovery links:', linkDeleteError);
      throw new Error(`Failed to delete recovery links: ${linkDeleteError.message}`);
    }

    const { error: recoveryDeleteError } = await supabase
      .from('account_recovery')
      .delete()
      .in('id', recoveryIds);
    if (recoveryDeleteError) {
      console.error('[_deleteAllUserData] Error deleting recovery credentials:', recoveryDeleteError);
      throw new Error(`Failed to delete recovery credentials: ${recoveryDeleteError.message}`);
    }
  }

  // Finally, delete the user profile
  await _deleteUserProfile(userId);
  
  console.log('[_deleteAllUserData] All data permanently deleted for user:', userId);
}

// --- trips ---

/**
 * Insert a new trip into the database.
 * Accepts a startTime parameter for binning purposes (not stored).
 * Bins the startTime into timeOfDay and weekday before storage.
 */
/**
 * Insert a new trip into the database.
 * Bins the startTime into timeOfDay and weekday before storage.
 * Geometry is stored as an encoded polyline string.
 */
async function _insertTrip(
  tripData: Omit<Trip, 'tripId' | 'timeOfDay' | 'weekday'> & { startTime: string }
): Promise<Trip> {
  // Bin the startTime into time_of_day and weekday
  const timeOfDay = _getTimeOfDayBin(tripData.startTime);
  const weekday = _getWeekdayBin(tripData.startTime);

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: tripData.userId,
      mode: tripData.mode,
      comfort: tripData.comfort,
      purpose: tripData.purpose,
      time_of_day: timeOfDay,
      weekday: weekday,
      duration_s: tripData.durationS,
      distance_mi: tripData.distanceMi,
      status: tripData.status,
      reached_dest: tripData.reachedDest ?? null,
      geometry: tripData.geometry, // Store as encoded polyline string
      relative_times: tripData.relativeTimes ?? null,
      device_platform: tripData.devicePlatform,
      device_os_version: tripData.deviceOsVersion,
      app_version: tripData.appVersion,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert trip: ${error?.message}`);
  }

  return {
    tripId: data.trip_id,
    userId: data.user_id,
    mode: data.mode,
    comfort: data.comfort,
    purpose: data.purpose,
    timeOfDay: data.time_of_day,
    weekday: data.weekday,
    durationS: data.duration_s,
    distanceMi: data.distance_mi,
    status: data.status,
    reachedDest: data.reached_dest,
    geometry: data.geometry, // Return as string
    relativeTimes: data.relative_times,
    devicePlatform: data.device_platform,
    deviceOsVersion: data.device_os_version,
    appVersion: data.app_version,
  };
}

async function _updateTrip(tripId: string, updates: Partial<Trip>): Promise<Trip> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.mode !== undefined) dbUpdates.mode = updates.mode;
  if (updates.comfort !== undefined) dbUpdates.comfort = updates.comfort;
  if (updates.purpose !== undefined) dbUpdates.purpose = updates.purpose;
  if (updates.timeOfDay !== undefined) dbUpdates.time_of_day = updates.timeOfDay;
  if (updates.weekday !== undefined) dbUpdates.weekday = updates.weekday;
  if (updates.durationS !== undefined) dbUpdates.duration_s = updates.durationS;
  if (updates.distanceMi !== undefined) dbUpdates.distance_mi = updates.distanceMi;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.reachedDest !== undefined) dbUpdates.reached_dest = updates.reachedDest;
  if (updates.geometry !== undefined) dbUpdates.geometry = updates.geometry;

  const { data, error } = await supabase
    .from('trips')
    .update(dbUpdates)
    .eq('trip_id', tripId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update trip: ${error?.message}`);
  }

  return {
    tripId: data.trip_id,
    userId: data.user_id,
    mode: data.mode,
    comfort: data.comfort,
    purpose: data.purpose,
    timeOfDay: data.time_of_day,
    weekday: data.weekday,
    durationS: data.duration_s,
    distanceMi: data.distance_mi,
    status: data.status,
    reachedDest: data.reached_dest,
    geometry: data.geometry,
  };
}

/**
 * Helper function to fetch census block polygons for origin/destination display
 * @param geoids Array of [origin_geoid, destination_geoid]
 * @returns Array of [origin_polygon, destination_polygon] or null
 */
async function _getBlockPolygons(
  geoids: string[] | null,
): Promise<[GeoJSON.Polygon, GeoJSON.Polygon] | null> {
  if (!geoids || geoids.length !== 2) return null;

  const [originGeoid, destGeoid] = geoids;
  if (!originGeoid && !destGeoid) return null;

  try {
    // Fetch both blocks in a single query
    const { data, error } = await supabase
      .from('census_blocks')
      .select('geoid20, geom')
      .in('geoid20', [originGeoid, destGeoid].filter(Boolean));

    if (error || !data) return null;

    // Map geoids to polygons
    const blockMap = new Map(data.map((block) => [block.geoid20, block.geom]));

    const originPolygon = originGeoid ? blockMap.get(originGeoid) : null;
    const destPolygon = destGeoid ? blockMap.get(destGeoid) : null;

    // Return null if we couldn't find both blocks
    if (!originPolygon || !destPolygon) return null;

    return [originPolygon, destPolygon];
  } catch (error) {
    console.error('[DatabaseAdapter] Failed to fetch block polygons:', error);
    return null;
  }
}

async function _getTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('trip_id', tripId)
    .single();

  if (error || !data) return null;

  // Fetch block polygons if od_geoids is present
  const odBlockPolygons = await _getBlockPolygons(data.od_geoids);

  return {
    tripId: data.trip_id,
    userId: data.user_id,
    mode: data.mode,
    comfort: data.comfort,
    purpose: data.purpose,
    timeOfDay: data.time_of_day,
    weekday: data.weekday,
    durationS: data.duration_s,
    distanceMi: data.distance_mi,
    status: data.status,
    reachedDest: data.reached_dest,
    geometry: data.geometry,
    relativeTimes: data.relative_times,
    odGeoids: data.od_geoids,
    odBlockPolygons,
    devicePlatform: data.device_platform,
    deviceOsVersion: data.device_os_version,
    appVersion: data.app_version,
  };
}

async function _getUserTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('trip_id', { ascending: false }); // Order by trip_id (contains timestamp)

  if (error) {
    throw new Error(`Failed to fetch trips: ${error.message}`);
  }

  // Fetch block polygons for all trips with od_geoids
  const tripsWithBlocks = await Promise.all(
    (data || []).map(async (row) => {
      const odBlockPolygons = await _getBlockPolygons(row.od_geoids);
      
      return {
        tripId: row.trip_id,
        userId: row.user_id,
        mode: row.mode,
        comfort: row.comfort,
        purpose: row.purpose,
        timeOfDay: row.time_of_day,
        weekday: row.weekday,
        durationS: row.duration_s,
        distanceMi: row.distance_mi,
        status: row.status,
        reachedDest: row.reached_dest,
        geometry: row.geometry,
        relativeTimes: row.relative_times,
        odGeoids: row.od_geoids,
        odBlockPolygons,
        devicePlatform: row.device_platform,
        deviceOsVersion: row.device_os_version,
        appVersion: row.app_version,
      };
    }),
  );

  return tripsWithBlocks;
}

async function _getTripSummaries(userId: string): Promise<TripSummary[]> {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('trip_id, mode, purpose, time_of_day, weekday, duration_s, distance_mi, reached_dest')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('trip_id', { ascending: false }); // Order by trip_id (contains timestamp)

  if (error) {
    throw new Error(`Failed to fetch trip summaries: ${error.message}`);
  }

  if (!trips || trips.length === 0) return [];

  // Fetch rating and correction counts for all trips
  const tripIds = trips.map((t) => t.trip_id);

  const { data: ratingCounts } = await supabase
    .from('rated_features')
    .select('trip_id')
    .in('trip_id', tripIds);

  const { data: correctionCounts } = await supabase
    .from('corrected_segments')
    .select('trip_id')
    .in('trip_id', tripIds);

  // Count by trip_id
  const ratingsByTrip = (ratingCounts || []).reduce(
    (acc, r) => {
      acc[r.trip_id] = (acc[r.trip_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const correctionsByTrip = (correctionCounts || []).reduce(
    (acc, c) => {
      acc[c.trip_id] = (acc[c.trip_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return trips.map((t) => ({
    tripId: t.trip_id,
    mode: t.mode,
    purpose: t.purpose,
    timeOfDay: t.time_of_day,
    weekday: t.weekday,
    durationS: t.duration_s,
    distanceMi: t.distance_mi,
    reachedDest: t.reached_dest,
    ratingCount: ratingsByTrip[t.trip_id] || 0,
    correctionCount: correctionsByTrip[t.trip_id] || 0,
  }));
}

async function _deleteTrip(tripId: string): Promise<void> {
  // Delete child records first
  await supabase.from('rated_features').delete().eq('trip_id', tripId);
  await supabase.from('corrected_segments').delete().eq('trip_id', tripId);

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('trip_id', tripId);

  if (error) {
    throw new Error(`Failed to delete trip: ${error.message}`);
  }
}

// --- rated_features ---

async function _insertRating(rating: Omit<RatedFeature, 'id'>): Promise<RatedFeature> {
  const { data, error } = await supabase
    .from('rated_features')
    .insert({
      user_id: rating.userId,
      trip_id: rating.tripId,
      cris_id: rating.crisId,
      condition_score: rating.conditionScore,
      user_rating: rating.userRating,
      lat: rating.lat,
      long: rating.long,
      time_stamp: rating.timeStamp,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert rating: ${error?.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    tripId: data.trip_id,
    crisId: data.cris_id,
    conditionScore: data.condition_score,
    userRating: data.user_rating,
    lat: data.lat,
    long: data.long,
    timeStamp: data.time_stamp,
  };
}

async function _getRatingsForTrip(tripId: string): Promise<RatedFeature[]> {
  const { data, error } = await supabase
    .from('rated_features')
    .select('*')
    .eq('trip_id', tripId)
    .order('time_stamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch ratings: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    crisId: row.cris_id,
    conditionScore: row.condition_score,
    userRating: row.user_rating,
    lat: row.lat,
    long: row.long,
    timeStamp: row.time_stamp,
  }));
}

async function _getUserRatings(userId: string): Promise<RatedFeature[]> {
  const { data, error } = await supabase
    .from('rated_features')
    .select('*')
    .eq('user_id', userId)
    .order('time_stamp', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user ratings: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    crisId: row.cris_id,
    conditionScore: row.condition_score,
    userRating: row.user_rating,
    lat: row.lat,
    long: row.long,
    timeStamp: row.time_stamp,
  }));
}

// --- corrected_segments ---

async function _insertCorrection(correction: Omit<CorrectedSegment, 'id'>): Promise<CorrectedSegment> {
  const { data, error } = await supabase
    .from('corrected_segments')
    .insert({
      user_id: correction.userId,
      trip_id: correction.tripId,
      corrected_segment_id: correction.correctedSegmentId,
      user_reported_material: correction.userReportedMaterial,
      geometry: correction.geometry,
      time_stamp: correction.timeStamp,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert correction: ${error?.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    tripId: data.trip_id,
    correctedSegmentId: data.corrected_segment_id,
    userReportedMaterial: data.user_reported_material,
    geometry: data.geometry,
    timeStamp: data.time_stamp,
  };
}

async function _getCorrectionsForTrip(tripId: string): Promise<CorrectedSegment[]> {
  const { data, error } = await supabase
    .from('corrected_segments')
    .select('*')
    .eq('trip_id', tripId)
    .order('time_stamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch corrections: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    correctedSegmentId: row.corrected_segment_id,
    userReportedMaterial: row.user_reported_material,
    geometry: row.geometry,
    timeStamp: row.time_stamp,
  }));
}

async function _getUserCorrections(userId: string): Promise<CorrectedSegment[]> {
  const { data, error } = await supabase
    .from('corrected_segments')
    .select('*')
    .eq('user_id', userId)
    .order('time_stamp', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user corrections: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    correctedSegmentId: row.corrected_segment_id,
    userReportedMaterial: row.user_reported_material,
    geometry: row.geometry,
    timeStamp: row.time_stamp,
  }));
}

// --- asset_metadata (optional table for tracking asset versions) ---

async function _getAssetMetadata(assetName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('asset_metadata')
    .select('last_updated')
    .eq('asset_name', assetName)
    .single();

  if (error || !data) return null;
  return data.last_updated;
}

// ═══════════════════════════════════════════════════════════
// AUTH SERVICE MODULE (Public API)
// Two-layer authentication system combining local device security
// with Supabase anonymous authentication.
// Called by Auth Stack screens via AuthContext.
//
// AUTHENTICATION FLOW:
// 1. First time on device: User calls register() to create account
//    - Creates Supabase anonymous user (session persists in AsyncStorage)
//    - Stores recovery credentials server-side for multi-device access
// 2. Returning on same device: Session restores automatically on app launch
//    - Supabase SDK handles this via AsyncStorage
//    - getCurrentUser() returns profile if session exists
// 3. After logout on same device: User calls login() to re-authenticate
//    - Verifies credentials server-side
//    - If profile exists for this session, just returns it (no migration)
//    - Session was preserved, so no new anonymous user created
// 4. New device with existing account: User calls login() for multi-device recovery
//    - Verifies credentials server-side
//    - Creates new anonymous user and migrates all data
//
// LOGOUT BEHAVIOR:
// - logout() clears local auth state in AuthContext only
// - Does NOT call supabase.auth.signOut() - session persists
// - Use this when switching users on a shared device
// - Original user can log back in with credentials without creating new profile
// ═══════════════════════════════════════════════════════════

export const AuthService: IAuthService = {
  async register(params: {
    username: string;
    displayName: string;
    age: number;
    password: string;
    modeList: string[];
    captchaToken?: string;
  }) {
    const { username, displayName, age, password, modeList, captchaToken } = params;
    
    console.log('AuthService.register called with:', { 
      username, 
      displayName, 
      age, 
      passwordType: typeof password,
      passwordValue: password,
      modeList, 
      captchaToken 
    });
    
    // 1. Create anonymous Supabase session (generates random UUID) with captcha verification
    const session = await _createAnonymousSession(captchaToken);
    const userId = session.user.id;

    // 2. Hash the password using Argon2id
    console.log('About to hash password, type:', typeof password, 'value:', password);
    const passwordHash = await _hashPassword(password);

    // 3. Create user profile with hashed password
    // This will throw an error if display name is already taken
    try {
      await _insertUserProfile(userId, {
        displayName,
        age,
        modeList,
        passwordHash,
      });
    } catch (error: any) {
      // Clean up the anonymous session if profile creation fails
      await supabase.auth.signOut();
      throw error;
    }

    // 4. Store recovery credentials (username + password hash) server-side
    // This also creates the user_recovery_link automatically
    try {
      const recoveryId = await _insertRecoveryCredentials(username, passwordHash);
    } catch (error: any) {
      // Clean up profile and session if recovery credentials fail
      await _deleteUserProfile(userId);
      await supabase.auth.signOut();
      throw error;
    }

    // NOTE: Per architecture spec, username and hashed password should also be
    // stored locally in secure storage for local device access control.
    // This is currently handled by AuthContext or should be implemented there.

    return { id: userId, displayName, age, modeList, dataRangerMode: false };
  },

  async login(username, password, captchaToken) {
    console.log('[login] Starting login for username:', username);
    
    // 1. Look up recovery credentials by username
    const recovery = await _getRecoveryCredentials(username);
    if (!recovery) {
      console.log('[login] No recovery credentials found');
      throw new Error('Username not found.');
    }
    console.log('[login] Found recovery credentials, recovery_id:', recovery.id);

    // 2. Verify password using Argon2 comparison
    const isValid = await _verifyPassword(password, recovery.passwordHash);
    if (!isValid) {
      console.log('[login] Password verification failed');
      throw new Error('Incorrect password.');
    }
    console.log('[login] Password verified successfully');

    // 3. Get the user ID linked to these credentials
    const linkedUserId = await _getLinkedUserId(recovery.id);
    if (!linkedUserId) {
      console.log('[login] No user_recovery_link found for recovery_id:', recovery.id);
      throw new Error('No account linked to this username.');
    }
    console.log('[login] Found linked user_id:', linkedUserId);

    // 4. Check if we have an existing session (same device scenario)
    const existingSession = await _getSession();
    
    if (existingSession) {
      console.log('[login] Existing session found, session user_id:', existingSession.user.id);
      
      // Check if this session belongs to the user trying to log in
      if (existingSession.user.id === linkedUserId) {
        console.log('[login] Same device re-login - session matches user');
        
        const profile = await _getUserProfile(linkedUserId);
        if (!profile) {
          throw new Error('Profile not found for existing session.');
        }
        return profile;
      } else {
        console.log('[login] Different user logging in - need to switch sessions');
        // Different user on same device - sign out current session first
        await supabase.auth.signOut();
      }
    }

    // 5. No matching session - need to create new one and migrate data
    console.log('[login] No matching session - performing multi-device recovery');
    
    // Get the existing profile data
    const existingProfile = await _getUserProfile(linkedUserId);
    if (!existingProfile) {
      console.log('[login] ERROR: Profile not found for user_id:', linkedUserId);
      throw new Error('Account data not found. Please contact support.');
    }
    console.log('[login] Found existing profile for:', existingProfile.displayName);

    // Create new anonymous session (generates new UUID)
    const session = await _createAnonymousSession(captchaToken);
    const newUserId = session.user.id;
    console.log('[login] Created new session with user_id:', newUserId);

    // Migrate all data from old user to new user
    console.log('[login] Migrating data from', linkedUserId, 'to', newUserId);
    await _migrateUserData(linkedUserId, newUserId);

    // Create new profile with same data
    await _insertUserProfile(
      newUserId,
      {
        displayName: existingProfile.displayName,
        age: existingProfile.age,
        modeList: existingProfile.modeList,
        passwordHash: recovery.passwordHash,
      },
      true, // Skip display name check since we're migrating existing profile
    );
    console.log('[login] Created new profile');

    // Update recovery link to point to new user
    await _updateRecoveryLink(recovery.id, newUserId);
    console.log('[login] Updated recovery link');

    // Delete old profile (cleanup)
    await _deleteUserProfile(linkedUserId);
    console.log('[login] Deleted old profile');

    console.log('[login] Multi-device recovery completed successfully');
    return {
      id: newUserId,
      displayName: existingProfile.displayName,
      age: existingProfile.age,
      modeList: existingProfile.modeList,
      dataRangerMode: existingProfile.dataRangerMode,
    };
  },

  async getCurrentUser() {
    try {
      const session = await _getSession();
      if (!session) return null;
      return _getUserProfile(session.user.id);
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  },

  async logout() {
    // NOTE: We do NOT call supabase.auth.signOut() here
    // This preserves the session in AsyncStorage so the user can log back in
    // on the same device without creating a new profile.
    // The AuthContext will clear its local state, which is sufficient for
    // switching users on a shared device.
    console.log('[logout] Clearing local auth state (session preserved)');
    // No-op at adapter level - AuthContext handles state clearing
  },

  async deleteUserData() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    console.log('[deleteUserData] Permanently deleting all user data and session');
    await _deleteAllUserData(session.user.id);
    // NOW we destroy the session since user is deleting their account
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

  async checkDisplayNameAvailability(displayName: string) {
    // Use SECURITY DEFINER function to bypass RLS and check all display names
    const { data, error } = await supabase.rpc('check_display_name_available', {
      p_display_name: displayName,
    });
    
    if (error) {
      throw new Error(`Failed to check display name: ${error.message}`);
    }
    
    // RPC returns boolean: true if available, false if taken
    return data === true;
  },
};

// ═══════════════════════════════════════════════════════════
// DATA SERVICE MODULE (Public API)
// Called by Main Stack screens via services.
// ═══════════════════════════════════════════════════════════

export const DataService: IDataService = {
  // --- Trip Operations ---

  async writeTrip(tripData) {
    return _insertTrip(tripData);
  },

  async updateTrip(tripId, updates) {
    return _updateTrip(tripId, updates);
  },

  async getTrip(tripId) {
    return _getTrip(tripId);
  },

  async getUserTrips() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    return _getUserTrips(session.user.id);
  },

  async getTripSummaries() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    return _getTripSummaries(session.user.id);
  },

  async deleteTrip(tripId) {
    return _deleteTrip(tripId);
  },

  // --- Rating Operations ---

  async writeRating(rating) {
    return _insertRating(rating);
  },

  async getRatingsForTrip(tripId) {
    return _getRatingsForTrip(tripId);
  },

  async getUserRatings() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    return _getUserRatings(session.user.id);
  },

  // --- Correction Operations ---

  async writeCorrection(correction) {
    return _insertCorrection(correction);
  },

  async getCorrectionsForTrip(tripId) {
    return _getCorrectionsForTrip(tripId);
  },

  async getUserCorrections() {
    const session = await _getSession();
    if (!session) throw new Error('No active session.');
    return _getUserCorrections(session.user.id);
  },

  // --- Asset Management ---

  async checkAssetUpdates(assetName) {
    return _getAssetMetadata(assetName);
  },
};
