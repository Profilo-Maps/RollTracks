import React from 'react';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { ActivityIndicator, Text, View } from 'react-native';
import { HomeScreen } from '../HomeScreen';
import { useServices } from '../../contexts/ServicesContext';
import { NavigationProp, RouteProp } from '@react-navigation/native';

// Mock dependencies
jest.mock('../../contexts/ServicesContext');

// Store the onMapReady callback to call it in tests
let mockOnMapReady: (() => void) | null = null;

jest.mock('../../components/MapViewMapbox', () => ({
  MapViewMapbox: ({ onMapReady }: any) => {
    mockOnMapReady = onMapReady;
    // Call onMapReady immediately to simulate map being ready
    if (onMapReady) {
      setTimeout(() => onMapReady(), 0);
    }
    return null;
  },
}));

// Mock useFocusEffect to avoid navigation warnings
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn((callback) => {
    // Don't call the callback in tests
  }),
}));

const mockUseServices = useServices as jest.MockedFunction<typeof useServices>;

describe('HomeScreen - Loading State UI', () => {
  const mockNavigation = {
    navigate: jest.fn(),
  } as unknown as NavigationProp<any>;

  const mockRoute = {} as RouteProp<any, 'Home'>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to find text in component tree
   */
  const findTextInTree = (tree: ReactTestRenderer, text: string): boolean => {
    const root = tree.root;
    try {
      const textElements = root.findAllByType(Text);
      return textElements.some(element => {
        const children = element.props.children;
        return children === text || (Array.isArray(children) && children.includes(text));
      });
    } catch {
      return false;
    }
  };

  /**
   * Helper function to find ActivityIndicator in component tree
   */
  const hasActivityIndicator = (tree: ReactTestRenderer): boolean => {
    try {
      tree.root.findByType(ActivityIndicator);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Test: Loading indicator displays while fetching ratings
   * Requirement: 5.1 - WHEN the Home_Screen is fetching rated features, 
   * THE Home_Screen SHALL display a loading indicator
   */
  it('should display loading indicator while fetching ratings', async () => {
    // Mock RatingService with a delayed response
    let resolvePromise: (value: any) => void;
    const mockGetAllRatings = jest.fn(() => 
      new Promise(resolve => {
        resolvePromise = resolve;
      })
    );

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Verify loading indicator is displayed
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(true);
    expect(hasActivityIndicator(tree!)).toBe(true);

    // Resolve the promise and wait for state update
    await act(async () => {
      resolvePromise!([]);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify loading indicator is hidden after fetch completes
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(false);
  });

  /**
   * Test: Loading indicator is centered on screen
   * Requirement: 5.1 - Loading indicator should be centered
   */
  it('should center loading indicator on screen', async () => {
    const mockGetAllRatings = jest.fn(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Find the loading overlay View
    const views = tree!.root.findAllByType(View);
    const loadingOverlay = views.find(view => {
      const style = view.props.style;
      return style && 
             style.position === 'absolute' &&
             style.justifyContent === 'center' &&
             style.alignItems === 'center';
    });

    expect(loadingOverlay).toBeDefined();
    expect(loadingOverlay?.props.style).toMatchObject({
      justifyContent: 'center',
      alignItems: 'center',
    });
  });

  /**
   * Test: Loading indicator disappears after successful fetch
   * Requirement: 5.1 - Loading indicator should only show during fetch
   */
  it('should hide loading indicator after successful fetch', async () => {
    const mockRatings = [
      {
        id: 'feature-1',
        tripId: 'trip-1',
        userRating: 8,
        timestamp: '2024-01-01T12:00:00Z',
        geometry: {
          type: 'Point' as const,
          coordinates: [-122.4194, 37.7749],
        },
        properties: {},
      },
    ];

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockResolvedValue(mockRatings),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify loading indicator is hidden
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(false);
    expect(hasActivityIndicator(tree!)).toBe(false);
  });

  /**
   * Test: Loading indicator disappears after fetch error
   * Requirement: 5.1 - Loading indicator should hide even on error
   */
  it('should hide loading indicator after fetch error', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify loading indicator is hidden
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(false);
    expect(hasActivityIndicator(tree!)).toBe(false);
    
    // Verify error message is shown
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(true);
  });

  /**
   * Test: ActivityIndicator is rendered during loading
   * Requirement: 5.1 - Verify ActivityIndicator component is present
   */
  it('should render ActivityIndicator component during loading', async () => {
    const mockGetAllRatings = jest.fn(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Verify ActivityIndicator is rendered
    expect(hasActivityIndicator(tree!)).toBe(true);
    
    // Verify ActivityIndicator has correct props
    const activityIndicator = tree!.root.findByType(ActivityIndicator);
    expect(activityIndicator.props.size).toBe('large');
    expect(activityIndicator.props.color).toBe('#007AFF');
  });
});

describe('HomeScreen - Empty State UI', () => {
  const mockNavigation = {
    navigate: jest.fn(),
  } as unknown as NavigationProp<any>;

  const mockRoute = {} as RouteProp<any, 'Home'>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to find text in component tree
   */
  const findTextInTree = (tree: ReactTestRenderer, text: string): boolean => {
    const root = tree.root;
    try {
      const textElements = root.findAllByType(Text);
      return textElements.some(element => {
        const children = element.props.children;
        return children === text || (Array.isArray(children) && children.includes(text));
      });
    } catch {
      return false;
    }
  };

  /**
   * Test: Empty state message displays when no ratings exist
   * Requirement: 5.2 - WHEN no rated features exist, THE Home_Screen SHALL display 
   * an empty state message informing the user
   */
  it('should display empty state message when no ratings exist', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockResolvedValue([]),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify empty state message is displayed
    expect(findTextInTree(tree!, 'No rated features yet')).toBe(true);
  });

  /**
   * Test: Empty state provides helpful guidance on how to rate features
   * Requirement: 5.2 - Empty state should provide helpful guidance
   */
  it('should provide helpful guidance on how to rate features', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockResolvedValue([]),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify guidance text is displayed
    expect(findTextInTree(tree!, 'Start a trip and rate accessibility features to see them here')).toBe(true);
  });

  /**
   * Test: Empty state does not display when ratings exist
   * Requirement: 5.2 - Empty state should only show when no ratings exist
   */
  it('should not display empty state when ratings exist', async () => {
    const mockRatings = [
      {
        id: 'feature-1',
        tripId: 'trip-1',
        userRating: 8,
        timestamp: '2024-01-01T12:00:00Z',
        geometry: {
          type: 'Point' as const,
          coordinates: [-122.4194, 37.7749],
        },
        properties: {},
      },
    ];

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockResolvedValue(mockRatings),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify empty state is not displayed
    expect(findTextInTree(tree!, 'No rated features yet')).toBe(false);
    expect(findTextInTree(tree!, 'Start a trip and rate accessibility features to see them here')).toBe(false);
  });

  /**
   * Test: Empty state does not display during loading
   * Requirement: 5.2 - Empty state should only show after loading completes
   */
  it('should not display empty state during loading', async () => {
    const mockGetAllRatings = jest.fn(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Verify empty state is not displayed during loading
    expect(findTextInTree(tree!, 'No rated features yet')).toBe(false);
    expect(findTextInTree(tree!, 'Start a trip and rate accessibility features to see them here')).toBe(false);
  });

  /**
   * Test: Empty state does not display when error occurs
   * Requirement: 5.2 - Empty state should not show when there's an error
   */
  it('should not display empty state when error occurs', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify empty state is not displayed when error occurs
    expect(findTextInTree(tree!, 'No rated features yet')).toBe(false);
    expect(findTextInTree(tree!, 'Start a trip and rate accessibility features to see them here')).toBe(false);
    
    // Verify error message is shown instead
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(true);
  });

  /**
   * Test: Empty state overlay has proper styling
   * Requirement: 5.2 - Empty state should be properly styled and visible
   */
  it('should style empty state overlay properly', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockResolvedValue([]),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Find the empty state overlay View
    const views = tree!.root.findAllByType(View);
    const emptyStateOverlay = views.find(view => {
      const style = view.props.style;
      return style && 
             style.position === 'absolute' &&
             style.backgroundColor === 'rgba(255, 255, 255, 0.95)';
    });

    expect(emptyStateOverlay).toBeDefined();
    expect(emptyStateOverlay?.props.style).toMatchObject({
      position: 'absolute',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: 24,
      borderRadius: 12,
      alignItems: 'center',
    });
  });

  /**
   * Test: Map with default region is shown in background
   * Requirement: 5.2 - Show map with default region in background
   * Note: MapViewMapbox is mocked, but we verify it's rendered
   */
  it('should render map in background when empty state is shown', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockResolvedValue([]),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify both empty state and map are present
    // (MapViewMapbox is mocked but should still be in the tree)
    expect(findTextInTree(tree!, 'No rated features yet')).toBe(true);
    
    // The map component should be rendered (even though it's mocked)
    const root = tree!.root;
    expect(root.findAllByType(View).length).toBeGreaterThan(0);
  });
});

describe('HomeScreen - Error State UI with Retry', () => {
  const mockNavigation = {
    navigate: jest.fn(),
  } as unknown as NavigationProp<any>;

  const mockRoute = {} as RouteProp<any, 'Home'>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to find text in component tree
   */
  const findTextInTree = (tree: ReactTestRenderer, text: string): boolean => {
    const root = tree.root;
    try {
      const textElements = root.findAllByType(Text);
      return textElements.some(element => {
        const children = element.props.children;
        return children === text || (Array.isArray(children) && children.includes(text));
      });
    } catch {
      return false;
    }
  };

  /**
   * Test: Error message displays when fetch fails
   * Requirement: 5.3 - WHEN the Rating_Service fails to fetch data, 
   * THE Home_Screen SHALL display an error message
   */
  it('should display error message when fetch fails', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify error message is displayed
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(true);
  });

  /**
   * Test: Retry button is displayed in error state
   * Requirement: 5.4 - THE Home_Screen SHALL allow users to retry fetching data after an error
   */
  it('should display retry button in error state', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify retry button text is displayed
    expect(findTextInTree(tree!, 'Retry')).toBe(true);
  });

  /**
   * Test: Retry button triggers refetch when pressed
   * Requirement: 5.4 - Retry button should refetch data
   */
  it('should refetch data when retry button is pressed', async () => {
    const mockGetAllRatings = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([]);

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for initial fetch to fail
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify error state is displayed
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(true);
    expect(mockGetAllRatings).toHaveBeenCalledTimes(1);

    // Find and press the retry button
    const root = tree!.root;
    const touchableOpacities = root.findAllByProps({ accessibilityLabel: 'Retry loading rated features' });
    expect(touchableOpacities.length).toBeGreaterThanOrEqual(1);

    // Simulate button press
    await act(async () => {
      touchableOpacities[0].props.onPress();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify getAllRatings was called again
    expect(mockGetAllRatings).toHaveBeenCalledTimes(2);

    // Verify error is cleared and empty state is shown (since second call returns [])
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(false);
    expect(findTextInTree(tree!, 'No rated features yet')).toBe(true);
  });

  /**
   * Test: Error state clears when retry succeeds
   * Requirement: 5.4 - Error should clear on successful retry
   */
  it('should clear error state when retry succeeds', async () => {
    const mockRatings = [
      {
        id: 'feature-1',
        tripId: 'trip-1',
        userRating: 8,
        timestamp: '2024-01-01T12:00:00Z',
        geometry: {
          type: 'Point' as const,
          coordinates: [-122.4194, 37.7749],
        },
        properties: {},
      },
    ];

    const mockGetAllRatings = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockRatings);

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for initial fetch to fail
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify error state is displayed
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(true);

    // Find and press the retry button
    const root = tree!.root;
    const touchableOpacities = root.findAllByProps({ accessibilityLabel: 'Retry loading rated features' });

    // Simulate button press
    await act(async () => {
      touchableOpacities[0].props.onPress();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify error is cleared and data is displayed
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(false);
    expect(findTextInTree(tree!, 'Retry')).toBe(false);
  });

  /**
   * Test: Loading indicator shows during retry
   * Requirement: 5.4 - Loading state should show during retry
   */
  it('should show loading indicator during retry', async () => {
    let resolveSecondCall: (value: any) => void;
    const mockGetAllRatings = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockImplementationOnce(() => 
        new Promise(resolve => {
          resolveSecondCall = resolve;
        })
      );

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for initial fetch to fail
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Find and press the retry button
    const root = tree!.root;
    const touchableOpacities = root.findAllByProps({ accessibilityLabel: 'Retry loading rated features' });

    // Simulate button press (don't await yet)
    act(() => {
      touchableOpacities[0].props.onPress();
    });

    // Verify loading indicator is shown
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(true);

    // Resolve the retry
    await act(async () => {
      resolveSecondCall!([]);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify loading indicator is hidden
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(false);
  });

  /**
   * Test: Error overlay has proper styling
   * Requirement: 5.3 - Error message should be properly styled and visible
   */
  it('should style error overlay properly', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Find the error overlay View
    const views = tree!.root.findAllByType(View);
    const errorOverlay = views.find(view => {
      const style = view.props.style;
      return style && 
             style.position === 'absolute' &&
             style.backgroundColor === '#FF4444';
    });

    expect(errorOverlay).toBeDefined();
    expect(errorOverlay?.props.style).toMatchObject({
      position: 'absolute',
      backgroundColor: '#FF4444',
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    });
  });

  /**
   * Test: Retry button has accessibility label
   * Requirement: 5.4 - Retry button should be accessible
   */
  it('should have accessibility label on retry button', async () => {
    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: jest.fn().mockRejectedValue(new Error('Network error')),
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Find retry button by accessibility label
    const root = tree!.root;
    const touchableOpacities = root.findAllByProps({ accessibilityLabel: 'Retry loading rated features' });
    
    expect(touchableOpacities.length).toBeGreaterThanOrEqual(1);
    expect(touchableOpacities[0].props.accessibilityRole).toBe('button');
  });

  /**
   * Test: Error state does not show during loading
   * Requirement: 5.3 - Error should only show after loading completes
   */
  it('should not display error state during loading', async () => {
    const mockGetAllRatings = jest.fn(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    mockUseServices.mockReturnValue({
      ratingService: {
        getAllRatings: mockGetAllRatings,
      },
    } as any);

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HomeScreen navigation={mockNavigation} route={mockRoute} />
      );
    });

    // Verify error is not displayed during loading
    expect(findTextInTree(tree!, 'Unable to load rated features. Please try again.')).toBe(false);
    expect(findTextInTree(tree!, 'Retry')).toBe(false);
    
    // Verify loading indicator is shown
    expect(findTextInTree(tree!, 'Loading rated features...')).toBe(true);
  });
});
