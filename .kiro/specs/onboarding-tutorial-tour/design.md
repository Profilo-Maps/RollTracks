# Design Document: Onboarding Tutorial Tour

## Overview

The onboarding tutorial tour is a guided walkthrough system that introduces new users to the key features of the React Native app. The tour automatically triggers after profile creation and guides users through four main areas: home screen navigation, profile customization, trip recording with obstacle grading (using a simulated trip), and trip history review.

The design follows a service-oriented architecture that integrates with existing services (ProfileService, TripService, AuthContext) while maintaining separation of concerns. The tour uses an overlay-based UI approach with step-by-step navigation, progress indicators, and dismissal capabilities. Tour state is persisted to local storage to support resumption after app restarts.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HomeScreen   │  │ProfileScreen │  │StartTrip     │      │
│  │              │  │              │  │Screen        │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  TourOverlay    │                        │
│                   │  Component      │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐     │
│  │ TourContext  │  │ TourService  │  │ TourStorage  │     │
│  │              │  │              │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │             │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐     │
│  │ AuthContext  │  │ProfileService│  │ TripService  │     │
│  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**TourContext**: React context providing tour state and actions to all components
- Manages current step, tour status, and navigation
- Provides hooks for components to access tour state
- Triggers tour initialization based on user profile

**TourService**: Business logic for tour management
- Handles tour lifecycle (start, navigate, dismiss, complete)
- Coordinates with ProfileService for completion tracking
- Manages simulated trip creation and cleanup
- Validates tour state transitions

**TourStorage**: Persistence layer for tour state
- Saves/loads tour progress to/from AsyncStorage
- Manages tour completion flags
- Handles migration of legacy tour data

**TourOverlay**: UI component displaying tour instructions
- Renders step content with highlights and tooltips
- Displays progress indicator and navigation controls
- Handles user interactions (next, back, dismiss)
- Positions overlay relative to highlighted elements

**SimulatedTripManager**: Manages demonstration trip for tour
- Creates in-memory trip instance
- Simulates obstacle grading without persistence
- Cleans up simulated data after tour step completion

## Components and Interfaces

### TourContext

```typescript
interface TourState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'dismissed';
  simulatedTrip: SimulatedTrip | null;
}

interface TourContextValue {
  state: TourState;
  startTour: () => Promise<void>;
  nextStep: () => Promise<void>;
  previousStep: () => Promise<void>;
  dismissTour: () => Promise<void>;
  completeTour: () => Promise<void>;
  restartTour: () => Promise<void>;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export const useTour = (): TourContextValue => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
};
```

### TourService

