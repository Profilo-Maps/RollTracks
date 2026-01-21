/**
 * Integration tests for HomeScreen
 * 
 * These tests verify the complete user flow:
 * - Open Home tab → see rated features → tap marker → navigate to trip history
 * - Various data scenarios: empty ratings, single rating, many ratings
 * - Offline mode functionality
 * - Navigation back to Home tab preserves map state
 * 
 * Requirements: 6.3, 7.4
 */

import React from 'react';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { HomeScreen } from '../HomeScreen';
import { useServices } from '../../contexts/ServicesContext';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { RatedFeature } from '../../types';

// Mock dependencies
jest.mock('../../contexts/ServicesContext');

// Store the onMapReady callback and onFeatureTap handler
let mockOnMapReady: (() => void) | null = null;
let mockOnFeatureTap: ((feature: any) => void) | null = null;

jest.mock('../../components/MapViewMapbox', () => ({
  MapViewMapbox: ({ onMapReady, onFeatureTap }: any) => {
    mockOnMapReady = onMapReady;
    mockOnFeatureTap = onFeatureTap;
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

describe('HomeScreen - Integration Tests', () => {
  let mockNavigation: NavigationProp<any>;
  let mockRoute: RouteProp<any, 'Home'>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigation = {
      navigate: jest.fn(),
    } as unknown as NavigationProp<any>;
    mockRoute = {} as RouteProp<any, 'Home'>;
  });

  /**
   * Integration Test 1: Complete user flow
   * Open Home tab → see rated features → tap marker → navigate to trip history
   * Requirements: 6.3, 7.4
   */
  describe('Complete User Flow', () => {
    it('should display rated features and navigate to trip history on marker tap', async () => {
      // Setup: Create mock ratings data
      const mockRatings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-123',
          userRating: 8,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-2',
          tripId: 'trip-456',
          userRating: 5,
          timestamp: '2024-01-02T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4084, 37.7849],
          },
          properties: { type: 'ramp' },
        },
      ];

      mockUseServices.mockReturnValue({
        ratingService: {
          getAllRatings: jest.fn().mockResolvedValue(mockRatings),
        },
      } as any);

      // Step 1: Open Home tab (render HomeScreen)
      let tree: ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <HomeScreen navigation={mockNavigation} route={mockRoute} />
        );
      });

      // Wait for data to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Step 2: Verify rated features are displayed (MapViewMapbox receives correct data)
      // The MapViewMapbox mock should have been called with obstacleFeatures
      expect(mockOnFeatureTap).not.toBeNull();

      // Step 3: Simulate tapping a marker
      const tappedFeature = {
        id: 'feature-1',
        latitude: 37.7749,
        longitude: -122.4194,
        attributes: { type: 'curb' },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      // Step 4: Verify navigation to TripHistoryScreen with correct trip_id
      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-123',
      });
    });

    it('should handle marker tap for feature with multiple ratings', async () => {
      // Setup: Feature with multiple ratings - should navigate to most recent trip
      const mockRatings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-old',
          userRating: 3,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-1',
          tripId: 'trip-recent',
          userRating: 8,
          timestamp: '2024-01-05T12:00:00Z', // Most recent
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-1',
          tripId: 'trip-middle',
          userRating: 5,
          timestamp: '2024-01-03T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Tap the marker
      const tappedFeature = {
        id: 'feature-1',
        latitude: 37.7749,
        longitude: -122.4194,
        attributes: { type: 'curb' },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      // Should navigate to the most recent trip
      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-recent',
      });
    });
  });

  /**
   * Integration Test 2: Various data scenarios
   * Requirements: 6.3
   */
  describe('Data Scenarios', () => {
    it('should handle empty ratings scenario', async () => {
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify empty state is displayed
      const textElements = tree!.root.findAllByType(require('react-native').Text);
      const hasEmptyState = textElements.some(el => 
        el.props.children === 'No rated features yet'
      );
      expect(hasEmptyState).toBe(true);

      // Verify no navigation occurs
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('should handle single rating scenario', async () => {
      const mockRatings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-123',
          userRating: 7,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Tap the single marker
      const tappedFeature = {
        id: 'feature-1',
        latitude: 37.7749,
        longitude: -122.4194,
        attributes: { type: 'curb' },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      // Should navigate correctly
      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-123',
      });
    });

    it('should handle many ratings scenario (100+ features)', async () => {
      // Generate 150 unique features
      const mockRatings: RatedFeature[] = Array.from({ length: 150 }, (_, i) => ({
        id: `feature-${i}`,
        tripId: `trip-${i}`,
        userRating: (i % 10) + 1, // Ratings 1-10
        timestamp: `2024-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
        geometry: {
          type: 'Point' as const,
          coordinates: [-122.4194 + (i * 0.001), 37.7749 + (i * 0.001)],
        },
        properties: { type: 'curb', index: i },
      }));

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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify no empty state
      const textElements = tree!.root.findAllByType(require('react-native').Text);
      const hasEmptyState = textElements.some(el => 
        el.props.children === 'No rated features yet'
      );
      expect(hasEmptyState).toBe(false);

      // Tap a marker from the middle of the list
      const tappedFeature = {
        id: 'feature-75',
        latitude: 37.7749 + (75 * 0.001),
        longitude: -122.4194 + (75 * 0.001),
        attributes: { type: 'curb', index: 75 },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      // Should navigate correctly
      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-75',
      });
    });

    it('should handle ratings with various rating values (1-10)', async () => {
      const mockRatings: RatedFeature[] = [
        {
          id: 'feature-low',
          tripId: 'trip-low',
          userRating: 2, // Low rating (red)
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-mid',
          tripId: 'trip-mid',
          userRating: 5, // Mid rating (yellow)
          timestamp: '2024-01-02T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4084, 37.7849],
          },
          properties: { type: 'ramp' },
        },
        {
          id: 'feature-high',
          tripId: 'trip-high',
          userRating: 9, // High rating (green)
          timestamp: '2024-01-03T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.3984, 37.7949],
          },
          properties: { type: 'sidewalk' },
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Tap each marker and verify navigation
      for (const rating of mockRatings) {
        const [longitude, latitude] = rating.geometry.coordinates;
        const tappedFeature = {
          id: rating.id,
          latitude,
          longitude,
          attributes: rating.properties,
        };

        await act(async () => {
          mockOnFeatureTap!(tappedFeature);
        });

        expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
          highlightTripId: rating.tripId,
        });

        jest.clearAllMocks();
      }
    });
  });

  /**
   * Integration Test 3: Offline mode functionality
   * Requirements: 6.3
   */
  describe('Offline Mode', () => {
    it('should display locally stored ratings in offline mode', async () => {
      // Simulate offline mode by returning locally cached data
      const mockRatings: RatedFeature[] = [
        {
          id: 'feature-offline',
          tripId: 'trip-offline',
          userRating: 6,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb', cached: true },
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify data is displayed (no error state)
      const textElements = tree!.root.findAllByType(require('react-native').Text);
      const hasError = textElements.some(el => 
        el.props.children === 'Unable to load rated features. Please try again.'
      );
      expect(hasError).toBe(false);

      // Verify marker tap works in offline mode
      const tappedFeature = {
        id: 'feature-offline',
        latitude: 37.7749,
        longitude: -122.4194,
        attributes: { type: 'curb', cached: true },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-offline',
      });
    });

    it('should handle offline mode with no cached data', async () => {
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify empty state is displayed
      const textElements = tree!.root.findAllByType(require('react-native').Text);
      const hasEmptyState = textElements.some(el => 
        el.props.children === 'No rated features yet'
      );
      expect(hasEmptyState).toBe(true);
    });
  });

  /**
   * Integration Test 4: Navigation back to Home tab preserves map state
   * Requirements: 7.4
   */
  describe('Map State Preservation', () => {
    it('should preserve map data when navigating away and back', async () => {
      const mockRatings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-123',
          userRating: 8,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
      ];

      const mockGetAllRatings = jest.fn().mockResolvedValue(mockRatings);

      mockUseServices.mockReturnValue({
        ratingService: {
          getAllRatings: mockGetAllRatings,
        },
      } as any);

      // Initial render
      let tree: ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <HomeScreen navigation={mockNavigation} route={mockRoute} />
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify initial data load
      expect(mockGetAllRatings).toHaveBeenCalledTimes(1);

      // Simulate navigation away (unmount)
      await act(async () => {
        tree!.unmount();
      });

      // Simulate navigation back (remount)
      await act(async () => {
        tree = renderer.create(
          <HomeScreen navigation={mockNavigation} route={mockRoute} />
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify data is reloaded (useFocusEffect would trigger this in real app)
      // In our test, it's called on mount
      expect(mockGetAllRatings).toHaveBeenCalledTimes(2);

      // Verify marker tap still works after returning
      const tappedFeature = {
        id: 'feature-1',
        latitude: 37.7749,
        longitude: -122.4194,
        attributes: { type: 'curb' },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-123',
      });
    });

    it('should refresh data when returning to Home tab after adding new ratings', async () => {
      // Initial ratings
      const initialRatings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-123',
          userRating: 8,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
      ];

      // Updated ratings (new feature added)
      const updatedRatings: RatedFeature[] = [
        ...initialRatings,
        {
          id: 'feature-2',
          tripId: 'trip-456',
          userRating: 5,
          timestamp: '2024-01-02T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4084, 37.7849],
          },
          properties: { type: 'ramp' },
        },
      ];

      const mockGetAllRatings = jest.fn()
        .mockResolvedValueOnce(initialRatings)
        .mockResolvedValueOnce(updatedRatings);

      mockUseServices.mockReturnValue({
        ratingService: {
          getAllRatings: mockGetAllRatings,
        },
      } as any);

      // Initial render
      let tree: ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <HomeScreen navigation={mockNavigation} route={mockRoute} />
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify initial data
      expect(mockGetAllRatings).toHaveBeenCalledTimes(1);

      // Simulate navigation away and back (which would trigger useFocusEffect)
      await act(async () => {
        tree!.unmount();
      });

      await act(async () => {
        tree = renderer.create(
          <HomeScreen navigation={mockNavigation} route={mockRoute} />
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify data was refreshed
      expect(mockGetAllRatings).toHaveBeenCalledTimes(2);

      // Verify new feature can be tapped
      const tappedFeature = {
        id: 'feature-2',
        latitude: 37.7849,
        longitude: -122.4084,
        attributes: { type: 'ramp' },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-456',
      });
    });
  });

  /**
   * Integration Test 5: Error handling in complete flow
   */
  describe('Error Handling', () => {
    it('should handle network errors gracefully and allow retry', async () => {
      const mockGetAllRatings = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          {
            id: 'feature-1',
            tripId: 'trip-123',
            userRating: 8,
            timestamp: '2024-01-01T12:00:00Z',
            geometry: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749],
            },
            properties: { type: 'curb' },
          },
        ]);

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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify error state
      const textElements = tree!.root.findAllByType(require('react-native').Text);
      const hasError = textElements.some(el => 
        el.props.children === 'Unable to load rated features. Please try again.'
      );
      expect(hasError).toBe(true);

      // Find and press retry button
      const touchableOpacities = tree!.root.findAllByProps({ 
        accessibilityLabel: 'Retry loading rated features' 
      });
      expect(touchableOpacities.length).toBeGreaterThan(0);

      await act(async () => {
        touchableOpacities[0].props.onPress();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify error is cleared and data is loaded
      const updatedTextElements = tree!.root.findAllByType(require('react-native').Text);
      const stillHasError = updatedTextElements.some(el => 
        el.props.children === 'Unable to load rated features. Please try again.'
      );
      expect(stillHasError).toBe(false);

      // Verify marker tap works after recovery
      const tappedFeature = {
        id: 'feature-1',
        latitude: 37.7749,
        longitude: -122.4194,
        attributes: { type: 'curb' },
      };

      await act(async () => {
        mockOnFeatureTap!(tappedFeature);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('History', {
        highlightTripId: 'trip-123',
      });
    });
  });
});
