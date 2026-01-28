import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { TourState } from '../types/tour.types';
import { TourService } from '../services/TourService';
import { TourStorage } from '../storage/TourStorage';
import { useAuth } from './AuthContext';
import { useServices } from './ServicesContext';

/**
 * TourContext Value Interface
 * 
 * Defines the shape of the tour context that will be provided to all components.
 * This interface includes the current tour state and all actions that can be
 * performed on the tour.
 */
export interface TourContextValue {
  /** Current tour state */
  state: TourState;
  
  /** Start the tour from the beginning */
  startTour: () => Promise<void>;
  
  /** Advance to the next step in the tour */
  nextStep: () => Promise<void>;
  
  /** Go back to the previous step in the tour */
  previousStep: () => Promise<void>;
  
  /** Dismiss the tour (can be restarted later) */
  dismissTour: () => Promise<void>;
  
  /** Complete the tour and mark it as finished */
  completeTour: () => Promise<void>;
  
  /** Restart the tour from the beginning (resets completion status) */
  restartTour: () => Promise<void>;
}

/**
 * TourProvider Props Interface
 * 
 * Props required to initialize the TourProvider component.
 */
interface TourProviderProps {
  /** Child components that will have access to tour context */
  children: React.ReactNode;
  
  /** React Navigation container ref for screen navigation */
  navigationRef: any;
}

/**
 * TourContext
 * 
 * React context for managing and providing tour state throughout the application.
 * This context should be provided at the app root level via TourProvider.
 * 
 * @example
 * ```tsx
 * // In App.tsx or root component
 * <TourProvider>
 *   <YourApp />
 * </TourProvider>
 * ```
 */
export const TourContext = createContext<TourContextValue | undefined>(undefined);

/**
 * useTour Hook
 * 
 * Custom hook to access the tour context from any component.
 * This hook provides access to the current tour state and all tour actions.
 * 
 * @throws {Error} If used outside of TourProvider
 * 
 * @returns {TourContextValue} The tour context value with state and actions
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, startTour, nextStep } = useTour();
 *   
 *   if (state.isActive) {
 *     return <TourOverlay />;
 *   }
 *   
 *   return <button onClick={startTour}>Start Tour</button>;
 * }
 * ```
 */
export const useTour = (): TourContextValue => {
  const context = useContext(TourContext);
  
  if (context === undefined) {
    throw new Error('useTour must be used within TourProvider');
  }
  
  return context;
};

/**
 * TourProvider Component
 * 
 * Provides tour state and actions to all child components via React Context.
 * Manages tour lifecycle, state persistence, and integration with services.
 * 
 * Key Features:
 * - Automatic tour start for new users
 * - Tour state persistence and resumption
 * - Integration with ProfileService and TourStorage
 * - Navigation coordination via navigationRef
 * 
 * @param props - TourProvider props
 * @param props.children - Child components to wrap
 * @param props.navigationRef - React Navigation container ref
 * 
 * @example
 * ```tsx
 * // In App.tsx or root component
 * const navigationRef = useNavigationContainerRef();
 * 
 * <TourProvider navigationRef={navigationRef}>
 *   <YourApp />
 * </TourProvider>
 * ```
 */