```typescript
interface TourStep {
  id: string;
  screen: 'Home' | 'Profile' | 'StartTrip' | 'ActiveTrip' | 'TripHistory';
  title: string;
  description: string;
  highlightElement?: string; // Element ID to highlight
  position: 'top' | 'bottom' | 'center';
  action?: 'navigate' | 'simulate_trip' | 'end_simulation';
}

class TourService {
  private steps: TourStep[];
  private storage: TourStorage;
  private profileService: ProfileService;
  private navigationRef: NavigationContainerRef;

  constructor(
    storage: TourStorage,
    profileService: ProfileService,
    navigationRef: NavigationContainerRef
  ) {
    this.storage = storage;
    this.profileService = profileService;
    this.navigationRef = navigationRef;
    this.steps = this.initializeTourSteps();
  }

  async shouldStartTour(userId: string): Promise<boolean> {
    const profile = await this.profileService.getProfile(userId);
    const tourState = await this.storage.getTourState(userId);
    return !profile.tourCompleted && tourState.status === 'not_started';
  }

  async startTour(userId: string): Promise<TourState> {
    const initialState: TourState = {
      isActive: true,
      currentStep: 0,
      totalSteps: this.steps.length,
      status: 'in_progress',
      simulatedTrip: null,
    };
    await this.storage.saveTourState(userId, initialState);
    return initialState;
  }

  async navigateToStep(
    userId: string,
    stepIndex: number,
    currentState: TourState
  ): Promise<TourState> {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error('Invalid step index');
    }

    const step = this.steps[stepIndex];
    const newState = { ...currentState, currentStep: stepIndex };

    // Handle step-specific actions
    if (step.action === 'navigate') {
      this.navigationRef.navigate(step.screen);
    } else if (step.action === 'simulate_trip') {
      newState.simulatedTrip = this.createSimulatedTrip();
    } else if (step.action === 'end_simulation') {
      newState.simulatedTrip = null;
    }

    await this.storage.saveTourState(userId, newState);
    return newState;
  }

  async dismissTour(userId: string, currentState: TourState): Promise<TourState> {
    const newState: TourState = {
      ...currentState,
      isActive: false,
      status: 'dismissed',
      simulatedTrip: null,
    };
    await this.storage.saveTourState(userId, newState);
    return newState;
  }

  async completeTour(userId: string, currentState: TourState): Promise<TourState> {
    const newState: TourState = {
      ...currentState,
      isActive: false,
      status: 'completed',
      simulatedTrip: null,
    };
    await this.storage.saveTourState(userId, newState);
    await this.profileService.updateProfile(userId, { tourCompleted: true });
    return newState;
  }

  async restartTour(userId: string): Promise<TourState> {
    await this.storage.clearTourState(userId);
    await this.profileService.updateProfile(userId, { tourCompleted: false });
    return this.startTour(userId);
  }

  getStep(index: number): TourStep {
    return this.steps[index];
  }

  private initializeTourSteps(): TourStep[] {
    return [
      {
        id: 'home_profile_nav',
        screen: 'Home',
        title: 'Welcome to Your App!',
        description: 'Let\'s start by exploring your profile. Tap the profile icon to customize your settings.',
        highlightElement: 'profile_nav_button',
        position: 'bottom',
        action: 'navigate',
      },
      {
        id: 'profile_modes',
        screen: 'Profile',
        title: 'Customize Your Modes',
        description: 'Here you can add, remove, or modify your transportation modes for trip recording.',
        highlightElement: 'mode_list_section',
        position: 'center',
        action: 'navigate',
      },
      {
        id: 'start_trip',
        screen: 'StartTrip',
        title: 'Record Your Trips',
        description: 'Tap the start button to begin recording a trip. We\'ll show you how it works with a demo.',
        highlightElement: 'start_trip_button',
        position: 'center',
        action: 'simulate_trip',
      },
      {
        id: 'grade_obstacles',
        screen: 'ActiveTrip',
        title: 'Grade Obstacles',
        description: 'During your trip, you can rate obstacles you encounter. Try grading this demo obstacle.',
        highlightElement: 'obstacle_grading_interface',
        position: 'center',
        action: 'end_simulation',
      },
      {
        id: 'trip_history',
        screen: 'TripHistory',
        title: 'Review Your History',
        description: 'View all your past trips here. You can see details, filter by date, and analyze your routes.',
        highlightElement: 'trip_history_list',
        position: 'top',
      },
    ];
  }

  private createSimulatedTrip(): SimulatedTrip {
    return {
      id: 'simulated_trip_demo',
      isSimulated: true,
      startTime: new Date(),
      mode: 'walking',
      obstacles: [],
    };
  }
}
```

### TourStorage

```typescript
interface StoredTourState {
  currentStep: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'dismissed';
  lastUpdated: string;
}

class TourStorage {
  private readonly TOUR_STATE_KEY = '@tour_state_';

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
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load tour state:', error);
      return {
        currentStep: 0,
        status: 'not_started',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

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

  async clearTourState(userId: string): Promise<void> {
    try {
      const key = `${this.TOUR_STATE_KEY}${userId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear tour state:', error);
      throw error;
    }
  }
}
```

### TourOverlay Component

```typescript
interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onDismiss: () => void;
  onComplete: () => void;
}

