import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TourProvider, useTour } from '../TourContext';
import { TourService } from '../../services/TourService';
import { TourStorage } from '../../storage/TourStorage';
import { ProfileService } from '../../services/ProfileService';

// Mock dependencies
jest.mock('../../services/TourService');
jest.mock('../../storage/TourStorage');
jest.mock('../../services/ProfileService');
jest.mock('../AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-123' } }),
}));

/**
 * Integration tests for Tour Navigation Guard
 * 
 * Tests verify that the navigation guard correctly:
 * - Sets up navigation listener when tour is active
 * - Blocks navigation away from current tour step
 * - Allows navigation when tour is not active
 * - Cleans up listeners properly
 * 
 * Validates: Requirement 10.5 - Tour navigation restriction
 */
describe('Tour Navigation Guard Integration', () => {
  let mockNavigationRef: any;
  let mockNavigate: jest.Mock;
  let mockGetRootState: jest.Mock;
  let mockAddListener: jest.Mock;
  let navigationStateCallback: (() => void) | null;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    navigationStateCallback = null;

    // Create mock navigation ref
    mockNavigate = jest.fn();
    mockGetRootState = jest.fn();
    mockAddListener = jest.fn((event: string, callback: () => void) => {
      if (event === 'state') {
        navigationStateCallback = callback;
      }
      // Return unsubscribe function
      return jest.fn();
    });

    mockNavigationRef = {
      current: {
        navigate: mockNavigate,
        getRootState: mockGetRootState,
        addListener: mockAddListener,
      },
    };

    // Mock TourService
    const mockTourService = {
      shouldStartTour: jest.fn().mockResolvedValue(false),
      startTour: jest.fn().mockResolvedValue({
        isActive: true,
        currentStep: 0,
        totalSteps: 5,
        status: 'in_progress',
        simulatedTrip: null,
      }),
      getStep: jest.fn((index: number) => ({
        id: `step_${index}`,
        screen: index === 0 ? 'Home' : index === 1 ? 'Profile' : 'StartTrip',
        title: `Step ${index}`,
        description: `Description ${index}`,
        position: 'center',
      })),
      getTotalSteps: jest.fn().mockReturnValue(5),
      navigateToStep: jest.fn().mockImplementation((userId, stepIndex, state) => ({
        ...state,
        currentStep: stepIndex,
      })),
      dismissTour: jest.fn().mockImplementation((userId, state) => ({
        ...state,
        isActive: false,
        status: 'dismissed',
      })),
    };

    (TourService as jest.Mock).mockImplementation(() => mockTourService);

    // Mock TourStorage
    const mockTourStorage = {
      getTourState: jest.fn().mockResolvedValue({
        currentStep: 0,
        status: 'not_started',
        lastUpdated: new Date().toISOString(),
      }),
      saveTourState: jest.fn().mockResolvedValue(undefined),
      clearTourState: jest.fn().mockResolvedValue(undefined),
    };

    (TourStorage as jest.Mock).mockImplementation(() => mockTourStorage);

    // Mock ProfileService
    const mockProfileService = {
      getProfile: jest.fn().mockResolvedValue({
        id: 'test-user-123',
        tourCompleted: false,
      }),
      updateProfile: jest.fn().mockResolvedValue(undefined),
    };

    (ProfileService as jest.Mock).mockImplementation(() => mockProfileService);
  });

  it('should set up navigation listener when tour provider mounts', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for async effects
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify listener was set up
    expect(mockAddListener).toHaveBeenCalledWith('state', expect.any(Function));
  });

  it('should block navigation to wrong screen when tour is active', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start the tour
    await act(async () => {
      await capturedContext.startTour();
    });

    // Verify tour is active
    expect(capturedContext.state.isActive).toBe(true);
    expect(capturedContext.state.currentStep).toBe(0);

    // Simulate user trying to navigate to Profile screen (wrong screen for step 0)
    mockGetRootState.mockReturnValue({
      routes: [{ name: 'Profile' }],
      index: 0,
    });

    // Trigger navigation state change
    if (navigationStateCallback) {
      act(() => {
        navigationStateCallback!();
      });
    }

    // Wait for navigation guard to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify navigation was blocked and redirected to Home
    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });

  it('should allow navigation to correct screen for current tour step', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start the tour
    await act(async () => {
      await capturedContext.startTour();
    });

    // User is on the correct screen (Home for step 0)
    mockGetRootState.mockReturnValue({
      routes: [{ name: 'Home' }],
      index: 0,
    });

    // Clear previous calls
    mockNavigate.mockClear();

    // Trigger navigation state change
    if (navigationStateCallback) {
      act(() => {
        navigationStateCallback!();
      });
    }

    // Wait for navigation guard to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify no redirect occurred (navigation was allowed)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not block navigation when tour is not active', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify tour is not active
    expect(capturedContext.state.isActive).toBe(false);

    // User navigates to any screen
    mockGetRootState.mockReturnValue({
      routes: [{ name: 'Profile' }],
      index: 0,
    });

    // Trigger navigation state change
    if (navigationStateCallback) {
      act(() => {
        navigationStateCallback!();
      });
    }

    // Wait for navigation guard to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify no redirect occurred (navigation was allowed)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should unblock navigation after tour is dismissed', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start the tour
    await act(async () => {
      await capturedContext.startTour();
    });

    // Verify tour is active
    expect(capturedContext.state.isActive).toBe(true);

    // Dismiss the tour
    await act(async () => {
      await capturedContext.dismissTour();
    });

    // Verify tour is dismissed
    expect(capturedContext.state.isActive).toBe(false);

    // Clear previous navigate calls
    mockNavigate.mockClear();

    // User navigates to any screen
    mockGetRootState.mockReturnValue({
      routes: [{ name: 'Profile' }],
      index: 0,
    });

    // Trigger navigation state change
    if (navigationStateCallback) {
      act(() => {
        navigationStateCallback!();
      });
    }

    // Wait for navigation guard to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify no redirect occurred (navigation was allowed after dismissal)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should handle navigation guard when navigationRef is not available', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    // Create provider without navigation ref
    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={{ current: null }}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not throw error even without navigation ref
    expect(capturedContext.state.isActive).toBe(false);
  });

  it('should handle navigation guard when getRootState returns null', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start the tour
    await act(async () => {
      await capturedContext.startTour();
    });

    // Mock getRootState to return null
    mockGetRootState.mockReturnValue(null);

    // Trigger navigation state change
    if (navigationStateCallback) {
      act(() => {
        navigationStateCallback!();
      });
    }

    // Wait for navigation guard to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should not throw error or attempt navigation
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should update navigation guard when tour step changes', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTour();
      return null;
    };

    await act(async () => {
      renderer.create(
        <TourProvider navigationRef={mockNavigationRef}>
          <TestComponent />
        </TourProvider>
      );
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start the tour
    await act(async () => {
      await capturedContext.startTour();
    });

    // Verify tour is at step 0
    expect(capturedContext.state.currentStep).toBe(0);

    // Advance to next step
    await act(async () => {
      await capturedContext.nextStep();
    });

    // Verify step advanced
    expect(capturedContext.state.currentStep).toBe(1);

    // User is on Home screen (wrong for step 1 which expects Profile)
    mockGetRootState.mockReturnValue({
      routes: [{ name: 'Home' }],
      index: 0,
    });

    // Clear previous calls
    mockNavigate.mockClear();

    // Trigger navigation state change
    if (navigationStateCallback) {
      act(() => {
        navigationStateCallback!();
      });
    }

    // Wait for navigation guard to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify navigation was blocked and redirected to Profile (correct for step 1)
    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });
});
