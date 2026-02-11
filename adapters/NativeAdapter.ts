import * as Location from 'expo-location';

// ═══════════════════════════════════════════════════════════
// NATIVE ADAPTER
// ═══════════════════════════════════════════════════════════
// Source of truth for native device functionality. Currently handles
// GPS location data from native API, serving it to Trip Service and
// screens for MapView display. Will be expanded to include other
// native device capabilities.

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
}

export interface GPSPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

export class NativeAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeAdapterError';
  }
}

class NativeAdapterClass {
  private locationSubscription: Location.LocationSubscription | null = null;

  /**
   * Check if location permissions have been granted.
   * Call this on app launch to verify permissions.
   */
  async checkPermissions(): Promise<GPSPermissionStatus> {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain,
    };
  }

  /**
   * Request location permissions from the user.
   * Returns true if granted, false if denied.
   * Does not throw errors - use for initial permission requests.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[NativeAdapter] Location permission denied');
        return false;
      }
      return true;
    } catch (error) {
      console.error('[NativeAdapter] Failed to request permissions:', error);
      return false;
    }
  }

  /**
   * Ensure permissions are granted, requesting if necessary.
   * Call this before starting a trip or accessing location.
   * Throws NativeAdapterError if permissions cannot be obtained.
   */
  async ensurePermissions(): Promise<void> {
    const { granted } = await this.checkPermissions();
    if (!granted) {
      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        throw new NativeAdapterError('Location permission denied. Please enable location services in your device settings.');
      }
    }
  }

  /**
   * Get the current GPS position.
   * Used by screens to display user location on map.
   * Throws NativeAdapterError if permissions not granted or GPS unavailable.
   */
  async getCurrentPosition(): Promise<GPSCoordinate> {
    await this.ensurePermissions();

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
    } catch (error) {
      throw new NativeAdapterError(`Failed to get current position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start watching location updates for trip recording.
   * Callback receives GPS coordinates at specified intervals.
   * Returns a subscription ID that can be used to stop watching.
   *
   * @param callback Function called with each location update
   * @param options Configuration for location accuracy and update frequency
   * @returns Promise that resolves when watching starts
   */
  async startWatchingPosition(
    callback: (coordinate: GPSCoordinate) => void,
    options?: {
      accuracy?: Location.Accuracy;
      distanceInterval?: number; // meters
      timeInterval?: number; // milliseconds
    }
  ): Promise<void> {
    await this.ensurePermissions();

    // Stop any existing subscription
    if (this.locationSubscription) {
      await this.stopWatchingPosition();
    }

    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy ?? Location.Accuracy.High,
          distanceInterval: options?.distanceInterval ?? 5, // Update every 5 meters
          timeInterval: options?.timeInterval ?? 1000, // Or every 1 second
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          });
        }
      );
    } catch (error) {
      throw new NativeAdapterError(`Failed to start watching position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop watching location updates.
   * Call this when ending a trip or when location updates are no longer needed.
   */
  async stopWatchingPosition(): Promise<void> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  /**
   * Check if location services are enabled on the device.
   * Returns false if user has disabled location services system-wide.
   */
  async isLocationEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('[NativeAdapter] Failed to check location services:', error);
      return false;
    }
  }

  /**
   * Calculate distance between two GPS coordinates in meters.
   * Useful for checking if user is within 200m of a point (orphaned trip detection).
   *
   * @param coord1 First coordinate
   * @param coord2 Second coordinate
   * @returns Distance in meters
   */
  calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if GPS is currently being watched.
   * Useful for detecting orphaned trips.
   */
  isWatching(): boolean {
    return this.locationSubscription !== null;
  }
}

// Export singleton instance
export const NativeAdapter = new NativeAdapterClass();
