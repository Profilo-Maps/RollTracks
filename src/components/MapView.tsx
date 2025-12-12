import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, AppState, AppStateStatus } from 'react-native';
import WebView from 'react-native-webview';
import { LocationPoint, ObstacleFeature } from '../types';

export interface MapViewProps {
  currentLocation: LocationPoint | null;
  routePoints: LocationPoint[];
  obstacleFeatures?: ObstacleFeature[];
  showCompleteRoute?: boolean; // New prop to show entire route at once
  onMapReady?: () => void;
  onMapError?: (error: string) => void;
  onFeatureTap?: (feature: ObstacleFeature) => void; // Callback when obstacle is tapped
  ratedFeatureIds?: string[]; // IDs of features that have been rated
  ratedFeatureRatings?: Record<string, number>; // Map of feature ID to rating value
}

type MapMessage =
  | { type: 'updateLocation'; payload: LocationPoint }
  | { type: 'addRoutePoint'; payload: LocationPoint }
  | { type: 'setRoute'; payload: LocationPoint[] }
  | { type: 'clearRoute' }
  | { type: 'setZoom'; payload: number }
  | { type: 'centerOnUser' }
  | { type: 'updateObstacles'; payload: ObstacleFeature[] }
  | { type: 'updateRatedFeatures'; payload: { ids: string[]; ratings: Record<string, number> } };

type WebViewMessage =
  | { type: 'mapReady' }
  | { type: 'mapError'; payload: string }
  | { type: 'tileLoadError'; payload: { z: number; x: number; y: number } }
  | { type: 'featureTapped'; payload: ObstacleFeature };

