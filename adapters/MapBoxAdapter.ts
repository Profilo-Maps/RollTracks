/**
 * MapBoxAdapter
 * 
 * Abstraction layer for MapBox integration.
 * Provides tile configuration and map styling for the MapView Component.
 * 
 * Architecture: Adapter Layer
 * - Serves map tile configuration to MapView Component
 * - Abstracts MapBox-specific implementation details
 * - Allows for easy switching of map providers if needed
 */

import Constants from 'expo-constants';

// MapBox Access Token from environment
const MAPBOX_ACCESS_TOKEN = Constants.expoConfig?.extra?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN 
  || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_ACCESS_TOKEN) {
  console.warn('MapBox access token not found. Map tiles may not load.');
}

/**
 * Map style configurations
 * MapBox provides various pre-built styles
 */
export const MapStyles = {
  STREETS: 'mapbox://styles/mapbox/streets-v12',
  OUTDOORS: 'mapbox://styles/mapbox/outdoors-v12',
  LIGHT: 'mapbox://styles/mapbox/light-v11',
  DARK: 'mapbox://styles/mapbox/dark-v11',
  SATELLITE: 'mapbox://styles/mapbox/satellite-v9',
  SATELLITE_STREETS: 'mapbox://styles/mapbox/satellite-streets-v12',
  NAVIGATION_DAY: 'mapbox://styles/mapbox/navigation-day-v1',
  NAVIGATION_NIGHT: 'mapbox://styles/mapbox/navigation-night-v1',
} as const;

export type MapStyleType = typeof MapStyles[keyof typeof MapStyles];

/**
 * Default map configuration
 */
export const DEFAULT_MAP_CONFIG = {
  style: MapStyles.STREETS,
  zoom: 14,
  pitch: 0,
  heading: 0,
  animationDuration: 300,
} as const;

/**
 * Get the MapBox access token
 * @returns MapBox access token or empty string if not configured
 */
export const getAccessToken = (): string => {
  return MAPBOX_ACCESS_TOKEN || '';
};

/**
 * Get map style URL
 * @param style - Map style type (defaults to STREETS)
 * @returns MapBox style URL
 */
export const getMapStyle = (style: MapStyleType = MapStyles.STREETS): string => {
  return style;
};

/**
 * Validate MapBox configuration
 * @returns true if MapBox is properly configured
 */
export const isConfigured = (): boolean => {
  return !!MAPBOX_ACCESS_TOKEN;
};

/**
 * Get tile URL template for custom tile sources
 * Useful for overlaying custom data layers
 * @param tilesetId - MapBox tileset ID
 * @returns Tile URL template
 */
export const getTileUrl = (tilesetId: string): string => {
  return `https://api.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_ACCESS_TOKEN}`;
};

/**
 * MapBox Adapter API
 */
export const MapBoxAdapter = {
  getAccessToken,
  getMapStyle,
  isConfigured,
  getTileUrl,
  MapStyles,
  DEFAULT_MAP_CONFIG,
};

