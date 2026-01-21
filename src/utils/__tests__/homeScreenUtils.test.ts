import { processRatings, calculateMapRegion, getMarkerColor } from '../homeScreenUtils';
import { RatedFeature } from '../../types';

describe('homeScreenUtils', () => {
  describe('processRatings', () => {
    it('should return empty array for empty input', () => {
      const result = processRatings([]);
      expect(result).toEqual([]);
    });

    it('should process single rating correctly', () => {
      const ratings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-1',
          userRating: 5,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
      ];

      const result = processRatings(ratings);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        feature_id: 'feature-1',
        latitude: 37.7749,
        longitude: -122.4194,
        rating: 5,
        trip_id: 'trip-1',
        timestamp: '2024-01-01T12:00:00Z',
        properties: { type: 'curb' },
      });
    });

    it('should select most recent rating when multiple ratings exist for same feature', () => {
      const ratings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-1',
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
          tripId: 'trip-2',
          userRating: 8,
          timestamp: '2024-01-02T12:00:00Z', // More recent
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-1',
          tripId: 'trip-3',
          userRating: 5,
          timestamp: '2024-01-01T18:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
      ];

      const result = processRatings(ratings);

      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(8);
      expect(result[0].trip_id).toBe('trip-2');
      expect(result[0].timestamp).toBe('2024-01-02T12:00:00Z');
    });

    it('should process multiple unique features correctly', () => {
      const ratings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-1',
          userRating: 5,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-2',
          tripId: 'trip-1',
          userRating: 7,
          timestamp: '2024-01-01T13:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4084, 37.7849],
          },
          properties: { type: 'ramp' },
        },
      ];

      const result = processRatings(ratings);

      expect(result).toHaveLength(2);
      expect(result.find(f => f.feature_id === 'feature-1')?.rating).toBe(5);
      expect(result.find(f => f.feature_id === 'feature-2')?.rating).toBe(7);
    });

    it('should handle features with same ID but different coordinates (edge case)', () => {
      const ratings: RatedFeature[] = [
        {
          id: 'feature-1',
          tripId: 'trip-1',
          userRating: 5,
          timestamp: '2024-01-01T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          properties: { type: 'curb' },
        },
        {
          id: 'feature-1',
          tripId: 'trip-2',
          userRating: 8,
          timestamp: '2024-01-02T12:00:00Z',
          geometry: {
            type: 'Point',
            coordinates: [-122.5000, 37.8000], // Different coordinates
          },
          properties: { type: 'curb' },
        },
      ];

      const result = processRatings(ratings);

      // Should still group by ID and take most recent
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(8);
      expect(result[0].latitude).toBe(37.8000);
      expect(result[0].longitude).toBe(-122.5000);
    });
  });

  describe('calculateMapRegion', () => {
    it('should return null for empty array', () => {
      const result = calculateMapRegion([]);
      expect(result).toBeNull();
    });

    it('should return small delta for single feature', () => {
      const features = [
        {
          feature_id: 'feature-1',
          latitude: 37.7749,
          longitude: -122.4194,
          rating: 5,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T12:00:00Z',
          properties: {},
        },
      ];

      const result = calculateMapRegion(features);

      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(37.7749);
      expect(result?.longitude).toBe(-122.4194);
      expect(result?.latitudeDelta).toBe(0.01);
      expect(result?.longitudeDelta).toBe(0.01);
    });

    it('should calculate correct region for multiple features', () => {
      const features = [
        {
          feature_id: 'feature-1',
          latitude: 37.7749,
          longitude: -122.4194,
          rating: 5,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T12:00:00Z',
          properties: {},
        },
        {
          feature_id: 'feature-2',
          latitude: 37.7849,
          longitude: -122.4084,
          rating: 7,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T13:00:00Z',
          properties: {},
        },
      ];

      const result = calculateMapRegion(features);

      expect(result).not.toBeNull();
      
      // Center should be midpoint
      const expectedCenterLat = (37.7749 + 37.7849) / 2;
      const expectedCenterLng = (-122.4194 + -122.4084) / 2;
      expect(result?.latitude).toBeCloseTo(expectedCenterLat, 5);
      expect(result?.longitude).toBeCloseTo(expectedCenterLng, 5);
      
      // Deltas should include 20% padding
      const latDiff = 37.7849 - 37.7749;
      const lngDiff = -122.4084 - (-122.4194);
      expect(result?.latitudeDelta).toBeCloseTo(latDiff * 1.2, 5);
      expect(result?.longitudeDelta).toBeCloseTo(lngDiff * 1.2, 5);
    });

    it('should ensure minimum delta for very close features', () => {
      const features = [
        {
          feature_id: 'feature-1',
          latitude: 37.7749,
          longitude: -122.4194,
          rating: 5,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T12:00:00Z',
          properties: {},
        },
        {
          feature_id: 'feature-2',
          latitude: 37.7750, // Very close
          longitude: -122.4195, // Very close
          rating: 7,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T13:00:00Z',
          properties: {},
        },
      ];

      const result = calculateMapRegion(features);

      expect(result).not.toBeNull();
      // Should use minimum delta of 0.01
      expect(result?.latitudeDelta).toBeGreaterThanOrEqual(0.01);
      expect(result?.longitudeDelta).toBeGreaterThanOrEqual(0.01);
    });

    it('should handle features spanning large geographic area', () => {
      const features = [
        {
          feature_id: 'feature-1',
          latitude: 37.0,
          longitude: -122.0,
          rating: 5,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T12:00:00Z',
          properties: {},
        },
        {
          feature_id: 'feature-2',
          latitude: 38.0,
          longitude: -121.0,
          rating: 7,
          trip_id: 'trip-1',
          timestamp: '2024-01-01T13:00:00Z',
          properties: {},
        },
      ];

      const result = calculateMapRegion(features);

      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(37.5); // Midpoint
      expect(result?.longitude).toBe(-121.5); // Midpoint
      expect(result?.latitudeDelta).toBe(1.2); // 1.0 * 1.2
      expect(result?.longitudeDelta).toBe(1.2); // 1.0 * 1.2
    });
  });

  describe('getMarkerColor', () => {
    it('should return red for ratings 1-3', () => {
      expect(getMarkerColor(1)).toBe('#FF4444');
      expect(getMarkerColor(2)).toBe('#FF4444');
      expect(getMarkerColor(3)).toBe('#FF4444');
    });

    it('should return yellow for ratings 4-6', () => {
      expect(getMarkerColor(4)).toBe('#FFAA00');
      expect(getMarkerColor(5)).toBe('#FFAA00');
      expect(getMarkerColor(6)).toBe('#FFAA00');
    });

    it('should return green for ratings 7-10', () => {
      expect(getMarkerColor(7)).toBe('#44FF44');
      expect(getMarkerColor(8)).toBe('#44FF44');
      expect(getMarkerColor(9)).toBe('#44FF44');
      expect(getMarkerColor(10)).toBe('#44FF44');
    });

    it('should return gray for invalid ratings', () => {
      expect(getMarkerColor(0)).toBe('#999999');
      expect(getMarkerColor(11)).toBe('#999999');
      expect(getMarkerColor(-1)).toBe('#999999');
      expect(getMarkerColor(100)).toBe('#999999');
    });

    it('should handle edge cases at boundaries', () => {
      expect(getMarkerColor(3)).toBe('#FF4444'); // Upper bound of red
      expect(getMarkerColor(4)).toBe('#FFAA00'); // Lower bound of yellow
      expect(getMarkerColor(6)).toBe('#FFAA00'); // Upper bound of yellow
      expect(getMarkerColor(7)).toBe('#44FF44'); // Lower bound of green
    });
  });
});