export const MapView: React.FC<MapViewProps> = ({
  currentLocation,
  routePoints,
  obstacleFeatures,
  showCompleteRoute = false,
  onMapReady,
  onMapError,
  onFeatureTap,
  ratedFeatureIds = [],
  ratedFeatureRatings = {},
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const lastUpdateTime = useRef<number>(0);
  const lastObstacleUpdateTime = useRef<number>(0);
  const updateThrottleMs = 1000; // Max 1 update per second

  // Send message to WebView
  const sendMessage = (message: MapMessage) => {
    if (webViewRef.current && isMapReady) {
      const js = `
        window.postMessage(${JSON.stringify(message)}, '*');
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  };

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'mapReady':
          console.log('Map is ready');
          setIsMapReady(true);
          if (onMapReady) {
            onMapReady();
          }
          break;

        case 'mapError':
          console.error('Map error:', message.payload);
          setError(message.payload);
          if (onMapError) {
            onMapError(message.payload);
          }
          break;

        case 'tileLoadError':
          console.warn('Tile load error:', message.payload);
          console.warn(`Missing tile at zoom ${message.payload.z}, x: ${message.payload.x}, y: ${message.payload.y}`);
          break;

        case 'featureTapped':
          console.log('Feature tapped:', message.payload);
          if (onFeatureTap) {
            onFeatureTap(message.payload);
          }
          break;

        default:
          console.warn('Unknown message type:', message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  // Handle app state changes for visibility
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      setIsVisible(nextAppState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Update location when currentLocation changes (throttled and visibility-aware)
  useEffect(() => {
    if (currentLocation && isMapReady && isVisible) {
      const now = Date.now();
      if (now - lastUpdateTime.current >= updateThrottleMs) {
        sendMessage({ type: 'updateLocation', payload: currentLocation });
        lastUpdateTime.current = now;
      }
    }
  }, [currentLocation, isMapReady, isVisible]);



  // Set complete route (for trip summary view)
  useEffect(() => {
    if (showCompleteRoute && routePoints.length > 0 && isMapReady && isVisible) {
      console.log('Setting complete route with', routePoints.length, 'points');
      sendMessage({ type: 'setRoute', payload: routePoints });
    }
  }, [showCompleteRoute, routePoints, isMapReady, isVisible]);

  // Add route points incrementally (for active trip view)
  useEffect(() => {
    if (!showCompleteRoute && routePoints.length > 0 && isMapReady && isVisible) {
      const lastPoint = routePoints[routePoints.length - 1];
      sendMessage({ type: 'addRoutePoint', payload: lastPoint });
    }
  }, [showCompleteRoute, routePoints, isMapReady, isVisible]);

  // Update rated features first (before obstacles)
  useEffect(() => {
    if (isMapReady && isVisible) {
      console.log(`MapView: Sending ${ratedFeatureIds.length} rated feature IDs and ${Object.keys(ratedFeatureRatings).length} ratings to map`);
      sendMessage({ 
        type: 'updateRatedFeatures', 
        payload: { 
          ids: ratedFeatureIds, 
          ratings: ratedFeatureRatings 
        } 
      });
    }
  }, [ratedFeatureIds, ratedFeatureRatings, isMapReady, isVisible]);

  // Update obstacles (throttled and visibility-aware) - after rated features
  useEffect(() => {
    if (isMapReady && isVisible) {
      const now = Date.now();
      if (now - lastObstacleUpdateTime.current >= updateThrottleMs) {
        const features = obstacleFeatures || [];
        console.log(`MapView: Sending ${features.length} obstacles to map`);
        sendMessage({ type: 'updateObstacles', payload: features });
        lastObstacleUpdateTime.current = now;
      }
    }
  }, [obstacleFeatures, isMapReady, isVisible]);

  // Leaflet HTML template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
        crossorigin=""/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }
        #map {
          height: 100%;
          width: 100%;
        }
        .recenter-button {
          position: absolute;
          bottom: 100px;
          right: 20px;
          z-index: 1000;
          background: #007AFF;
          border: none;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          font-size: 24px;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          opacity: 1;
          visibility: visible;
          transform: scale(1);
        }
        .recenter-button.hide {
          opacity: 0;
          visibility: hidden;
          transform: scale(0.8);
        }
        .recenter-button:active {
          background: #0051D5;
          transform: scale(0.95);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <button id="recenter-btn" class="recenter-button" onclick="recenterMap()" aria-label="Re-center map on current location">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
      </button>
      <script>
        let map;
        let marker;
        let accuracyCircle;
        let polyline;
        let routePoints = [];
        let userHasPanned = false;
        let currentLocation = null;
        let obstacleMarkers = [];

        // Initialize map
        try {
          // Default center (San Francisco)
          map = L.map('map', {
            zoomControl: true,
            attributionControl: false
          }).setView([37.7749, -122.4194], 17);

          // Configure tile layer for bundled assets
          // Android assets are accessed via file:///android_asset/
          const tileLayer = L.tileLayer('file:///android_asset/sf_tiles/{z}/{x}/{y}.png', {
            maxZoom: 18,
            minZoom: 10,
            errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2P4DwQACfsD/eNV8pwAAAAASUVORK5CYII='
          }).addTo(map);
          
          console.log('Tile layer configured for path: file:///android_asset/sf_tiles/{z}/{x}/{y}.png');

          // Initialize polyline
          polyline = L.polyline([], {
            color: '#007AFF',
            weight: 4,
            opacity: 0.8
          }).addTo(map);

          // Track user panning
          map.on('dragstart', function() {
            userHasPanned = true;
          });

          // Send ready message
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));

        } catch (error) {
          console.error('Map initialization error:', error);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapError',
            payload: error.message
          }));
        }

        // Update location marker
        function updateLocation(location) {
          currentLocation = location;
          const latlng = [location.latitude, location.longitude];

          if (!marker) {
            // Create marker
            marker = L.circleMarker(latlng, {
              radius: 8,
              fillColor: '#007AFF',
              color: '#FFFFFF',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
          } else {
            marker.setLatLng(latlng);
          }

          // Update accuracy circle
          if (location.accuracy) {
            if (!accuracyCircle) {
              accuracyCircle = L.circle(latlng, {
                radius: location.accuracy,
                color: '#007AFF',
                fillColor: '#007AFF',
                fillOpacity: 0.1,
                weight: 1
              }).addTo(map);
            } else {
              accuracyCircle.setLatLng(latlng);
              accuracyCircle.setRadius(location.accuracy);
            }
          }

          // Center map on location if user hasn't panned
          if (!userHasPanned) {
            map.setView(latlng, map.getZoom());
          }
          
          // Update button visibility based on distance from current location
          const mapCenter = map.getCenter();
          const distance = map.distance(mapCenter, latlng);
          const btn = document.getElementById('recenter-btn');
          
          if (btn) {
            // Show button if map is more than 50 meters from current location
            if (distance > 50) {
              btn.classList.remove('hide');
            } else {
              btn.classList.add('hide');
            }
          }
        }

        // Douglas-Peucker simplification algorithm
        function simplifyPolyline(points, tolerance) {
          if (points.length <= 2) return points;

          function getPerpendicularDistance(point, lineStart, lineEnd) {
            const dx = lineEnd[0] - lineStart[0];
            const dy = lineEnd[1] - lineStart[1];
            const mag = Math.sqrt(dx * dx + dy * dy);
            if (mag > 0) {
              const u = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (mag * mag);
              const ix = lineStart[0] + u * dx;
              const iy = lineStart[1] + u * dy;
              const dx2 = point[0] - ix;
              const dy2 = point[1] - iy;
              return Math.sqrt(dx2 * dx2 + dy2 * dy2);
            }
            const dx3 = point[0] - lineStart[0];
            const dy3 = point[1] - lineStart[1];
            return Math.sqrt(dx3 * dx3 + dy3 * dy3);
          }

          let dmax = 0;
          let index = 0;
          const end = points.length - 1;

          for (let i = 1; i < end; i++) {
            const d = getPerpendicularDistance(points[i], points[0], points[end]);
            if (d > dmax) {
              index = i;
              dmax = d;
            }
          }

          if (dmax > tolerance) {
            const left = simplifyPolyline(points.slice(0, index + 1), tolerance);
            const right = simplifyPolyline(points.slice(index), tolerance);
            return left.slice(0, -1).concat(right);
          }
          return [points[0], points[end]];
        }

        // Set complete route (for trip summary)
        function setRoute(locations) {
          routePoints = locations.map(loc => [loc.latitude, loc.longitude]);
          
          // Simplify if too many points
          let displayPoints = routePoints;
          if (routePoints.length > 1000) {
            displayPoints = simplifyPolyline(routePoints, 0.0001);
          }
          
          polyline.setLatLngs(displayPoints);
          
          // Fit map to show entire route
          if (routePoints.length > 0) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        }

        // Add route point (for active trip)
        function addRoutePoint(location) {
          routePoints.push([location.latitude, location.longitude]);
          
          // Simplify if too many points
          let displayPoints = routePoints;
          if (routePoints.length > 1000) {
            displayPoints = simplifyPolyline(routePoints, 0.0001);
          }
          
          polyline.setLatLngs(displayPoints);
        }

        // Clear route
        function clearRoute() {
          routePoints = [];
          polyline.setLatLngs([]);
        }

        // Recenter map on current location
        function recenterMap() {
          if (currentLocation) {
            map.setView([currentLocation.latitude, currentLocation.longitude], map.getZoom(), {
              animate: true,
              duration: 0.5
            });
            userHasPanned = false;
            const btn = document.getElementById('recenter-btn');
            if (btn) {
              btn.classList.add('hide');
            }
          }
        }

        // Set zoom level
        function setZoom(zoom) {
          map.setZoom(zoom);
        }

        // Get color based on condition score
        function getObstacleColor(conditionScore) {
          // conditionScore ranges from -2 (poor) to 100 (excellent)
          // null or undefined = unknown condition
          if (conditionScore === null || conditionScore === undefined) {
            return '#999999'; // Gray for unknown
          } else if (conditionScore >= 50) {
            return '#4CAF50'; // Green for good condition (50-100)
          } else if (conditionScore >= 0) {
            return '#FF9500'; // Orange for fair condition (0-49)
          } else {
            return '#9C27B0'; // Purple for poor condition (negative scores)
          }
        }

        // Track rated feature IDs and their ratings
        let ratedFeatureIds = [];
        let ratedFeatureRatings = {};

        // Get star color based on rating
        function getStarColor(rating) {
          if (rating >= 8) return '#4CAF50'; // Green for good
          if (rating >= 5) return '#FFC107'; // Yellow for moderate
          return '#f44336'; // Red for poor
        }

        // Create star icon for rated obstacles
        function createStarIcon(rating) {
          const color = getStarColor(rating);
          const svgIcon = L.divIcon({
            html: '<svg width="32" height="32" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">' +
                  '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" ' +
                  'fill="' + color + '" stroke="#FFFFFF" stroke-width="1.5"/>' +
                  '</svg>',
            className: 'star-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
          });
          return svgIcon;
        }

        // Store current features for re-rendering
        let currentObstacleFeatures = [];

        // Update obstacle markers
        function updateObstacles(features) {
          console.log('updateObstacles called with', features.length, 'features');
          console.log('Current ratedFeatureIds:', ratedFeatureIds.length);
          console.log('Current ratedFeatureRatings:', Object.keys(ratedFeatureRatings).length);
          
          // Store features for potential re-render
          currentObstacleFeatures = features;
          
          // Clear existing obstacle markers
          obstacleMarkers.forEach(marker => map.removeLayer(marker));
          obstacleMarkers = [];

          // Add new obstacle markers
          features.forEach(feature => {
            const conditionScore = feature.attributes?.conditionScore;
            const isRated = ratedFeatureIds.includes(feature.id);
            const rating = ratedFeatureRatings[feature.id];
            
            console.log('Feature', feature.id, '- isRated:', isRated, 'rating:', rating);
            
            let marker;
            
            if (isRated && rating !== undefined) {
              // Create star marker for rated obstacles
              console.log('Creating star marker for feature', feature.id, 'with rating', rating);
              marker = L.marker([feature.latitude, feature.longitude], {
                icon: createStarIcon(rating),
                zIndexOffset: 1000 // Rated features above unrated
              }).addTo(map);
            } else {
              // Create circle marker for unrated obstacles
              const color = getObstacleColor(conditionScore);
              marker = L.circleMarker([feature.latitude, feature.longitude], {
                radius: 6,
                fillColor: color,
                color: '#FFFFFF',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7,
                zIndex: 400
              }).addTo(map);
            }
            
            // Add popup with condition score
            marker.bindPopup(formatObstaclePopup(feature.attributes, rating));
            
            // Add click handler to send feature tap event
            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'featureTapped',
                payload: feature
              }));
            });
            
            obstacleMarkers.push(marker);
          });
          
          console.log('Added', obstacleMarkers.length, 'obstacle markers to map');
        }

        // Update rated features
        function updateRatedFeatures(payload) {
          ratedFeatureIds = payload.ids || [];
          ratedFeatureRatings = payload.ratings || {};
          console.log('updateRatedFeatures called - IDs:', ratedFeatureIds.length, 'Ratings:', Object.keys(ratedFeatureRatings).length);
          console.log('Sample ratings:', ratedFeatureRatings);
          
          // Re-render obstacles with updated ratings if we have obstacles
          if (currentObstacleFeatures.length > 0) {
            console.log('Re-rendering', currentObstacleFeatures.length, 'obstacles with new ratings');
            updateObstacles(currentObstacleFeatures);
          }
        }

        // Format obstacle popup with condition score and rating
        function formatObstaclePopup(attributes, rating) {
          const conditionScore = attributes?.conditionScore;
          let conditionText = 'Unknown';
          let conditionColor = '#999999';
          
          if (conditionScore !== null && conditionScore !== undefined) {
            if (conditionScore >= 50) {
              conditionText = 'Good (' + conditionScore + ')';
              conditionColor = '#4CAF50';
            } else if (conditionScore >= 0) {
              conditionText = 'Fair (' + conditionScore + ')';
              conditionColor = '#FF9500';
            } else {
              conditionText = 'Poor (' + conditionScore + ')';
              conditionColor = '#9C27B0';
            }
          }
          
          let html = '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; min-width: 150px;">';
          html += '<div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Curb Ramp</div>';
          
          // Show user rating if available
          if (rating !== undefined) {
            const ratingColor = getStarColor(rating);
            html += '<div style="margin-bottom: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">';
            html += '<span style="font-weight: 500;">Your Rating:</span> ';
            html += '<span style="color: ' + ratingColor + '; font-weight: 700; font-size: 18px;">★</span> ';
            html += '<span style="font-weight: 600;">' + rating + '/10</span>';
            html += '</div>';
          }
          
          html += '<div style="margin-bottom: 4px;">';
          html += '<span style="font-weight: 500;">Condition:</span> ';
          html += '<span style="color: ' + conditionColor + '; font-weight: 600;">' + conditionText + '</span>';
          html += '</div>';
          
          // Add location description if available
          if (attributes?.LocationDescription) {
            html += '<div style="font-size: 12px; color: #666; margin-top: 4px;">';
            html += attributes.LocationDescription;
            html += '</div>';
          }
          
          html += '</div>';
          return html;
        }

        // Handle messages from React Native
        window.addEventListener('message', function(event) {
          try {
            const message = event.data;
            
            switch (message.type) {
              case 'updateLocation':
                updateLocation(message.payload);
                break;
              case 'setRoute':
                setRoute(message.payload);
                break;
              case 'addRoutePoint':
                addRoutePoint(message.payload);
                break;
              case 'clearRoute':
                clearRoute();
                break;
              case 'setZoom':
                setZoom(message.payload);
                break;
              case 'centerOnUser':
                recenterMap();
                break;
              case 'updateObstacles':
                updateObstacles(message.payload);
                break;
              case 'updateRatedFeatures':
                updateRatedFeatures(message.payload);
                break;
              default:
                console.warn('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error handling message:', error);
          }
        });

        // Handle tile loading errors
        map.on('tileerror', function(error, tile) {
          console.warn('Tile load error:', error);
          if (tile && tile.coords) {
            const coords = tile.coords;
            console.warn('Failed tile coordinates:', coords.z, coords.x, coords.y);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'tileLoadError',
              payload: { z: coords.z, x: coords.x, y: coords.y }
            }));
          }
        });
      </script>
    </body>
    </html>
  `;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Map Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isMapReady && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        originWhitelist={['*']}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setError('Failed to load map');
        }}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
});
