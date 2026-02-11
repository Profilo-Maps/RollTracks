import * as polyline from '@mapbox/polyline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Trip } from '../adapters/DatabaseAdapter';
import { GPSCoordinate, NativeAdapter, NativeAdapterError } from '../adapters/NativeAdapter';
import { SyncService } from './SyncService';

// ═══════════════════════════════════════════════════════════
// TRIP SERVICE
// ═══════════════════════════════════════════════════════════
// Manages trip lifecycle: starting, pausing, resuming, and ending trips.
// Receives GPS data from GPS Adapter, compiles it into GeoJSON LineString,
// and provides trip data to screens for display.
// Maintains persistent trip state in AsyncStorage for orphaned trip detection.

// --- Constants ---

const STORAGE_KEY_ACTIVE_TRIP = '@rolltracks/active_trip';
const STORAGE_KEY_GPS_POINTS = '@rolltracks/gps_points'; // Backup GPS points during active trip
const ORPHANED_TRIP_DISTANCE_THRESHOLD_METERS = 200;

// --- Types ---

export interface TripMetadata {
  tripId: string;
  userId: string;
  mode: string;
  comfort: number;
  purpose: string;
  startTime: string; // ISO timestamp, kept locally for binning and UI
  startTimestamp: number; // Unix timestamp in ms, for relative time calculations
  status: 'active' | 'paused';
  devicePlatform: string; // Device platform (ios, android, web)
  deviceOsVersion: string; // OS version (e.g., "iOS 17.2", "Android 14")
  appVersion: string; // App version from package.json
}

export interface ActiveTripData {
  metadata: TripMetadata;
  coordinates: Array<[number, number]>; // [longitude, latitude] for GeoJSON
  relativeTimes: number[]; // Seconds since trip start for each coordinate
  lastCoordinate: { latitude: number; longitude: number } | null;
}

export interface TripSummaryData {
  tripId: string;
  mode: string;
  purpose: string;
  timeOfDay: string;
  weekday: number;
  durationS: number;
  distanceMi: number;
  reachedDest?: boolean;
}

export interface OrphanedTripInfo {
  status: 'active' | 'paused';
  distanceFromLastPoint: number | null; // null if user location unavailable
  tripData: ActiveTripData;
}

// --- Trip Service Class ---

class TripServiceClass {
  private activeTripData: ActiveTripData | null = null;
  private isRecording: boolean = false;

  // ═══════════════════════════════════════════════════════════
  // Device Info Utilities
  // ═══════════════════════════════════════════════════════════

  /**
   * Get device and app information for tracking.
   * Captures platform, OS version, and app version automatically.
   */
  private getDeviceInfo(): {
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

  // ═══════════════════════════════════════════════════════════
  // Prerequisite Checks
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if internet connection is available using NetInfo.
   */
  private async checkInternetConnection(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();

      // Check if connected and internet is reachable
      // isConnected checks basic connectivity, isInternetReachable verifies actual internet access
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable ?? false;

      // Consider connected if either we have a connection or can reach internet
      // isInternetReachable might be null initially, so we trust isConnected in that case
      const hasInternet = isConnected && (isInternetReachable === null || isInternetReachable);

      if (!hasInternet) {
        console.warn('[TripService] No internet connection:', {
          isConnected,
          isInternetReachable,
          type: state.type,
        });
      }

      return hasInternet;
    } catch (error) {
      console.error('[TripService] Failed to check connectivity:', error);
      return false;
    }
  }

  /**
   * Check if GPS is active and permissions are granted.
   */
  private async checkGPSActive(): Promise<boolean> {
    try {
      const isEnabled = await NativeAdapter.isLocationEnabled();
      if (!isEnabled) {
        return false;
      }

      const { granted } = await NativeAdapter.checkPermissions();
      return granted;
    } catch (error) {
      console.error('[TripService] GPS check failed:', error);
      return false;
    }
  }

  /**
   * Verify prerequisites before starting a trip.
   * Throws error if prerequisites not met.
   */
  async verifyPrerequisites(): Promise<void> {
    // Check GPS first (more critical)
    const gpsActive = await this.checkGPSActive();
    if (!gpsActive) {
      throw new Error('GPS is not active. Please enable location services and grant permissions.');
    }

    // Check internet connection
    const hasInternet = await this.checkInternetConnection();
    if (!hasInternet) {
      throw new Error('No internet connection. Please connect to the internet to start a trip.');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Persistent State Management
  // ═══════════════════════════════════════════════════════════

  /**
   * Save active trip data to persistent storage.
   */
  private async saveActiveTripState(): Promise<void> {
    if (!this.activeTripData) {
      await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_TRIP);
      return;
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_ACTIVE_TRIP,
        JSON.stringify(this.activeTripData)
      );
    } catch (error) {
      console.error('[TripService] Failed to save trip state:', error);
      throw new Error('Failed to save trip state to storage');
    }
  }

