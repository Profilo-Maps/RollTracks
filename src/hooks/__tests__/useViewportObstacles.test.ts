import { renderHook } from '@testing-library/react-native';
import { useViewportObstacles } from '../useViewportObstacles';
import { ObstacleFeature, LocationPoint } from '../../types';

// Mock console.log to avoid noise in tests
global.console.log = jest.fn();

describe('useViewportObstacles', () => {
  const createObstacle = (id: string, lat: number, lng: number): ObstacleFeature => ({
    id,
    latitude: lat,
    longitude: lng,
    attributes: {
      conditionScore: 50,
      LocationDescription: `Obstacle ${id}`,
    },
  });

  const createLocation = (lat: number, lng: number): LocationPoint => ({
    latitude: lat,
    longitude: lng,
    timestamp: Date.now(),
    accuracy: 10,
  });

  it('should return empty array when no obstacles provided', () => {
    const { result } = renderHook(() =>
      useViewportObstacles({
        allObstacles: [],
        currentLocation: createLocation(37.7749, -122.4194),
        routePoints: [],
      })
    );

    expect(result.current).toEqual([]);
  });

  it('should filter obstacles within viewport radius', () => {
    const obstacles: ObstacleFeature[] = [
      createObstacle('1', 37.7749, -122.4194), // At center
      createObstacle('2', 37.7750, -122.4195), // Very close
      createObstacle('3', 37.8000, -122.4500), // Far away
      createObstacle('4', 37.7748, -122.4193), // Close
    ];

    const { result } = renderHook(() =>
      useViewportObstacles({
        allObstacles: obstacles,
        currentLocation: createLocation(37.7749, -122.4194),
        routePoints: [],
        viewportRadiusMeters: 500, // 500m radius
        enableSpatialIndex: false, // Disable for simpler testing
      })
    );

    // Should include obstacles 1, 2, and 4 (within ~500m)
    // Obstacle 3 is ~3km away and should be excluded
    expect(result.current.length).toBeLessThan(obstacles.length);
    expect(result.current.some(o => o.id === '3')).toBe(false);
  });

  it('should calculate viewport from route points', () => {
    const obstacles: ObstacleFeature[] = [
      createObstacle('1', 37.7749, -122.4194), // Along route
      createObstacle('2', 37.7850, -122.4294), // Along route
      createObstacle('3', 37.9000, -122.5000), // Far from route
    ];

    const routePoints: LocationPoint[] = [
      createLocation(37.7749, -122.4194),
      createLocation(37.7800, -122.4244),
      createLocation(37.7850, -122.4294),
    ];

    const { result } = renderHook(() =>
      useViewportObstacles({
        allObstacles: obstacles,
        currentLocation: null,
        routePoints,
        viewportRadiusMeters: 500,
        enableSpatialIndex: false,
      })
    );

    // Should include obstacles along the route
    expect(result.current.some(o => o.id === '1')).toBe(true);
    expect(result.current.some(o => o.id === '2')).toBe(true);
    // Obstacle 3 is far from route
    expect(result.current.some(o => o.id === '3')).toBe(false);
  });

  it('should use spatial index when enabled', () => {
    const obstacles: ObstacleFeature[] = Array.from({ length: 100 }, (_, i) =>
      createObstacle(`${i}`, 37.7749 + i * 0.001, -122.4194 + i * 0.001)
    );

    const { result } = renderHook(() =>
      useViewportObstacles({
        allObstacles: obstacles,
        currentLocation: createLocation(37.7749, -122.4194),
        routePoints: [],
        viewportRadiusMeters: 500,
        enableSpatialIndex: true,
      })
    );

    // Should return some obstacles (exact count depends on spatial grid)
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.length).toBeLessThanOrEqual(obstacles.length);
  });

  it('should update when obstacles change', () => {
    const initialObstacles: ObstacleFeature[] = [
      createObstacle('1', 37.7749, -122.4194),
    ];

    const { result, rerender } = renderHook(
      ({ obstacles }) =>
        useViewportObstacles({
          allObstacles: obstacles,
          currentLocation: createLocation(37.7749, -122.4194),
          routePoints: [],
          enableSpatialIndex: false,
        }),
      { initialProps: { obstacles: initialObstacles } }
    );

    expect(result.current.length).toBe(1);

    // Update obstacles
    const newObstacles: ObstacleFeature[] = [
      createObstacle('1', 37.7749, -122.4194),
      createObstacle('2', 37.7750, -122.4195),
    ];

    rerender({ obstacles: newObstacles });

    expect(result.current.length).toBe(2);
  });

  it('should handle large datasets efficiently', () => {
    // Create 1000 obstacles
    const obstacles: ObstacleFeature[] = Array.from({ length: 1000 }, (_, i) =>
      createObstacle(`${i}`, 37.7749 + (i % 10) * 0.001, -122.4194 + Math.floor(i / 10) * 0.001)
    );

    const startTime = Date.now();

    const { result } = renderHook(() =>
      useViewportObstacles({
        allObstacles: obstacles,
        currentLocation: createLocation(37.7749, -122.4194),
        routePoints: [],
        viewportRadiusMeters: 500,
        enableSpatialIndex: true,
      })
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 500ms)
    expect(duration).toBeLessThan(500);
    
    // Should filter down the obstacles
    expect(result.current.length).toBeLessThan(obstacles.length);
  });
});
