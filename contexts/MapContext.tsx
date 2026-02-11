/**
 * MapContext: Shared map state across screens
 * 
 * Provides a single MapView instance that persists across navigation.
 * Screens can contribute their data (polylines, features, etc.) to the shared map.
 * This prevents map tile reloading when navigating between screens.
 */

import { MapStyles } from '@/adapters/MapBoxAdapter';
import { Feature, PolygonOutline, Polyline } from '@/components/MapViewComponent';
import React, { createContext, ReactNode, useContext, useState } from 'react';

interface MapContextValue {
  // Map data
  polylines: Polyline[];
  polygonOutlines: PolygonOutline[];
  features: Feature[];
  userPosition: [number, number] | null;
  centerPosition?: [number, number];
  zoomLevel: number;
  mapStyle: typeof MapStyles[keyof typeof MapStyles];
  gpsError: boolean;
  
  // Setters for screens to update map data
  setPolylines: (polylines: Polyline[]) => void;
  setPolygonOutlines: (polygons: PolygonOutline[]) => void;
  setFeatures: (features: Feature[]) => void;
  setUserPosition: (position: [number, number] | null) => void;
  setCenterPosition: (position: [number, number] | undefined) => void;
  setZoomLevel: (zoom: number) => void;
  setMapStyle: (style: typeof MapStyles[keyof typeof MapStyles]) => void;
  setGpsError: (error: boolean) => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: ReactNode }) {
  const [polylines, setPolylines] = useState<Polyline[]>([]);
  const [polygonOutlines, setPolygonOutlines] = useState<PolygonOutline[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [centerPosition, setCenterPosition] = useState<[number, number] | undefined>(undefined);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [mapStyle, setMapStyle] = useState(MapStyles.STREETS);
  const [gpsError, setGpsError] = useState(false);

  return (
    <MapContext.Provider
      value={{
        polylines,
        polygonOutlines,
        features,
        userPosition,
        centerPosition,
        zoomLevel,
        mapStyle,
        gpsError,
        setPolylines,
        setPolygonOutlines,
        setFeatures,
        setUserPosition,
        setCenterPosition,
        setZoomLevel,
        setMapStyle,
        setGpsError,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}

export function useMap() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
}
