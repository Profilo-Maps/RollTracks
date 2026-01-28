import { TourState, TourStep, ScreenName, TourAction } from '../types/tour.types';
import { TourStorage } from '../storage/TourStorage';
import { ProfileService } from './ProfileService';

/**
 * TourService
 * 
 * Business logic for managing the onboarding tutorial tour.
 * Handles tour lifecycle (start, navigate, dismiss, complete), coordinates with
 * ProfileService for completion tracking.
 * 
 * Key Responsibilities:
 * - Tour initialization and lifecycle management
 * - Step navigation with screen transitions
 * - Tour state persistence via TourStorage
 * - Profile integration for completion tracking
 * 
 * Error Handling:
 * - Throws error for invalid step indices
 * - Logs and handles storage failures gracefully
 * - Validates tour state transitions
 */
export class TourService {
  private steps: TourStep[];
  private storage: TourStorage;
  private profileService: ProfileService;
  private navigationRef: any; // React Navigation ref

  /**
   * Creates a new TourService instance
   * 
   * @param storage - TourStorage instance for state persistence
   * @param profileService - ProfileService for completion tracking
   * @param navigationRef - React Navigation container ref for screen navigation
   * 
   * @example
   * const tourService = new TourService(
   *   tourStorage,
   *   profileService,
   *   navigationRef
   * );
   */
  constructor(
    storage: TourStorage,
    profileService: ProfileService,
    navigationRef: any
  ) {
    this.storage = storage;
    this.profileService = profileService;
    this.navigationRef = navigationRef;
    this.steps = this.initializeTourSteps();
  }

  /**
   * Initialize the tour steps configuration
   * 
   * Defines all 5 tour steps with their screen targets, content, and actions:
   * 1. Home screen - Profile navigation introduction
   * 2. Profile screen - Mode list customization
   * 3. Start trip screen - Trip recording introduction
   * 4. Start trip screen - Active trip info (stays on same screen)
   * 5. Trip history screen - History review
   * 
   * @returns Array of TourStep definitions
   * @private
   */
  private initializeTourSteps(): TourStep[] {
    return [
      {
        id: 'home_profile_nav',
        screen: 'Home' as ScreenName,
        title: 'Welcome to RollTracks!',
        description: "Let's start by exploring your profile. Look for the profile icon (👤) in the top-right corner and tap it to customize your settings.",
        highlightElement: 'profile_nav_button',
        position: 'bottom',
        action: 'navigate' as TourAction,
      },
      {
        id: 'profile_modes',
        screen: 'Profile' as ScreenName,
        title: 'Customize Your Modes',
        description: 'See the "Modes" section below? You can add, remove, or modify your transportation modes for trip recording. When you\'re ready, tap Next to continue.',
        highlightElement: 'mode_list_section',
        position: 'bottom',
        action: 'navigate' as TourAction,
      },
      {
        id: 'start_trip',
        screen: 'StartTrip' as ScreenName,
        title: 'Record Your Trips',
        description: "Look for the red Record button (●) at the bottom of the screen. Tap it to start recording your trip and tracking accessibility features.",
        highlightElement: 'start_trip_button',
        position: 'bottom',
        action: 'navigate' as TourAction,
      },
      {
        id: 'active_trip_info',
        screen: 'StartTrip' as ScreenName,
        title: 'Rating Features',
        description: "When a trip is active, dots representing street features will pop up on the map. Click on the dots to rate them and help improve accessibility data!",
        highlightElement: 'start_trip_button',
        position: 'bottom',
      },
      {
        id: 'trip_history',
        screen: 'History' as ScreenName,
        title: 'Review Your History',
        description: 'This is where you\'ll find all your past trips. You can see details, filter by date, and analyze your routes. Tap Finish to complete the tour!',
        highlightElement: 'trip_history_list',
        position: 'bottom',
        action: 'navigate' as TourAction,
      },
    ];
  }

  /**
   * Get a specific tour step by index
   * 
   * @param index - Zero-based step index
   * @returns TourStep at the specified index
   * 
   * @example
   * const firstStep = tourService.getStep(0);
   * console.log(firstStep.title); // 'Welcome to Your App!'
   */
  getStep(index: number): TourStep {
    return this.steps[index];
  }

  /**
   * Check if the tour should start for a user
   * 
   * Determines if the tour should automatically start based on:
   * - User profile exists and is complete (has age and mode_list)
   * - User profile tourCompleted flag is false
   * - Current tour state status is 'not_started'
   * 
   * @param userId - The user ID to check
   * @returns true if tour should start, false otherwise
   * 
   * @example
   * const shouldStart = await tourService.shouldStartTour('user123');
   * if (shouldStart) {
   *   await tourService.startTour('user123');
   * }
   */
  async shouldStartTour(userId: string): Promise<boolean> {
    try {
      const profile = await this.profileService.getProfile();
      const tourState = await this.storage.getTourState(userId);
      
      // Tour should start if:
      // 1. Profile exists and is complete (has age and mode_list)
      // 2. Profile doesn't have tourCompleted flag set to true
      // 3. Tour state is not_started
      const profileComplete = !!(profile && 
                             profile.age !== undefined && 
                             profile.mode_list && 
                             profile.mode_list.length > 0);
      
      return profileComplete && profile?.tourCompleted !== true && tourState.status === 'not_started';
    } catch (error) {
      console.error('Error checking if tour should start:', error);
      return false;
    }
  }