const TourOverlay: React.FC<TourOverlayProps> = ({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onDismiss,
  onComplete,
}) => {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <View style={styles.overlay}>
      {/* Semi-transparent backdrop */}
      <View style={styles.backdrop} />
      
      {/* Highlight cutout for target element */}
      <HighlightCutout elementId={step.highlightElement} />
      
      {/* Tour content card */}
      <View style={[styles.contentCard, getPositionStyle(step.position)]}>
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {currentStep + 1} of {totalSteps}
          </Text>
          <TouchableOpacity onPress={onDismiss} accessibilityLabel="Dismiss tour">
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        {/* Step content */}
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
        
        {/* Navigation controls */}
        <View style={styles.navigationContainer}>
          {!isFirstStep && (
            <TouchableOpacity
              onPress={onPrevious}
              style={styles.navButton}
              accessibilityLabel="Previous step"
            >
              <Icon name="arrow-left" size={20} />
              <Text style={styles.navButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.spacer} />
          
          {isLastStep ? (
            <TouchableOpacity
              onPress={onComplete}
              style={[styles.navButton, styles.primaryButton]}
              accessibilityLabel="Finish tour"
            >
              <Text style={styles.primaryButtonText}>Finish</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onNext}
              style={[styles.navButton, styles.primaryButton]}
              accessibilityLabel="Next step"
            >
              <Text style={styles.primaryButtonText}>Next</Text>
              <Icon name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};
```

### SimulatedTrip Integration

```typescript
interface SimulatedTrip {
  id: string;
  isSimulated: boolean;
  startTime: Date;
  mode: string;
  obstacles: SimulatedObstacle[];
}

interface SimulatedObstacle {
  id: string;
  type: string;
  rating: number | null;
  timestamp: Date;
}

class SimulatedTripManager {
  private currentSimulation: SimulatedTrip | null = null;

  createSimulation(mode: string): SimulatedTrip {
    this.currentSimulation = {
      id: `sim_${Date.now()}`,
      isSimulated: true,
      startTime: new Date(),
      mode,
      obstacles: [
        {
          id: 'demo_obstacle_1',
          type: 'curb',
          rating: null,
          timestamp: new Date(),
        },
      ],
    };
    return this.currentSimulation;
  }

  gradeObstacle(obstacleId: string, rating: number): void {
    if (!this.currentSimulation) {
      throw new Error('No active simulation');
    }
    const obstacle = this.currentSimulation.obstacles.find(o => o.id === obstacleId);
    if (obstacle) {
      obstacle.rating = rating;
    }
  }

  endSimulation(): void {
    this.currentSimulation = null;
  }

  isSimulationActive(): boolean {
    return this.currentSimulation !== null;
  }

  getCurrentSimulation(): SimulatedTrip | null {
    return this.currentSimulation;
  }
}
```

## Data Models

### TourState

```typescript
interface TourState {
  isActive: boolean;          // Whether tour overlay is currently displayed
  currentStep: number;        // Zero-based index of current step
  totalSteps: number;         // Total number of steps in tour
  status: TourStatus;         // Current tour lifecycle status
  simulatedTrip: SimulatedTrip | null;  // Active simulated trip for demo
}

type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';
```

### TourStep

```typescript
interface TourStep {
  id: string;                 // Unique identifier for the step
  screen: ScreenName;         // Target screen for this step
  title: string;              // Step title displayed in overlay
  description: string;        // Instructional text for the step
  highlightElement?: string;  // Optional element ID to highlight
  position: OverlayPosition;  // Vertical position of overlay card
  action?: TourAction;        // Optional action to perform on step entry
}

type ScreenName = 'Home' | 'Profile' | 'StartTrip' | 'ActiveTrip' | 'TripHistory';
type OverlayPosition = 'top' | 'bottom' | 'center';
type TourAction = 'navigate' | 'simulate_trip' | 'end_simulation';
```

### StoredTourState

```typescript
interface StoredTourState {
  currentStep: number;        // Last completed step index
  status: TourStatus;         // Tour lifecycle status
  lastUpdated: string;        // ISO timestamp of last state change
}
```

### ProfileExtension

```typescript
// Extension to existing Profile model
interface Profile {
  // ... existing fields
  tourCompleted: boolean;     // Flag indicating tour completion
}
```

### SimulatedTrip

```typescript
interface SimulatedTrip {
  id: string;                 // Unique identifier with 'sim_' prefix
  isSimulated: boolean;       // Always true for simulated trips
  startTime: Date;            // Simulation start timestamp
  mode: string;               // Transportation mode for demo
  obstacles: SimulatedObstacle[];  // Demo obstacles for grading
}

interface SimulatedObstacle {
  id: string;                 // Unique obstacle identifier
  type: string;               // Obstacle type (e.g., 'curb', 'pothole')
  rating: number | null;      // User-assigned rating (1-5) or null
  timestamp: Date;            // When obstacle was encountered
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **State Persistence Properties (9.1, 9.2)**: These can be combined into a single comprehensive property about persisting all state changes
2. **Tour Non-Activation Properties (1.2, 9.4, 9.5)**: These all test that tours don't start under certain conditions and can be unified
3. **Simulated Trip Non-Persistence (7.6, 7.7, 11.3)**: These all verify simulated trips don't persist and can be combined
4. **Dismissal Properties (3.2, 3.3, 3.4)**: These test different aspects of dismissal but can be verified in a single comprehensive property

The following properties represent the unique, non-redundant correctness guarantees:

### Tour Initialization Properties

**Property 1: New user tour activation**
*For any* user who has just completed profile creation and has tourCompleted=false and no existing tour state, calling shouldStartTour should return true and startTour should initialize the tour with isActive=true, currentStep=0, status='in_progress', and totalSteps equal to the number of configured steps.
**Validates: Requirements 1.1, 1.3**

**Property 2: Tour non-activation for completed users**
*For any* user with tourCompleted=true or tour status='completed' or status='dismissed', calling shouldStartTour should return false.
**Validates: Requirements 1.2, 9.4, 9.5**

**Property 3: Tour state persistence on start**
*For any* user, after calling startTour, reading the tour state from storage should return the same state that was initialized.
**Validates: Requirements 1.4**

**Property 4: Profile completion tracking**
*For any* user, after calling completeTour, the user's profile should have tourCompleted=true.
**Validates: Requirements 1.5**

### Navigation Properties

**Property 5: Forward navigation advances step**
*For any* tour state where currentStep < totalSteps - 1, calling nextStep should result in currentStep being incremented by 1.
**Validates: Requirements 2.2**

**Property 6: Backward navigation decrements step**
*For any* tour state where currentStep > 0, calling previousStep should result in currentStep being decremented by 1.
**Validates: Requirements 2.3**

**Property 7: Screen navigation on step change**
*For any* two consecutive steps with different screen values, navigating from one to the other should trigger navigation to the target screen.
**Validates: Requirements 2.7**

**Property 8: Tour completion on finish**
*For any* tour state where currentStep equals totalSteps - 1, calling completeTour should result in status='completed' and isActive=false.
**Validates: Requirements 2.6**

### UI Rendering Properties

**Property 9: Progress indicator display**
*For any* tour state with isActive=true, rendering the TourOverlay should display text containing both the current step number (currentStep + 1) and total steps.
**Validates: Requirements 2.1**

**Property 10: Dismiss button presence**
*For any* tour state with isActive=true, rendering the TourOverlay should include a dismiss button or close icon.
**Validates: Requirements 3.1**

**Property 11: Accessibility labels**
*For any* interactive element in the TourOverlay (next, back, dismiss, finish buttons), the rendered component should have an accessibilityLabel attribute.
**Validates: Requirements 10.4**

### Dismissal Properties

**Property 12: Tour dismissal state changes**
*For any* active tour state, calling dismissTour should result in status='dismissed', isActive=false, simulatedTrip=null, and the dismissed state should be persisted to storage.
**Validates: Requirements 3.2, 3.3, 3.4**

**Property 13: Restart after dismissal**
*For any* user with a dismissed tour, calling restartTour should successfully create a new tour state with status='in_progress' and currentStep=0.
**Validates: Requirements 3.5**

### Restart Properties

**Property 14: Tour restart resets state**
*For any* user, calling restartTour should clear the stored tour state, set the profile's tourCompleted to false, and initialize a new tour starting at step 0.
**Validates: Requirements 4.2, 4.3, 4.4**

**Property 15: Restart navigates to home**
*For any* user not currently on the Home screen, calling restartTour should trigger navigation to the Home screen.
**Validates: Requirements 4.5**

### Simulated Trip Properties

**Property 16: Simulated trip creation**
*For any* tour step with action='simulate_trip', navigating to that step should create a SimulatedTrip object with isSimulated=true and simulatedTrip should not be null in the tour state.
**Validates: Requirements 7.2**

**Property 17: Simulated trip cleanup**
*For any* tour state with an active simulatedTrip, advancing past the simulation steps should set simulatedTrip to null.
**Validates: Requirements 7.5**

**Property 18: Simulated trip non-persistence**
*For any* SimulatedTrip with isSimulated=true, the trip should not appear in trip history queries, should not be passed to TripService persistence methods, and should not sync to the backend.
**Validates: Requirements 7.6, 7.7, 11.3**

### State Persistence Properties

**Property 19: Tour state persistence on changes**
*For any* tour state change (step navigation, dismissal, completion), the new state (currentStep and status) should be persisted to local storage immediately.
**Validates: Requirements 9.1, 9.2**

**Property 20: Tour resumption after restart**
*For any* user with a saved tour state where status='in_progress' and currentStep=N, reloading the tour state from storage should restore the tour at step N.
**Validates: Requirements 9.3**

### Navigation Blocking Property

**Property 21: Tour navigation restriction**
*For any* active tour state, attempting to navigate to a screen that is not the current tour step's target screen should be prevented unless the user dismisses the tour.
**Validates: Requirements 10.5**

### Integration Properties

**Property 22: ProfileService integration**
*For any* tour lifecycle operation (start, complete, restart), the TourService should call the appropriate ProfileService methods to check or update the tourCompleted flag.
**Validates: Requirements 11.1**

**Property 23: Navigation system integration**
*For any* step transition that requires screen navigation, the TourService should use the provided navigationRef to navigate to the target screen.
**Validates: Requirements 11.2**

**Property 24: Authentication requirement**
*For any* unauthenticated user, calling shouldStartTour should return false regardless of tour completion status.
**Validates: Requirements 11.4**

## Error Handling

### Tour State Errors

**Invalid Step Navigation**:
- When navigating to a step index < 0 or >= totalSteps, throw an error with message "Invalid step index"
- Prevent state corruption by validating step bounds before any state changes
- Log error details for debugging

**Storage Failures**:
- When AsyncStorage operations fail, log the error and return default values
- For getTourState failures, return default state: { currentStep: 0, status: 'not_started', lastUpdated: ISO timestamp }
- For saveTourState failures, throw the error to allow caller to handle retry logic
- For clearTourState failures, log the error but don't throw (clearing is best-effort)

**Missing Context Errors**:
- When useTour hook is called outside TourProvider, throw error: "useTour must be used within TourProvider"
- Provide clear error messages to help developers identify integration issues

### Simulated Trip Errors

**No Active Simulation**:
- When gradeObstacle is called without an active simulation, throw error: "No active simulation"
- Validate simulation state before any operations

**Invalid Obstacle ID**:
- When grading an obstacle that doesn't exist in the simulation, silently ignore (no-op)
- Log warning for debugging purposes

### Navigation Errors

**Navigation Ref Not Available**:
- When navigationRef is null or undefined during step navigation, log error and skip navigation
- Allow tour to continue with overlay updates even if navigation fails
- Display error message to user: "Navigation unavailable. Please restart the tour."

**Screen Not Found**:
- When navigating to a screen that doesn't exist in the navigation stack, log error
- Fall back to home screen navigation
- Continue tour flow to prevent user from being stuck

### Profile Service Errors

**Profile Update Failures**:
- When updating tourCompleted flag fails, log error but don't block tour completion
- Tour state in local storage serves as backup source of truth
- Retry profile update on next app launch

**Profile Not Found**:
- When checking tour status for non-existent user, return shouldStartTour=false
- Log warning for debugging
- Prevent tour from starting for invalid users

### Recovery Strategies

**Corrupted Tour State**:
- If loaded tour state has invalid values (e.g., currentStep > totalSteps), reset to default state
- Log corruption details for debugging
- Notify user: "Tour state was reset due to an error"

**Incomplete Tour Steps Configuration**:
- Validate tour steps array on service initialization
- Ensure all required fields are present for each step
- Throw error during initialization if configuration is invalid: "Invalid tour configuration"

**Concurrent Tour Operations**:
- Use state management to prevent concurrent modifications
- Queue tour actions if one is already in progress
- Ensure atomic state updates to prevent race conditions

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific step configurations (home screen step, profile step, etc.)
- Error conditions (invalid step index, missing navigation ref)
- UI component rendering with specific props
- Integration between TourService and ProfileService

**Property-Based Tests**: Verify universal properties across all inputs
- Tour state transitions with random step numbers
- Navigation logic with randomly generated tour configurations
- Persistence round-trips with random state values
- Simulated trip lifecycle with random trip data

### Property-Based Testing Configuration

**Testing Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: onboarding-tutorial-tour, Property {N}: {property title}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Feature: onboarding-tutorial-tour', () => {
  it('Property 5: Forward navigation advances step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // currentStep < totalSteps - 1
        async (currentStep) => {
          const totalSteps = 5;
          const state: TourState = {
            isActive: true,
            currentStep,
            totalSteps,
            status: 'in_progress',
            simulatedTrip: null,
          };
          
          const newState = await tourService.navigateToStep(
            'user123',
            currentStep + 1,
            state
          );
          
          expect(newState.currentStep).toBe(currentStep + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage

**TourService Tests**:
- shouldStartTour with various user profiles
- startTour initialization
- navigateToStep with valid and invalid indices
- dismissTour state changes
- completeTour with profile updates
- restartTour state reset
- Error handling for storage failures

**TourStorage Tests**:
- getTourState with existing and non-existing data
- saveTourState persistence
- clearTourState removal
- Error handling for AsyncStorage failures
- Data migration for legacy formats

**TourOverlay Tests**:
- Rendering with different step configurations
- Progress indicator display
- Navigation button states (first step, last step, middle steps)
- Dismiss button presence
- Accessibility labels on all interactive elements

**SimulatedTripManager Tests**:
- createSimulation initialization
- gradeObstacle updates
- endSimulation cleanup
- isSimulationActive state checks
- Error handling for invalid operations

**Integration Tests**:
- Full tour flow from start to completion
- Tour dismissal and restart
- Simulated trip creation and cleanup during tour
- Profile service integration for completion tracking
- Navigation between screens during tour
- State persistence and resumption after app restart

### Test Data Generators

For property-based tests, define generators for:
- Random tour states (valid and edge cases)
- Random step indices (within and outside bounds)
- Random user profiles (with various tourCompleted values)
- Random tour step configurations
- Random simulated trips with obstacles

### Coverage Goals

- Line coverage: > 90%
- Branch coverage: > 85%
- Property test iterations: 100 per property
- All 24 correctness properties implemented as property tests
- All error conditions covered by unit tests
