import { StorageAdapter } from '../storage/types';
import { Trip, Mode, LocationPoint, TripPurpose } from '../types';
import { GPSService } from './GPSService';

export class TripService {
  private storageAdapter: StorageAdapter;
  private gpsService: GPSService;

  constructor(storageAdapter: StorageAdapter) {
    this.storageAdapter = storageAdapter;
    this.gpsService = new GPSService();
  }

  /**
   * Start a new trip with GPS tracking
   * Note: Location permissions should be checked before calling this method
   * @param data - Trip data including mode, boldness, and optional purpose
   * @returns Created trip
   * @throws Error if there's already an active trip or creation fails
   */
  async startTrip(data: {
    mode: Mode;
    boldness: number;
    purpose?: TripPurpose;
    userId?: string;
  }): Promise<Trip> {
    try {
      // Validate boldness
      if (data.boldness < 1 || data.boldness > 10) {
        throw new Error('Boldness must be between 1 and 10');
      }

      // Check if there's already an active trip
      const activeTrip = await this.getActiveTrip();
      if (activeTrip) {
        throw new Error('There is already an active trip. Stop it before starting a new one.');
      }

      // Clear any existing GPS points
      await this.storageAdapter.clearGPSPoints();

      // Create new trip
      const now = new Date().toISOString();
      const newTrip: Trip = {
        id: this.generateId(),
        user_id: data.userId,
        mode: data.mode,
        boldness: data.boldness,
        purpose: data.purpose,
        start_time: now,
        end_time: null,
        duration_seconds: null,
        distance_miles: null,
        geometry: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      };

      await this.storageAdapter.saveTrip(newTrip);

      // Start GPS tracking (permissions should already be granted)
      await this.gpsService.startTracking(async (location: LocationPoint) => {
        await this.storageAdapter.appendGPSPoint(location);
      });

      return newTrip;
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while starting trip');
    }
  }



  /**
   * Stop an active trip
   * @param tripId - ID of the trip to stop
   * @param geometry - Optional pre-encoded polyline (if not provided, will encode from GPS points)
   * @returns Updated trip
   * @throws Error if trip not found or already completed
   */
  async stopTrip(tripId: string, geometry?: string): Promise<Trip> {
    try {
      // Get the trip
      const trip = await this.storageAdapter.getTrip(tripId);
      if (!trip) {
        throw new Error('Trip not found');
      }

      if (trip.status === 'completed') {
        throw new Error('Trip is already completed');
      }

      // Stop GPS tracking
      this.gpsService.stopTracking();

      // Get GPS points
      const gpsPoints = await this.storageAdapter.getGPSPoints();

      // Encode polyline if not provided
      let encodedGeometry = geometry;
      if (!encodedGeometry && gpsPoints.length > 0) {
        encodedGeometry = this.gpsService.encodePolyline(gpsPoints);
      }

      // Calculate distance
      let distance: number | null = null;
      if (gpsPoints.length > 0) {
        distance = this.gpsService.calculateDistance(gpsPoints);
      }

      // Calculate duration
      const endTime = new Date();
      const startTime = new Date(trip.start_time);
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Update trip
      await this.storageAdapter.updateTrip(tripId, {
        end_time: endTime.toISOString(),
        duration_seconds: durationSeconds,
        distance_miles: distance,
        geometry: encodedGeometry || null,
        status: 'completed',
        updated_at: new Date().toISOString(),
      });

      // Clear GPS points
      await this.storageAdapter.clearGPSPoints();

      // Return updated trip
      const updatedTrip = await this.storageAdapter.getTrip(tripId);
      if (!updatedTrip) {
        throw new Error('Failed to retrieve updated trip');
      }

      return updatedTrip;
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while stopping trip');
    }
  }

  /**
   * Get the currently active trip
   * @returns Active trip if found, null otherwise
   */
  async getActiveTrip(): Promise<Trip | null> {
    try {
      const trips = await this.storageAdapter.getTrips();
      const activeTrip = trips.find(trip => trip.status === 'active');
      return activeTrip || null;
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching active trip');
    }
  }

  /**
   * Get all trips
   * @returns Array of trips sorted by start_time descending
   */
  async getTrips(): Promise<Trip[]> {
    try {
      const trips = await this.storageAdapter.getTrips();
      // Sort by start_time descending (most recent first)
      return trips.sort((a, b) => {
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      });
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching trips');
    }
  }

  /**
   * Get a specific trip by ID
   * @param tripId - ID of the trip to retrieve
   * @returns Trip if found, null otherwise
   */
  async getTrip(tripId: string): Promise<Trip | null> {
    try {
      return await this.storageAdapter.getTrip(tripId);
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching trip');
    }
  }

  /**
   * Generate a unique UUID for trip
   * @returns UUID string
   */
  private generateId(): string {
    // Generate a UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
