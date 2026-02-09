import { DataService, Trip, TripSummary, RatedFeature, CorrectedSegment } from '@/adapters/DatabaseAdapter';

// ═══════════════════════════════════════════════════════════
// HISTORY SERVICE
// ═══════════════════════════════════════════════════════════
// Provides trip history data to Trip History, Trip Summary, and Home screens.
// Screens pass this data to MapView Component as props for visualization.

export interface TripWithContributions extends Trip {
  ratings: RatedFeature[];
  corrections: CorrectedSegment[];
}

export interface HistoryOverview {
  trips: Trip[];
  totalTrips: number;
  totalDistance: number;
  totalDuration: number;
  totalRatings: number;
  totalCorrections: number;
}

class HistoryServiceClass {
  /**
   * Get trip summaries for the Trip History screen
   * Returns lightweight trip data with rating/correction counts for card display
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
   * Get trip with all associated ratings and corrections (DataRanger mode)
   * Used by Trip Summary screen when DataRanger mode is active
   */
  async getTripWithContributions(tripId: string): Promise<TripWithContributions | null> {
    try {
      const trip = await DataService.getTrip(tripId);
      if (!trip) return null;

      const [ratings, corrections] = await Promise.all([
        DataService.getRatingsForTrip(tripId),
        DataService.getCorrectionsForTrip(tripId),
      ]);

      return {
        ...trip,
        ratings,
        corrections,
      };
    } catch (error) {
      console.error('[HistoryService] Failed to fetch trip with contributions:', error);
      throw error;
    }
  }

  /**
   * Get all trips for the current user (Home screen)
   * Returns full trip data including polylines for map display
   */
  async getAllUserTrips(): Promise<Trip[]> {
    try {
      return await DataService.getUserTrips();
    } catch (error) {
      console.error('[HistoryService] Failed to fetch user trips:', error);
      throw error;
    }
  }

  /**
   * Get only completed trips with polyline data for map display
   * Used by Home screen to show trip history overlay on map
   */
  async getCompletedTripsForMap(): Promise<Trip[]> {
    try {
      const trips = await DataService.getUserTrips();
      return trips.filter((trip) => trip.status === 'completed');
    } catch (error) {
      console.error('[HistoryService] Failed to fetch completed trips:', error);
      throw error;
    }
  }

  /**
   * Get ratings for a specific trip (DataRanger mode)
   * Used by Trip Summary screen to display rated features on map
   */
  async getRatingsForTrip(tripId: string): Promise<RatedFeature[]> {
    try {
      return await DataService.getRatingsForTrip(tripId);
    } catch (error) {
      console.error('[HistoryService] Failed to fetch ratings for trip:', error);
      throw error;
    }
  }

  /**
   * Get corrections for a specific trip (DataRanger mode)
   * Used by Trip Summary screen to display corrected segments on map
   */
  async getCorrectionsForTrip(tripId: string): Promise<CorrectedSegment[]> {
    try {
      return await DataService.getCorrectionsForTrip(tripId);
    } catch (error) {
      console.error('[HistoryService] Failed to fetch corrections for trip:', error);
      throw error;
    }
  }

  /**
   * Get overview statistics for the current user
   * Used by Home screen and Profile screen to display summary stats
   */
  async getHistoryOverview(): Promise<HistoryOverview> {
    try {
      const trips = await DataService.getUserTrips();
      const completedTrips = trips.filter((trip) => trip.status === 'completed');

      const totalDistance = completedTrips.reduce(
        (sum, trip) => sum + (trip.distanceMi || 0),
        0,
      );
      const totalDuration = completedTrips.reduce(
        (sum, trip) => sum + (trip.durationS || 0),
        0,
      );

      // Get all ratings and corrections for the user
      const [ratings, corrections] = await Promise.all([
        DataService.getUserRatings(),
        DataService.getUserCorrections(),
      ]);

      return {
        trips: completedTrips,
        totalTrips: completedTrips.length,
        totalDistance,
        totalDuration,
        totalRatings: ratings.length,
        totalCorrections: corrections.length,
      };
    } catch (error) {
      console.error('[HistoryService] Failed to fetch history overview:', error);
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