  /**
   * Start the tour for a user
   * 
   * Initializes tour state with:
   * - isActive: true
   * - currentStep: 0
   * - totalSteps: number of configured steps
   * - status: 'in_progress'
   * 
   * @param userId - The user ID to start tour for
   * @returns Initial TourState
   * 
   * @example
   * const state = await tourService.startTour('user123');
   * console.log(state.currentStep); // 0
   * console.log(state.status); // 'in_progress'
   */
  async startTour(userId: string): Promise<TourState> {
    const initialState: TourState = {
      isActive: true,
      currentStep: 0,
      totalSteps: this.steps.length,
      status: 'in_progress',
    };
    
    await this.storage.saveTourState(userId, initialState);
    return initialState;
  }

  /**
   * Navigate to a specific tour step
   * 
   * Handles:
   * - Step index validation
   * - Screen navigation based on step configuration
   * - State persistence
   * 
   * @param userId - The user ID
   * @param stepIndex - Target step index (0-based)
   * @param currentState - Current tour state
   * @returns Updated TourState
   * @throws Error if step index is invalid
   * 
   * @example
   * const newState = await tourService.navigateToStep(
   *   'user123',
   *   1,
   *   currentState
   * );
   * console.log(newState.currentStep); // 1
   */
  async navigateToStep(
    userId: string,
    stepIndex: number,
    currentState: TourState
  ): Promise<TourState> {
    // Validate step index
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error('Invalid step index');
    }

    const step = this.steps[stepIndex];
    const newState: TourState = { 
      ...currentState, 
      currentStep: stepIndex 
    };

    // Handle step-specific actions
    if (step.action === 'navigate') {
      // Navigate to the target screen
      if (this.navigationRef?.current) {
        try {
          this.navigationRef.current.navigate(step.screen);
        } catch (error) {
          console.error(`Failed to navigate to ${step.screen}:`, error);
        }
      } else {
        console.warn('Navigation ref not available');
      }
    }

    // Persist the new state
    await this.storage.saveTourState(userId, newState);
    return newState;
  }

  /**
   * Dismiss the tour
   * 
   * Sets tour state to:
   * - isActive: false
   * - status: 'dismissed'
   * 
   * @param userId - The user ID
   * @param currentState - Current tour state
   * @returns Updated TourState
   * 
   * @example
   * const newState = await tourService.dismissTour('user123', currentState);
   * console.log(newState.status); // 'dismissed'
   * console.log(newState.isActive); // false
   */
  async dismissTour(userId: string, currentState: TourState): Promise<TourState> {
    const newState: TourState = {
      ...currentState,
      isActive: false,
      status: 'dismissed',
    };
    
    await this.storage.saveTourState(userId, newState);
    return newState;
  }

  /**
   * Complete the tour
   * 
   * Sets tour state to:
   * - isActive: false
   * - status: 'completed'
   * 
   * Also updates user profile with tourCompleted: true
   * 
   * @param userId - The user ID
   * @param currentState - Current tour state
   * @returns Updated TourState
   * 
   * @example
   * const newState = await tourService.completeTour('user123', currentState);
   * console.log(newState.status); // 'completed'
   * 
   * const profile = await profileService.getProfile();
   * console.log(profile.tourCompleted); // true
   */
  async completeTour(userId: string, currentState: TourState): Promise<TourState> {
    const newState: TourState = {
      ...currentState,
      isActive: false,
      status: 'completed',
    };
    
    await this.storage.saveTourState(userId, newState);
    
    // Update profile to mark tour as completed
    try {
      await this.profileService.updateProfile({ tourCompleted: true });
    } catch (error) {
      console.error('Failed to update profile with tour completion:', error);
      // Don't throw - tour state in storage is the source of truth
    }
    
    return newState;
  }

  /**
   * Restart the tour
   * 
   * Clears existing tour state and profile completion flag,
   * then starts a fresh tour from step 0.
   * 
   * @param userId - The user ID
   * @returns New TourState starting from step 0
   * 
   * @example
   * const newState = await tourService.restartTour('user123');
   * console.log(newState.currentStep); // 0
   * console.log(newState.status); // 'in_progress'
   */
  async restartTour(userId: string): Promise<TourState> {
    // Clear existing tour state
    await this.storage.clearTourState(userId);
    
    // Reset profile completion flag
    try {
      await this.profileService.updateProfile({ tourCompleted: false });
    } catch (error) {
      console.error('Failed to reset profile tour completion flag:', error);
      // Continue anyway - storage state is primary
    }
    
    // Start fresh tour
    return this.startTour(userId);
  }

  /**
   * Get total number of tour steps
   * 
   * @returns Total step count
   * 
   * @example
   * const total = tourService.getTotalSteps();
   * console.log(total); // 5
   */
  getTotalSteps(): number {
    return this.steps.length;
  }
}
