import { Trip } from '../types';
import { StorageAdapter } from '../storage/types';

export interface Statistics {
  averageBoldness: number;
  averageTripLength: number;
  totalTrips: number;
}

export class StatisticsService {
  constructor(private storageAdapter: StorageAdapter) {}

  /**
   * Calculate average boldness across all trips
   * Returns 0 if no trips
   */
  calculateAverageBoldness(trips: Trip[]): number {
    if (trips.length === 0) {
      return 0;
    }

    const totalBoldness = trips.reduce((sum, trip) => sum + trip.boldness, 0);
    return totalBoldness / trips.length;
  }

  /**
   * Calculate average trip length in miles across all trips
   * Returns 0 if no trips or if trips have no distance data
   */
  calculateAverageTripLength(trips: Trip[]): number {
    // Filter trips that have distance data
    const tripsWithDistance = trips.filter(
      trip => trip.distance_miles !== null && trip.distance_miles !== undefined
    );

    if (tripsWithDistance.length === 0) {
      return 0;
    }

    const totalDistance = tripsWithDistance.reduce(
      (sum, trip) => sum + (trip.distance_miles || 0),
      0
    );
    
    return totalDistance / tripsWithDistance.length;
  }

  /**
   * Get profile statistics including average boldness and trip length
   */
  async getProfileStatistics(profileId: string): Promise<Statistics> {
    try {
      // Get all trips for the profile
      const allTrips = await this.storageAdapter.getTrips();
      
      // Filter completed trips only
      const completedTrips = allTrips.filter(trip => trip.status === 'completed');

      return {
        averageBoldness: this.calculateAverageBoldness(completedTrips),
        averageTripLength: this.calculateAverageTripLength(completedTrips),
        totalTrips: completedTrips.length,
      };
    } catch (error) {
      console.error('Error getting profile statistics:', error);
      throw error;
    }
  }
}
