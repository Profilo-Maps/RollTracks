import { DataService, Trip, TripSummary } from '@/adapters/DatabaseAdapter';

// ═══════════════════════════════════════════════════════════
// HISTORY SERVICE
// ═══════════════════════════════════════════════════════════
// Provides trip history data to Trip History, Trip Summary, and Home screens.
// Screens pass this data to MapView Component as props for visualization.

export interface TripFilter {
  status?: 'active' | 'paused' | 'completed';
}

export interface HistoryOverview {
  trips: Trip[];
  totalTrips: number;
  totalDistance: number;
  totalDuration: number;
}

class HistoryServiceClass {
  /**
   * Get trip summaries for the Trip History screen
   * Returns lightweight trip data for card display
   */
  async getTripSummaries(): Promise<TripSummary[]> {
    try {
      return await DataService.getTripSummaries();
    } catch (error) {
      console.error('[HistoryService] Failed to fetch trip summaries:', error);
      throw error;
    }
  }

  /**
   * Get full trip data for a specific trip (Trip Summary screen)
   * Includes polyline geometry for MapView display
   */
  async getTrip(tripId: string): Promise<Trip | null> {
    try {
      return await DataService.getTrip(tripId);
    } catch (error) {
      console.error('[HistoryService] Failed to fetch trip:', error);
      throw error;
    }
  }

  /**
   * Get trips for the current user with optional filtering
   * Returns full trip data including polylines for map display
   * 
   * @param filter - Optional filter criteria (e.g., { status: 'completed' })
   * @returns Array of trips matching the filter
   * 
   * @example
   * // Get all trips
   * const allTrips = await HistoryService.getUserTrips();
   * 
   * // Get only completed trips for map display
   * const completedTrips = await HistoryService.getUserTrips({ status: 'completed' });
   */
  async getUserTrips(filter?: TripFilter): Promise<Trip[]> {
    try {
      const trips = await DataService.getUserTrips();
      
      if (!filter) {
        return trips;
      }

      // Apply filters
      return trips.filter((trip) => {
        if (filter.status && trip.status !== filter.status) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('[HistoryService] Failed to fetch user trips:', error);
      throw error;
    }
  }

  /**
   * Get overview statistics for the current user
   * Used by Home screen and Profile screen to display summary stats
   */
  async getHistoryOverview(): Promise<HistoryOverview> {
    try {
      const completedTrips = await this.getUserTrips({ status: 'completed' });

      const totalDistance = completedTrips.reduce(
        (sum, trip) => sum + (trip.distanceMi || 0),
        0,
      );
      const totalDuration = completedTrips.reduce(
        (sum, trip) => sum + (trip.durationS || 0),
        0,
      );

      return {
        trips: completedTrips,
        totalTrips: completedTrips.length,
        totalDistance,
        totalDuration,
      };
    } catch (error) {
      console.error('[HistoryService] Failed to fetch history overview:', error);
      throw error;
    }
  }

  /**
   * Get profile statistics for the current user
   * Used by Profile screen to display summary stats
   */
  async getProfileStatistics(): Promise<{
    avgTripLength: number;
    avgTripDuration: number;
    totalTrips: number;
  }> {
    try {
      const completedTrips = await this.getUserTrips({ status: 'completed' });

      if (completedTrips.length === 0) {
        return {
          avgTripLength: 0,
          avgTripDuration: 0,
          totalTrips: 0,
        };
      }

      const totalDistance = completedTrips.reduce(
        (sum, trip) => sum + (trip.distanceMi || 0),
        0,
      );
      const totalDuration = completedTrips.reduce(
        (sum, trip) => sum + (trip.durationS || 0),
        0,
      );

      return {
        avgTripLength: totalDistance / completedTrips.length,
        avgTripDuration: totalDuration / completedTrips.length,
        totalTrips: completedTrips.length,
      };
    } catch (error) {
      console.error('[HistoryService] Failed to fetch profile statistics:', error);
      throw error;
    }
  }

  /**
   * Delete a trip and all associated data
   * Used by Trip Summary screen or Trip History screen
   */
  async deleteTrip(tripId: string): Promise<void> {
    try {
      await DataService.deleteTrip(tripId);
    } catch (error) {
      console.error('[HistoryService] Failed to delete trip:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const HistoryService = new HistoryServiceClass();
