/**
 * Tour Data Models
 * 
 * Type definitions for the onboarding tutorial tour feature.
 * These interfaces define the structure of tour state, steps, and simulated trips.
 */

/**
 * Tour lifecycle status
 */
export type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

/**
 * Screen names for tour navigation
 */
export type ScreenName = 'Home' | 'Profile' | 'StartTrip' | 'ActiveTrip' | 'History';

/**
 * Overlay position for tour content card
 */
export type OverlayPosition = 'top' | 'bottom' | 'center';

/**
 * Actions that can be performed when entering a tour step
 */
export type TourAction = 'navigate';

/**
 * Main tour state interface
 * Represents the current state of the tutorial tour
 */
export interface TourState {
  /** Whether tour overlay is currently displayed */
  isActive: boolean;
  /** Zero-based index of current step */
  currentStep: number;
  /** Total number of steps in tour */
  totalSteps: number;
  /** Current tour lifecycle status */
  status: TourStatus;
}

/**
 * Individual tour step definition
 * Defines what to display and do at each step of the tour
 */
export interface TourStep {
  /** Unique identifier for the step */
  id: string;
  /** Target screen for this step */
  screen: ScreenName;
  /** Step title displayed in overlay */
  title: string;
  /** Instructional text for the step */
  description: string;
  /** Optional element ID to highlight */
  highlightElement?: string;
  /** Vertical position of overlay card */
  position: OverlayPosition;
  /** Optional action to perform on step entry */
  action?: TourAction;
}

/**
 * Persisted tour state
 * Minimal state stored in AsyncStorage for tour resumption
 */
export interface StoredTourState {
  /** Last completed step index */
  currentStep: number;
  /** Tour lifecycle status */
  status: TourStatus;
  /** ISO timestamp of last state change */
  lastUpdated: string;
}



/**
 * Extension to UserProfile interface for tour completion tracking
 * This field should be added to the existing UserProfile interface
 */
export interface ProfileExtension {
  /** Flag indicating tour completion */
  tourCompleted: boolean;
}