export const TourProvider: React.FC<TourProviderProps> = ({ children, navigationRef }) => {
  // Get current user from AuthContext
  const { user } = useAuth();
  
  // Get ProfileService from ServicesContext
  const { profileService, isReady: servicesReady } = useServices();
  
  // Initialize tour state with default values
  const [state, setState] = useState<TourState>({
    isActive: false,
    currentStep: 0,
    totalSteps: 5, // Will be updated when TourService initializes
    status: 'not_started',
  });
  
  // Initialize services (using refs to maintain stable instances)
  const tourStorageRef = useRef<TourStorage | null>(null);
  const tourServiceRef = useRef<TourService | null>(null);
  
  // Initialize services on mount
  useEffect(() => {
    // Wait for services to be ready before initializing TourService
    if (!servicesReady || !profileService || !navigationRef) {
      return;
    }
    
    if (!tourStorageRef.current) {
      tourStorageRef.current = new TourStorage();
    }
    if (!tourServiceRef.current) {
      tourServiceRef.current = new TourService(
        tourStorageRef.current,
        profileService,
        navigationRef
      );
      
      // Update totalSteps from service
      setState(prev => ({
        ...prev,
        totalSteps: tourServiceRef.current!.getTotalSteps(),
      }));
    }
  }, [navigationRef, profileService, servicesReady]);
  
  // Load persisted tour state on mount and when user changes
  useEffect(() => {
    const loadTourState = async () => {
      // Wait for services to be ready
      if (!servicesReady || !user?.id || !tourServiceRef.current || !tourStorageRef.current) {
        return;
      }
      
      try {
        // Load persisted state from storage
        const storedState = await tourStorageRef.current.getTourState(user.id);
        
        // Check if tour should automatically start for new users
        const shouldStart = await tourServiceRef.current.shouldStartTour(user.id);
        
        if (shouldStart) {
          // Automatically start tour for new users
          const newState = await tourServiceRef.current.startTour(user.id);
          setState(newState);
        } else if (storedState.status === 'in_progress') {
          // Resume tour from persisted state
          setState({
            isActive: true,
            currentStep: storedState.currentStep,
            totalSteps: tourServiceRef.current.getTotalSteps(),
            status: storedState.status,
          });
        } else {
          // Tour is completed or dismissed, keep inactive
          setState(prev => ({
            ...prev,
            status: storedState.status,
            isActive: false,
          }));
        }
      } catch (error) {
        console.error('Error loading tour state:', error);
      }
    };
    
    loadTourState();
  }, [user?.id, servicesReady, user?.age, user?.modeList]);
  
  /**
   * Navigation Guard Effect - DISABLED
   * 
   * Navigation guard has been disabled as it was causing crashes and navigation loops.
   * Users can freely navigate during the tour and dismiss it if they want to explore.
   */
  // Navigation guard disabled - was causing crashes
  
  /**
   * Start the tour from the beginning
   * 
   * Initializes tour state and navigates to first step.
   */
  const startTour = async (): Promise<void> => {
    if (!user?.id || !tourServiceRef.current) {
      console.warn('Cannot start tour: user not authenticated or service not initialized');
      return;
    }
    
    try {
      const newState = await tourServiceRef.current.startTour(user.id);
      setState(newState);
      
      // Navigate to first step
      await tourServiceRef.current.navigateToStep(user.id, 0, newState);
    } catch (error) {
      console.error('Error starting tour:', error);
    }
  };
  
  /**
   * Advance to the next step in the tour
   * 
   * Increments currentStep and handles step-specific actions.
   */
  const nextStep = async (): Promise<void> => {
    if (!user?.id || !tourServiceRef.current) {
      console.warn('Cannot advance tour: user not authenticated or service not initialized');
      return;
    }
    
    try {
      const nextStepIndex = state.currentStep + 1;
      console.log(`[TOUR DEBUG] nextStep called: currentStep=${state.currentStep}, nextStepIndex=${nextStepIndex}, totalSteps=${state.totalSteps}`);
      
      // Check if we're at the last step
      if (nextStepIndex >= state.totalSteps) {
        console.log('[TOUR DEBUG] At last step, completing tour');
        // Complete the tour instead of advancing
        await completeTour();
        return;
      }
      
      console.log(`[TOUR DEBUG] Navigating to step ${nextStepIndex}`);
      // Navigate to next step
      const newState = await tourServiceRef.current.navigateToStep(
        user.id,
        nextStepIndex,
        state
      );
      console.log(`[TOUR DEBUG] Navigation complete, new state:`, newState);
      setState(newState);
    } catch (error) {
      console.error('Error advancing to next step:', error);
    }
  };
  
  /**
   * Go back to the previous step in the tour
   * 
   * Decrements currentStep if not on first step.
   */
  const previousStep = async (): Promise<void> => {
    if (!user?.id || !tourServiceRef.current) {
      console.warn('Cannot go back: user not authenticated or service not initialized');
      return;
    }
    
    try {
      // Don't go back if already on first step
      if (state.currentStep <= 0) {
        return;
      }
      
      const prevStepIndex = state.currentStep - 1;
      
      // Navigate to previous step
      const newState = await tourServiceRef.current.navigateToStep(
        user.id,
        prevStepIndex,
        state
      );
      setState(newState);
    } catch (error) {
      console.error('Error going to previous step:', error);
    }
  };
  
  /**
   * Dismiss the tour
   * 
   * Sets tour status to 'dismissed' and hides overlay.
   * Tour can be restarted later from settings.
   */
  const dismissTour = async (): Promise<void> => {
    if (!user?.id || !tourServiceRef.current) {
      console.warn('Cannot dismiss tour: user not authenticated or service not initialized');
      return;
    }
    
    try {
      const newState = await tourServiceRef.current.dismissTour(user.id, state);
      setState(newState);
    } catch (error) {
      console.error('Error dismissing tour:', error);
    }
  };
  
  /**
   * Complete the tour
   * 
   * Sets tour status to 'completed', updates profile, and hides overlay.
   */
  const completeTour = async (): Promise<void> => {
    if (!user?.id || !tourServiceRef.current) {
      console.warn('Cannot complete tour: user not authenticated or service not initialized');
      return;
    }
    
    try {
      const newState = await tourServiceRef.current.completeTour(user.id, state);
      setState(newState);
    } catch (error) {
      console.error('Error completing tour:', error);
    }
  };
  
  /**
   * Restart the tour from the beginning
   * 
   * Clears completion status and starts fresh tour from step 0.
   * Navigates to home screen if not already there.
   */
  const restartTour = async (): Promise<void> => {
    if (!user?.id || !tourServiceRef.current) {
      console.warn('Cannot restart tour: user not authenticated or service not initialized');
      return;
    }
    
    try {
      // Navigate to home screen first (requirement 4.5)
      if (navigationRef?.current) {
        try {
          navigationRef.current.navigate('Home');
        } catch (navError) {
          console.error('Error navigating to home screen:', navError);
        }
      }
      
      // Restart the tour
      const newState = await tourServiceRef.current.restartTour(user.id);
      setState(newState);
      
      // Navigate to first step
      await tourServiceRef.current.navigateToStep(user.id, 0, newState);
    } catch (error) {
      console.error('Error restarting tour:', error);
    }
  };
  
  // Create context value
  const contextValue: TourContextValue = {
    state,
    startTour,
    nextStep,
    previousStep,
    dismissTour,
    completeTour,
    restartTour,
  };
  
  return (
    <TourContext.Provider value={contextValue}>
      {children}
    </TourContext.Provider>
  );
};
