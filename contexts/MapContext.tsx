/**
 * MapContext: Manages persistent map state across screens
 * 
 * This context allows screens to update what's displayed on the persistent
 * MapViewComponent without causing it to re-render. Screens can update:
 * - Polylines (trip routes)
 * - Polygon outlines (census blocks)
 * - Features (curb ramps, obstacles)
 * - Center position and zoom level
 * - Interaction state (interactive/dimmed)
 * - User position visibility
 * 
 * The MapViewComponent subscribes to this context and updates accordingly.
 */

import { Feature, InteractionState, PolygonOutline, Polyline } from '@/components/MapViewComponent';
import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface MapState {
  polylines: Polyline[];
  polygonOutlines: PolygonOutline[];
  features: Feature[];
  centerPosition?: [number, number];
  zoomLevel?: number;
  interactionState: InteractionState;
  showUserLocation: boolean;
  onFeaturePress?: (feature: Feature) => void;
}

interface MapContextValue extends MapState {
  updateMapState: (updates: Partial<MapState>) => void;
  resetMapState: () => void;
  recenterToUser: () => void;
  recenterTrigger: number;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

const DEFAULT_MAP_STATE: MapState = {
  polylines: [],
  polygonOutlines: [],
  features: [],
  centerPosition: undefined,
  zoomLevel: 15,
  interactionState: 'interactive',
  showUserLocation: true,
  onFeaturePress: undefined,
};

export function MapProvider({ children }: { children: ReactNode }) {
  const [mapState, setMapState] = useState<MapState>(DEFAULT_MAP_STATE);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const updateMapState = useCallback((updates: Partial<MapState>) => {
    setMapState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetMapState = useCallback(() => {
    setMapState(DEFAULT_MAP_STATE);
  }, []);

  const recenterToUser = useCallback(() => {
    // Trigger recenter by incrementing counter
    // The MapViewComponent will watch this and recenter
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  const value: MapContextValue = {
    ...mapState,
    updateMapState,
    resetMapState,
    recenterToUser,
    recenterTrigger,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
}
