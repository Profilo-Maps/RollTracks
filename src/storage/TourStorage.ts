import AsyncStorage from '@react-native-async-storage/async-storage';
import { TourState, StoredTourState } from '../types/tour.types';

/**
 * TourStorage
 * 
 * Persistence layer for tour state management.
 * Handles saving, loading, and clearing tour progress from AsyncStorage.
 * 
 * Storage Key Pattern: @tour_state_{userId}
 * 
 * Error Handling:
 * - getTourState: Returns default state on errors (fail-safe)
 * - saveTourState: Throws errors to allow caller retry logic
 * - clearTourState: Logs errors but doesn't throw (best-effort)
 */
export class TourStorage {
  private readonly TOUR_STATE_KEY = '@tour_state_';

  /**
   * Get tour state for a specific user
   * 
   * @param userId - The user ID to retrieve tour state for
   * @returns StoredTourState with current tour progress, or default state if not found
   * 
   * Error Handling: Returns default state on any error to prevent app crashes
   */
  async getTourState(userId: string): Promise<StoredTourState> {
    try {
      const key = `${this.TOUR_STATE_KEY}${userId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return {
          currentStep: 0,
          status: 'not_started',
          lastUpdated: new Date().toISOString(),
        };
      }
      
      return JSON.parse(data) as StoredTourState;
    } catch (error) {
      console.error('Failed to load tour state:', error);
      return {
        currentStep: 0,
        status: 'not_started',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Save tour state for a specific user
   * 
   * @param userId - The user ID to save tour state for
   * @param state - The current TourState to persist
   * @throws Error if storage operation fails
   * 
   * Error Handling: Throws error to allow caller to implement retry logic
   */
  async saveTourState(userId: string, state: TourState): Promise<void> {
    try {
      const key = `${this.TOUR_STATE_KEY}${userId}`;
      const storedState: StoredTourState = {
        currentStep: state.currentStep,
        status: state.status,
        lastUpdated: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(storedState));
    } catch (error) {
      console.error('Failed to save tour state:', error);
      throw error;
    }
  }

  /**
   * Clear tour state for a specific user
   * 
   * @param userId - The user ID to clear tour state for
   * 
   * Error Handling: Logs error but doesn't throw (best-effort cleanup)
   */
  async clearTourState(userId: string): Promise<void> {
    try {
      const key = `${this.TOUR_STATE_KEY}${userId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear tour state:', error);
      // Don't throw - clearing is best-effort
    }
  }
}