  /**
   * Load active trip data from persistent storage.
   */
  private async loadActiveTripState(): Promise<ActiveTripData | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_TRIP);
      if (!data) {
        return null;
      }

      return JSON.parse(data) as ActiveTripData;
    } catch (error) {
      console.error('[TripService] Failed to load trip state:', error);
      return null;
    }
  }

  /**
   * Clear active trip data from persistent storage.
   */
  private async clearActiveTripState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_TRIP);
      this.activeTripData = null;
    } catch (error) {
      console.error('[TripService] Failed to clear trip state:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Trip Lifecycle Management
  // ═══════════════════════════════════════════════════════════

  /**
   * Start a new trip with the specified parameters.
   * Checks prerequisites, initializes trip state, and begins GPS tracking.
   *
   * @param userId - The current user's ID
   * @param mode - Travel mode (wheelchair, skateboard, etc.)
   * @param comfort - Comfort level for this mode (1-10)
   * @param purpose - Trip purpose
   * @returns Trip ID of the newly created trip
   */
  async startTrip(
    userId: string,
    mode: string,
    comfort: number,
    purpose: string
  ): Promise<string> {
    // Check if there's already an active trip
    if (this.activeTripData) {
      throw new Error('A trip is already in progress. Please end the current trip first.');
    }

    // Verify prerequisites
    await this.verifyPrerequisites();

    // Generate trip ID and initialize metadata
    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const startTimestamp = Date.now(); // Unix timestamp in milliseconds
    const startTime = new Date(startTimestamp).toISOString(); // ISO string for binning

    // Capture device info automatically
    const deviceInfo = this.getDeviceInfo();

    this.activeTripData = {
      metadata: {
        tripId,
        userId,
        mode,
        comfort,
        purpose,
        startTime,
        startTimestamp,
        status: 'active',
        ...deviceInfo,
      },
      coordinates: [],
      relativeTimes: [], // Relative time in seconds for each coordinate
      lastCoordinate: null,
    };

    // Save initial state to persistent storage
    await this.saveActiveTripState();

    // Start GPS tracking
    await this.startGPSTracking();

    console.log('[TripService] Trip started:', tripId);
    return tripId;
  }

  /**
   * Pause the current trip.
   * Stops GPS tracking but maintains trip state.
   */
  async pauseTrip(): Promise<void> {
    if (!this.activeTripData) {
      throw new Error('No active trip to pause.');
    }

    if (this.activeTripData.metadata.status === 'paused') {
      console.warn('[TripService] Trip is already paused.');
      return;
    }

    // Stop GPS tracking
    await this.stopGPSTracking();

    // Update status
    this.activeTripData.metadata.status = 'paused';
    await this.saveActiveTripState();

    console.log('[TripService] Trip paused:', this.activeTripData.metadata.tripId);
  }

  /**
   * Resume a paused trip.
   * Restarts GPS tracking.
   */
  async resumeTrip(): Promise<void> {
    if (!this.activeTripData) {
      throw new Error('No active trip to resume.');
    }

    if (this.activeTripData.metadata.status === 'active') {
      console.warn('[TripService] Trip is already active.');
      return;
    }

    // Verify prerequisites before resuming
    await this.verifyPrerequisites();

    // Update status
    this.activeTripData.metadata.status = 'active';
    await this.saveActiveTripState();

    // Restart GPS tracking
    await this.startGPSTracking();

    console.log('[TripService] Trip resumed:', this.activeTripData.metadata.tripId);
  }

  /**
   * End the current trip.
   * Stops GPS tracking, calculates duration/distance, encodes polyline,
   * saves to database via Sync Service, and clears active trip state.
   *
   * @param reachedDest - Whether the user reported reaching their intended destination
   * @returns Summary of the completed trip
   */
  async endTrip(reachedDest?: boolean): Promise<TripSummaryData> {
    if (!this.activeTripData) {
      throw new Error('No active trip to end.');
    }

    // Stop GPS tracking if still active
    await this.stopGPSTracking();

    const { metadata, coordinates, relativeTimes } = this.activeTripData;

    // Ensure we have a valid tripId
    if (!metadata.tripId) {
      throw new Error('Trip ID is missing. Cannot save trip.');
    }

    // Calculate duration from relative times (last recorded time)
    const durationS = relativeTimes.length > 0
      ? relativeTimes[relativeTimes.length - 1]
      : 0;

    // Calculate distance in miles
    const distanceMi = this.calculateTotalDistance(coordinates);

    // Encode polyline from coordinates
    // Convert [lon, lat] to [lat, lon] for polyline encoding
    const latLngCoordinates = coordinates.map(([lon, lat]) => [lat, lon]);
    const encodedPolyline = polyline.encode(latLngCoordinates);

    console.log('[TripService] Encoded polyline:', {
      coordinateCount: coordinates.length,
      polylineLength: encodedPolyline.length,
      sample: encodedPolyline.substring(0, 50) + '...',
    });

    // Prepare trip data for database
    // Pass startTime for binning (DatabaseAdapter will bin it into timeOfDay and weekday)
    const tripData: Omit<Trip, 'tripId' | 'timeOfDay' | 'weekday'> & { startTime: string } = {
      userId: metadata.userId,
      mode: metadata.mode,
      comfort: metadata.comfort,
      purpose: metadata.purpose,
      startTime: metadata.startTime, // For binning only, not stored
      durationS,
      distanceMi,
      status: 'completed',
      reachedDest,
      geometry: encodedPolyline, // Store encoded polyline string
      relativeTimes, // Store relative timestamps for speed analysis
      devicePlatform: metadata.devicePlatform,
      deviceOsVersion: metadata.deviceOsVersion,
      appVersion: metadata.appVersion,
    };

    try {
      // Write to database via Sync Service
      // SyncService handles queueing and retry logic if connectivity fails
      const savedTrip = await SyncService.syncTrip(tripData);

      if (savedTrip) {
        // Trip was synced immediately
        console.log('[TripService] Trip saved to database:', savedTrip.tripId);

        // Clear active trip state
        await this.clearActiveTripState();

        console.log('[TripService] Trip ended:', metadata.tripId);

        return {
          tripId: savedTrip.tripId,
          mode: metadata.mode,
          purpose: metadata.purpose,
          timeOfDay: savedTrip.timeOfDay,
          weekday: savedTrip.weekday,
          durationS,
          distanceMi,
          reachedDest,
        };
      } else {
        // Trip was queued for later sync due to connectivity issues
        console.log('[TripService] Trip queued for sync (no connectivity)');

        // Clear active trip state even though not yet synced
        // The trip data is safely stored in SyncService queue
        await this.clearActiveTripState();

        console.log('[TripService] Trip ended and queued:', metadata.tripId);

        // Return summary with temporary ID and placeholder bins
        return {
          tripId: metadata.tripId, // Use temporary ID until synced
          mode: metadata.mode,
          purpose: metadata.purpose,
          timeOfDay: 'midday', // Placeholder, will be binned when synced
          weekday: 1, // Placeholder
          durationS,
          distanceMi,
          reachedDest,
        };
      }
    } catch (error) {
      console.error('[TripService] Failed to save trip:', error);
      throw new Error('Failed to save trip to database. Please try again.');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GPS Tracking
  // ═══════════════════════════════════════════════════════════

  /**
   * Start GPS tracking and record coordinates.
   */
  private async startGPSTracking(): Promise<void> {
    if (this.isRecording) {
      console.warn('[TripService] GPS tracking already active.');
      return;
    }

    try {
      await NativeAdapter.startWatchingPosition(
        (coordinate: GPSCoordinate) => {
          this.handleGPSUpdate(coordinate);
        },
        {
          distanceInterval: 5, // Update every 5 meters
          timeInterval: 1000, // Or every 1 second
        }
      );

      this.isRecording = true;
      console.log('[TripService] GPS tracking started.');
    } catch (error) {
      this.isRecording = false;
      if (error instanceof NativeAdapterError) {
        throw error;
      }
      throw new Error(`Failed to start GPS tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop GPS tracking.
   */
  private async stopGPSTracking(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    await NativeAdapter.stopWatchingPosition();
    this.isRecording = false;
    console.log('[TripService] GPS tracking stopped.');
  }

  /**
   * Handle GPS coordinate updates during trip recording.
   * Calculates relative time (seconds since trip start) for each GPS point.
   */
  private async handleGPSUpdate(coordinate: GPSCoordinate): Promise<void> {
    if (!this.activeTripData || this.activeTripData.metadata.status !== 'active') {
      return;
    }

    // Calculate relative time in seconds since trip start
    const currentTimestamp = Date.now();
    const relativeTimeSeconds = Math.round(
      (currentTimestamp - this.activeTripData.metadata.startTimestamp) / 1000
    );

    // Add coordinate to trip data (GeoJSON format: [longitude, latitude])
    this.activeTripData.coordinates.push([coordinate.longitude, coordinate.latitude]);
    this.activeTripData.relativeTimes.push(relativeTimeSeconds);

    // Update last coordinate
    this.activeTripData.lastCoordinate = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };

    // Save updated state periodically (every coordinate for safety)
    // In production, you might want to throttle this for performance
    await this.saveActiveTripState();
  }

  // ═══════════════════════════════════════════════════════════
  // Distance Calculation
  // ═══════════════════════════════════════════════════════════

  /**
   * Calculate total distance of a route in miles.
   * Uses Haversine formula for each segment.
   *
   * @param coordinates - Array of [longitude, latitude] pairs
   * @returns Total distance in miles
   */
  private calculateTotalDistance(coordinates: Array<[number, number]>): number {
    if (coordinates.length < 2) {
      return 0;
    }

    let totalMeters = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];

      const distance = NativeAdapter.calculateDistance(
        { latitude: lat1, longitude: lon1 },
        { latitude: lat2, longitude: lon2 }
      );

      totalMeters += distance;
    }

    // Convert meters to miles (1 mile = 1609.34 meters)
    return totalMeters / 1609.34;
  }

  // ═══════════════════════════════════════════════════════════
  // Data Access for Screens
  // ═══════════════════════════════════════════════════════════

  /**
   * Get current trip data for display on Active Trip Screen.
   * Returns null if no trip is active.
   */
  getCurrentTripData(): ActiveTripData | null {
    return this.activeTripData;
  }

  /**
   * Get current trip polyline as GeoJSON LineString for MapView display.
   * Returns null if no trip is active or no coordinates recorded yet.
   */
  getCurrentTripPolyline(): GeoJSON.LineString | null {
    if (!this.activeTripData || this.activeTripData.coordinates.length === 0) {
      return null;
    }

    return {
      type: 'LineString',
      coordinates: this.activeTripData.coordinates,
    };
  }

  /**
   * Get current trip status.
   */
  getTripStatus(): 'active' | 'paused' | 'none' {
    if (!this.activeTripData) {
      return 'none';
    }
    return this.activeTripData.metadata.status;
  }

  /**
   * Check if a trip is currently in progress.
   */
  isTripInProgress(): boolean {
    return this.activeTripData !== null;
  }

  // ═══════════════════════════════════════════════════════════
  // Orphaned Trip Detection
  // ═══════════════════════════════════════════════════════════

  /**
   * Check for orphaned trips when app/home screen opens.
   * An orphaned trip is one that was left in active or paused state
   * but is no longer being tracked (e.g., app was force-closed).
   *
   * For active orphaned trips:
   * - If user is within 200m of last point: return for potential resumption
   * - If user is >200m from last point: auto-end the trip
   *
   * For paused orphaned trips:
   * - Always return for user decision (end or resume)
   *
   * @returns OrphanedTripInfo if an orphaned trip exists, null otherwise
   */
  async checkForOrphanedTrip(): Promise<OrphanedTripInfo | null> {
    // Load trip state from storage
    const savedTripData = await this.loadActiveTripState();

    if (!savedTripData) {
      return null; // No orphaned trip
    }

    console.log('[TripService] Found orphaned trip:', savedTripData.metadata.tripId);

    // If trip is paused, always return for user decision
    if (savedTripData.metadata.status === 'paused') {
      this.activeTripData = savedTripData;
      return {
        status: 'paused',
        distanceFromLastPoint: null,
        tripData: savedTripData,
      };
    }

    // Trip is active - check distance from last point
    if (savedTripData.lastCoordinate) {
      try {
        const currentPosition = await NativeAdapter.getCurrentPosition();
        const distance = NativeAdapter.calculateDistance(
          savedTripData.lastCoordinate,
          {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
          }
        );

        if (distance > ORPHANED_TRIP_DISTANCE_THRESHOLD_METERS) {
          // User is too far away - auto-end the trip
          console.log(
            `[TripService] Auto-ending orphaned trip (distance: ${distance.toFixed(0)}m > ${ORPHANED_TRIP_DISTANCE_THRESHOLD_METERS}m)`
          );
          this.activeTripData = savedTripData;
          await this.endTrip();
          return null;
        }

        // User is within range - return for potential resumption
        this.activeTripData = savedTripData;
        return {
          status: 'active',
          distanceFromLastPoint: distance,
          tripData: savedTripData,
        };
      } catch (error) {
        console.error('[TripService] Failed to get current position for orphan check:', error);
        // If we can't get position, return the trip for user decision
        this.activeTripData = savedTripData;
        return {
          status: 'active',
          distanceFromLastPoint: null,
          tripData: savedTripData,
        };
      }
    }

    // No last coordinate - return for user decision
    this.activeTripData = savedTripData;
    return {
      status: 'active',
      distanceFromLastPoint: null,
      tripData: savedTripData,
    };
  }

  /**
   * Discard an orphaned trip without saving it.
   * Use this when user chooses to end an orphaned trip without saving.
   */
  async discardOrphanedTrip(): Promise<void> {
    if (this.isRecording) {
      await this.stopGPSTracking();
    }
    await this.clearActiveTripState();
    console.log('[TripService] Orphaned trip discarded.');
  }
}

// Export singleton instance
export const TripService = new TripServiceClass();
