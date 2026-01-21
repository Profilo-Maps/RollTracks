import { useState, useEffect, useRef, useMemo } from 'react';
import { ObstacleFeature, LocationPoint } from '../types';
import { SpatialGrid } from '../services/SpatialGrid';

interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface UseViewportObstaclesOptions {
  allObstacles: ObstacleFeature[];
  currentLocation: LocationPoint | null;
  routePoints: LocationPoint[];
  viewportRadiusMeters?: number;
  enableSpatialIndex?: boolean;
}

/**
 * Hook to efficiently filter obstacles based on viewport/location
 * Uses spatial indexing for fast queries on large datasets
 */
export function useViewportObstacles({
  allObstacles,
  currentLocation,
  routePoints,
  viewportRadiusMeters = 500, // Default 500m radius
  enableSpatialIndex = true,
}: UseViewportObstaclesOptions): ObstacleFeature[] {
  const [visibleObstacles, setVisibleObstacles] = useState<ObstacleFeature[]>([]);
  const spatialGridRef = useRef<SpatialGrid | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const updateThrottleMs = 500; // Throttle updates to 500ms

  // Build spatial index when obstacles change
  useEffect(() => {
    if (enableSpatialIndex && allObstacles.length > 0) {
      const startTime = Date.now();
      spatialGridRef.current = new SpatialGrid(allObstacles, 0.001); // ~100m cells
      const endTime = Date.now();
      console.log(`Spatial index built in ${endTime - startTime}ms for ${allObstacles.length} obstacles`);
      
      const stats = spatialGridRef.current.getStats();
      console.log('Spatial index stats:', stats);
    }
  }, [allObstacles, enableSpatialIndex]);

  // Calculate viewport bounds from current location and route
  const viewportBounds = useMemo((): ViewportBounds | null => {
    if (routePoints.length > 0) {
      // Calculate bounds from route
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;

      for (const point of routePoints) {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLng = Math.min(minLng, point.longitude);
        maxLng = Math.max(maxLng, point.longitude);
      }

      // Add padding (convert meters to degrees, roughly)
      const padding = viewportRadiusMeters / 111000; // 1 degree ≈ 111km
      return {
        minLat: minLat - padding,
        maxLat: maxLat + padding,
        minLng: minLng - padding,
        maxLng: maxLng + padding,
      };
    } else if (currentLocation) {
      // Use current location with radius
      const padding = viewportRadiusMeters / 111000;
      return {
        minLat: currentLocation.latitude - padding,
        maxLat: currentLocation.latitude + padding,
        minLng: currentLocation.longitude - padding,
        maxLng: currentLocation.longitude + padding,
      };
    }

    return null;
  }, [routePoints, currentLocation, viewportRadiusMeters]);

  // Update visible obstacles when viewport or obstacles change
  useEffect(() => {
    const now = Date.now();
    
    // Throttle updates
    if (now - lastUpdateTime.current < updateThrottleMs) {
      return;
    }

    if (!viewportBounds || allObstacles.length === 0) {
      setVisibleObstacles([]);
      return;
    }

    const startTime = Date.now();
    let filtered: ObstacleFeature[];

    if (enableSpatialIndex && spatialGridRef.current) {
      // Use spatial index for fast queries
      const centerLat = (viewportBounds.minLat + viewportBounds.maxLat) / 2;
      const centerLng = (viewportBounds.minLng + viewportBounds.maxLng) / 2;
      
      filtered = spatialGridRef.current.queryNearby(
        centerLat,
        centerLng,
        viewportRadiusMeters
      );
    } else {
      // Fallback to simple bounds filtering
      filtered = allObstacles.filter(obstacle => 
        obstacle.latitude >= viewportBounds.minLat &&
        obstacle.latitude <= viewportBounds.maxLat &&
        obstacle.longitude >= viewportBounds.minLng &&
        obstacle.longitude <= viewportBounds.maxLng
      );
    }

    const endTime = Date.now();
    console.log(
      `Filtered ${filtered.length} obstacles from ${allObstacles.length} total in ${endTime - startTime}ms`,
      enableSpatialIndex ? '(spatial index)' : '(bounds filter)'
    );

    setVisibleObstacles(filtered);
    lastUpdateTime.current = now;
  }, [viewportBounds, allObstacles, enableSpatialIndex]);

  return visibleObstacles;
}
