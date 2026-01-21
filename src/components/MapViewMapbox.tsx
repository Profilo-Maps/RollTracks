import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, AppState, AppStateStatus } from 'react-native';
import WebView from 'react-native-webview';
import { LocationPoint, ObstacleFeature } from '../types';

const MAPBOX_TOKEN = 'pk.eyJ1IjoicHJvZmlsby1tYXBzIiwiYSI6ImNta245ODFoZjBvNDczam9pM28wZjk0M2IifQ.cH7bol8MgYf93gyqoVEbMA';

export interface MapViewMapboxProps {
  currentLocation: LocationPoint | null;
  routePoints: LocationPoint[];
  obstacleFeatures?: ObstacleFeature[];
  showCompleteRoute?: boolean;
  onMapReady?: () => void;
  onMapError?: (error: string) => void;
  onFeatureTap?: (feature: ObstacleFeature) => void;
  ratedFeatureIds?: string[];
  ratedFeatureRatings?: Record<string, number>;
  enableLazyLoading?: boolean; // Enable viewport-based lazy loading
}

type MapMessage =
  | { type: 'updateLocation'; payload: LocationPoint }
  | { type: 'addRoutePoint'; payload: LocationPoint }
  | { type: 'setRoute'; payload: LocationPoint[] }
  | { type: 'clearRoute' }
  | { type: 'setZoom'; payload: number }
  | { type: 'centerOnUser' }
  | { type: 'updateObstacles'; payload: ObstacleFeature[] }
  | { type: 'updateRatedFeatures'; payload: { ids: string[]; ratings: Record<string, number> } }
  | { type: 'setAllObstacles'; payload: ObstacleFeature[] }
  | { type: 'enableLazyLoading'; payload: boolean }
  | { type: 'fitToObstacles' };

type WebViewMessage =
  | { type: 'mapReady' }
  | { type: 'mapError'; payload: string }
  | { type: 'featureTapped'; payload: ObstacleFeature }
  | { type: 'memoryWarning'; payload: { heapUsed: number; heapLimit: number } }
  | { type: 'debug'; payload: string }
  | { type: 'consoleLog'; payload: string };

export const MapViewMapbox: React.FC<MapViewMapboxProps> = ({
  currentLocation,
  routePoints,
  obstacleFeatures,
  showCompleteRoute = false,
  onMapReady,
  onMapError,
  onFeatureTap,
  ratedFeatureIds = [],
  ratedFeatureRatings = {},
  enableLazyLoading = true, // Default to enabled for better performance
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const lastUpdateTime = useRef<number>(0);
  const lastObstacleUpdateTime = useRef<number>(0);
  const updateThrottleMs = 1000;
  const messageQueueRef = useRef<MapMessage[]>([]);
  const isProcessingQueue = useRef(false);
  const allObstaclesRef = useRef<ObstacleFeature[]>([]); // Store all obstacles for lazy loading

  // Message queue processor with overflow protection
  const processMessageQueue = () => {
    if (isProcessingQueue.current || !isMapReady || messageQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;
    const message = messageQueueRef.current.shift();

    if (message && webViewRef.current) {
      const js = `
        (function() {
          try {
            window.postMessage(${JSON.stringify(message)}, '*');
          } catch (e) {
            console.error('Message processing error:', e);
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }

    isProcessingQueue.current = false;

    // Process next message
    if (messageQueueRef.current.length > 0) {
      setTimeout(processMessageQueue, 16); // ~60fps
    }
  };

  // Send message with queue overflow protection
  const sendMessage = (message: MapMessage) => {
    if (!isMapReady) return;

    // Prevent queue overflow (max 100 messages)
    if (messageQueueRef.current.length >= 100) {
      console.warn('Message queue overflow, dropping oldest messages');
      messageQueueRef.current = messageQueueRef.current.slice(-50);
    }

    messageQueueRef.current.push(message);
    processMessageQueue();
  };

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'mapReady':
          console.log('Mapbox map is ready');
          setIsMapReady(true);
          if (onMapReady) {
            onMapReady();
          }
          break;

        case 'mapError':
          // Only process if there's an actual error message
          if (message.payload && message.payload.trim() !== '') {
            console.error('Mapbox error:', message.payload);
            setError(message.payload);
            if (onMapError) {
              onMapError(message.payload);
            }
          } else {
            console.warn('Received empty mapError message, ignoring');
          }
          break;

        case 'featureTapped':
          console.log('Feature tapped:', message.payload);
          if (onFeatureTap) {
            onFeatureTap(message.payload);
          }
          break;

        case 'memoryWarning':
          console.warn('WebView memory warning:', message.payload);
          // Clear message queue to reduce memory pressure
          messageQueueRef.current = [];
          break;

        case 'debug':
          console.log('[WebView Debug]:', message.payload);
          break;

        default:
          console.warn('Unknown message type:', message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const visible = nextAppState === 'active';
      setIsVisible(visible);
      
      // Clear message queue when app goes to background
      if (!visible) {
        messageQueueRef.current = [];
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Update location (throttled)
  useEffect(() => {
    if (currentLocation && isMapReady && isVisible) {
      const now = Date.now();
      if (now - lastUpdateTime.current >= updateThrottleMs) {
        sendMessage({ type: 'updateLocation', payload: currentLocation });
        lastUpdateTime.current = now;
      }
    }
  }, [currentLocation, isMapReady, isVisible]);

  // Set complete route
  useEffect(() => {
    if (showCompleteRoute && routePoints.length > 0 && isMapReady && isVisible) {
      console.log('Setting complete route with', routePoints.length, 'points');
      sendMessage({ type: 'setRoute', payload: routePoints });
    } else if (!showCompleteRoute && routePoints.length === 0 && isMapReady && isVisible) {
      // Clear route when showCompleteRoute is false and no route points
      console.log('Clearing route');
      sendMessage({ type: 'clearRoute' });
    }
  }, [showCompleteRoute, routePoints, isMapReady, isVisible]);

  // Add route points incrementally
  useEffect(() => {
    if (!showCompleteRoute && routePoints.length > 0 && isMapReady && isVisible) {
      const lastPoint = routePoints[routePoints.length - 1];
      sendMessage({ type: 'addRoutePoint', payload: lastPoint });
    }
  }, [showCompleteRoute, routePoints, isMapReady, isVisible]);

  // Update rated features
  useEffect(() => {
    if (isMapReady && isVisible) {
      console.log('MapViewMapbox: Updating rated features:', {
        ratedFeatureIds,
        ratedFeatureRatings,
        count: ratedFeatureIds.length,
        enableLazyLoading
      });
      
      // Always send rated features to update the cache
      sendMessage({ 
        type: 'updateRatedFeatures', 
        payload: { 
          ids: ratedFeatureIds, 
          ratings: ratedFeatureRatings 
        } 
      });
    }
  }, [ratedFeatureIds, ratedFeatureRatings, isMapReady, isVisible, enableLazyLoading]);

  // Update obstacles (throttled)
  useEffect(() => {
    console.log('MapViewMapbox: Obstacles useEffect triggered:', {
      isMapReady,
      isVisible,
      obstacleCount: obstacleFeatures?.length || 0,
      enableLazyLoading
    });
    
    if (isMapReady && isVisible && obstacleFeatures && obstacleFeatures.length > 0) {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastObstacleUpdateTime.current;
      console.log('MapViewMapbox: Time since last obstacle update:', timeSinceLastUpdate, 'ms (throttle:', updateThrottleMs, 'ms)');
      
      // For trip summary screen (enableLazyLoading=false), don't throttle the initial load
      const shouldUpdate = timeSinceLastUpdate >= updateThrottleMs || 
                          (!enableLazyLoading && lastObstacleUpdateTime.current === 0);
      
      if (shouldUpdate) {
        const features = obstacleFeatures || [];
        
        console.log('MapViewMapbox: Updating obstacles:', {
          count: features.length,
          enableLazyLoading,
          messageType: enableLazyLoading ? 'setAllObstacles' : 'updateObstacles',
          isInitialLoad: lastObstacleUpdateTime.current === 0
        });
        
        // Store all obstacles for lazy loading
        allObstaclesRef.current = features;
        
        if (enableLazyLoading) {
          // Send all obstacles to WebView for viewport-based filtering
          sendMessage({ type: 'setAllObstacles', payload: features });
          // Fit map to show all obstacles (for home screen)
          if (showCompleteRoute === false && routePoints.length === 0) {
            sendMessage({ type: 'fitToObstacles' });
          }
        } else {
          // Legacy mode: send all obstacles directly
          sendMessage({ type: 'updateObstacles', payload: features });
        }
        
        lastObstacleUpdateTime.current = now;
      } else {
        console.log('MapViewMapbox: Obstacle update throttled, skipping');
      }
    }
  }, [obstacleFeatures, isMapReady, isVisible, enableLazyLoading, showCompleteRoute, routePoints]);

  // Send enableLazyLoading setting to WebView
  useEffect(() => {
    if (isMapReady) {
      console.log('MapViewMapbox: Setting lazy loading to:', enableLazyLoading);
      sendMessage({ type: 'enableLazyLoading', payload: enableLazyLoading });
    }
  }, [enableLazyLoading, isMapReady]);

  // Mapbox GL JS HTML template with comprehensive protections
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'></script>
      <link href='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css' rel='stylesheet' />
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
          background-color: #ff0000; /* RED = tiles not loading */
        }
        
        .mapboxgl-map {
          background-color: #00ff00 !important; /* GREEN = tiles loading */
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
      <button id="recenter-btn" class="recenter-button" onclick="recenterMap()" aria-label="Re-center map">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
      </button>
      <script>
        // Immediately notify React Native that script is running
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'debug',
            payload: 'WebView script started'
          }));
        }
        
        // Log script start
        console.log('Mapbox initialization script starting...');
        
        // Check if Mapbox GL JS loaded after 5 seconds
        setTimeout(function() {
          if (typeof mapboxgl === 'undefined') {
            console.error('CRITICAL: Mapbox GL JS library failed to load after 5 seconds');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapError',
                payload: 'Mapbox GL JS library failed to load. Check internet connection.'
              }));
            }
          } else {
            console.log('Mapbox GL JS library loaded successfully, version:', mapboxgl.version);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'debug',
                payload: 'Mapbox GL JS loaded: ' + mapboxgl.version
              }));
            }
          }
        }, 5000);
        
        // ============================================
        // PROTECTION 1: Race Condition Prevention
        // ============================================
        let mapInitialized = false;
        let mapLoadComplete = false;
        let pendingOperations = [];
        
        function executeWhenReady(operation) {
          if (mapLoadComplete) {
            operation();
          } else {
            pendingOperations.push(operation);
          }
        }
        
        function processPendingOperations() {
          while (pendingOperations.length > 0) {
            const op = pendingOperations.shift();
            try {
              op();
            } catch (e) {
              console.error('Pending operation error:', e);
            }
          }
        }

        // ============================================
        // PROTECTION 2: Message Queue Overflow Prevention
        // ============================================
        const MESSAGE_QUEUE_LIMIT = 50;
        let messageQueue = [];
        let isProcessingMessage = false;
        
        function queueMessage(handler) {
          if (messageQueue.length >= MESSAGE_QUEUE_LIMIT) {
            console.warn('Message queue overflow, dropping oldest');
            messageQueue = messageQueue.slice(-25);
          }
          messageQueue.push(handler);
          processMessageQueue();
        }
        
        function processMessageQueue() {
          if (isProcessingMessage || messageQueue.length === 0) return;
          
          isProcessingMessage = true;
          const handler = messageQueue.shift();
          
          try {
            handler();
          } catch (e) {
            console.error('Message handler error:', e);
          }
          
          isProcessingMessage = false;
          
          if (messageQueue.length > 0) {
            requestAnimationFrame(processMessageQueue);
          }
        }

        // ============================================
        // PROTECTION 3: Coordinate System Validation
        // ============================================
        function validateCoordinates(lat, lon) {
          if (typeof lat !== 'number' || typeof lon !== 'number') {
            console.error('Invalid coordinate types:', lat, lon);
            return false;
          }
          if (isNaN(lat) || isNaN(lon)) {
            console.error('NaN coordinates:', lat, lon);
            return false;
          }
          if (lat < -90 || lat > 90) {
            console.error('Invalid latitude:', lat);
            return false;
          }
          if (lon < -180 || lon > 180) {
            console.error('Invalid longitude:', lon);
            return false;
          }
          return true;
        }
        
        function sanitizeLocation(location) {
          const lat = parseFloat(location.latitude);
          const lon = parseFloat(location.longitude);
          
          if (!validateCoordinates(lat, lon)) {
            return null;
          }
          
          return {
            latitude: lat,
            longitude: lon,
            accuracy: location.accuracy || 0
          };
        }

        // ============================================
        // PROTECTION 4: Memory Management
        // ============================================
        const MAX_ROUTE_POINTS = 5000;
        const MAX_OBSTACLES = 1000;
        const MAX_VISIBLE_OBSTACLES = 200; // Limit visible obstacles for performance
        let routePoints = [];
        let allObstacles = []; // Store all obstacles for lazy loading
        let lazyLoadingEnabled = true; // Enable lazy loading by default
        let memoryCheckInterval;
        let viewportUpdateTimeout;
        
        function checkMemory() {
          if (performance && performance.memory) {
            const used = performance.memory.usedJSHeapSize;
            const limit = performance.memory.jsHeapSizeLimit;
            const usage = (used / limit) * 100;
            
            if (usage > 80) {
              console.warn('High memory usage:', usage.toFixed(2) + '%');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'memoryWarning',
                payload: { heapUsed: used, heapLimit: limit }
              }));
              
              // Aggressive cleanup
              if (usage > 90) {
                simplifyRouteAggressive();
                limitObstacles();
              }
            }
          }
        }
        
        function simplifyRouteAggressive() {
          if (routePoints.length > 1000) {
            const simplified = simplifyPolyline(routePoints, 0.0005);
            routePoints = simplified;
            if (map.getSource('route')) {
              map.getSource('route').setData({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routePoints
                }
              });
            }
            console.log('Route simplified due to memory pressure');
          }
        }
        
        function limitObstacles() {
          if (currentObstacles && currentObstacles.features.length > MAX_OBSTACLES) {
            currentObstacles.features = currentObstacles.features.slice(0, MAX_OBSTACLES);
            if (map.getSource('obstacles')) {
              map.getSource('obstacles').setData(currentObstacles);
            }
            console.log('Obstacles limited due to memory pressure');
          }
        }

        // ============================================
        // PROTECTION 5: Cache Corruption Prevention
        // ============================================
        let dataCache = {
          obstacles: null,
          ratedFeatures: { ids: [], ratings: {} },
          lastUpdate: 0
        };
        
        function updateCache(key, value) {
          try {
            dataCache[key] = JSON.parse(JSON.stringify(value));
            dataCache.lastUpdate = Date.now();
          } catch (e) {
            console.error('Cache update error:', e);
            // Reset cache on corruption
            dataCache = {
              obstacles: null,
              ratedFeatures: { ids: [], ratings: {} },
              lastUpdate: 0
            };
          }
        }
        
        function getFromCache(key) {
          try {
            return dataCache[key];
          } catch (e) {
            console.error('Cache read error:', e);
            return null;
          }
        }

        // ============================================
        // Map Initialization
        // ============================================
        let map;
        let userMarker;
        let accuracyCircle;
        let userHasPanned = false;
        let currentLocation = null;
        let currentObstacles = null;
        
        try {
          // Check if Mapbox GL JS library is loaded
          if (typeof mapboxgl === 'undefined') {
            throw new Error('Mapbox GL JS library not loaded. Check internet connection.');
          }
          
          // Check WebGL support
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          
          if (!gl) {
            throw new Error('WebGL not supported on this device');
          }
          
          mapboxgl.accessToken = '${MAPBOX_TOKEN}';
          
          console.log('Mapbox token set (first 20 chars):', '${MAPBOX_TOKEN}'.substring(0, 20));
          console.log('Creating Mapbox map instance...');
          
          // Test if we can reach Mapbox API
          fetch('https://api.mapbox.com/styles/v1/mapbox/outdoors-v12?access_token=${MAPBOX_TOKEN}')
            .then(function(response) {
              console.log('Mapbox API test response status:', response.status);
              if (response.status === 401) {
                console.error('CRITICAL: Mapbox token is invalid or unauthorized');
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapError',
                    payload: 'Mapbox token is invalid. Status: 401 Unauthorized'
                  }));
                }
              } else if (response.status === 200) {
                console.log('Mapbox API test: SUCCESS - Token is valid');
              }
            })
            .catch(function(error) {
              console.error('Mapbox API test failed:', error);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'mapError',
                  payload: 'Cannot reach Mapbox API: ' + error.message
                }));
              }
            });
          
          map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/outdoors-v12', // Better contrast than streets
            center: [-122.4194, 37.7749],
            zoom: 17,
            attributionControl: false,
            maxZoom: 18,
            minZoom: 10
          });
          
          console.log('Map instance created, waiting for load event...');
          
          mapInitialized = true;
          
          // Track user panning
          map.on('dragstart', function() {
            userHasPanned = true;
          });
          
          // Log style loading
          map.on('styledata', function() {
            console.log('Map style data loaded');
          });
          
          // Log when tiles are loading
          map.on('dataloading', function(e) {
            if (e.dataType === 'source') {
              console.log('Tiles loading for source:', e.sourceId);
            }
          });
          
          // Log when tiles finish loading
          map.on('data', function(e) {
            if (e.dataType === 'source' && e.isSourceLoaded) {
              console.log('Tiles loaded for source:', e.sourceId);
            }
          });
          
          // Map load complete
          map.on('load', function() {
            console.log('Map load event fired');
            mapLoadComplete = true;
            
            console.log('Adding route source and layer...');
            
            // Add route source and layer
            map.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: []
                }
              }
            });
            
            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#007AFF',
                'line-width': 4,
                'line-opacity': 0.8
              }
            });
            
            console.log('Route layer added');
            
            // Add obstacles source and layer
            map.addSource('obstacles', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: []
              }
            });
            
            map.addLayer({
              id: 'obstacles-unrated',
              type: 'circle',
              source: 'obstacles',
              filter: ['!', ['has', 'rating']],
              paint: {
                'circle-radius': 8, // Increased from 6 to ensure better touch target
                'circle-color': [
                  'case',
                  ['>=', ['get', 'conditionScore'], 50], '#4CAF50',
                  ['>=', ['get', 'conditionScore'], 0], '#FF9500',
                  '#9C27B0'
                ],
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 2,
                'circle-opacity': 1
              }
            });

            // Set up viewport change listener for lazy loading
            map.on('moveend', function() {
              if (lazyLoadingEnabled && allObstacles.length > 0) {
                // Debounce viewport updates
                if (viewportUpdateTimeout) {
                  clearTimeout(viewportUpdateTimeout);
                }
                viewportUpdateTimeout = setTimeout(function() {
                  updateVisibleObstacles();
                }, 300);
              }
            });

            map.on('zoomend', function() {
              if (lazyLoadingEnabled && allObstacles.length > 0) {
                if (viewportUpdateTimeout) {
                  clearTimeout(viewportUpdateTimeout);
                }
                viewportUpdateTimeout = setTimeout(function() {
                  updateVisibleObstacles();
                }, 300);
              }
            });

            // Create star icon using canvas (PNG format)
            function createStarIcon(color, name, callback) {
              const size = 64;
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              
              // Draw star shape
              const centerX = size / 2;
              const centerY = size / 2;
              const outerRadius = size * 0.4;
              const innerRadius = size * 0.18;
              const points = 5;
              
              ctx.beginPath();
              for (let i = 0; i < points * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / points - Math.PI / 2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
              }
              ctx.closePath();
              
              // Fill with specified color
              ctx.fillStyle = color;
              ctx.fill();
              
              // Add white stroke
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 3;
              ctx.stroke();
              
              // Convert canvas to image
              canvas.toBlob(function(blob) {
                const reader = new FileReader();
                reader.onloadend = function() {
                  const img = new Image();
                  img.onload = function() {
                    callback(null, img, name);
                  };
                  img.onerror = function() {
                    callback(new Error('Failed to load star image'));
                  };
                  img.src = reader.result;
                };
                reader.readAsDataURL(blob);
              });
            }
            
            // Function to get star color based on rating
            function getStarColor(rating) {
              if (rating <= 2) return '#FF0000';      // Red
              if (rating <= 4) return '#FF6B00';      // Orange-red
              if (rating <= 6) return '#FFA500';      // Orange
              if (rating <= 8) return '#FFD700';      // Gold
              return '#00FF00';                        // Green
            }
            
            function getStarName(rating) {
              if (rating <= 2) return 'star-red';
              if (rating <= 4) return 'star-orange-red';
              if (rating <= 6) return 'star-orange';
              if (rating <= 8) return 'star-gold';
              return 'star-green';
            }
            
            // Create all star color variants
            const starColors = [
              { color: '#FF0000', name: 'star-red' },
              { color: '#FF6B00', name: 'star-orange-red' },
              { color: '#ffe600ff', name: 'star-orange' },
              { color: '#65d602ff', name: 'star-gold' },
              { color: '#009100ff', name: 'star-green' }
            ];
            
            let starsLoaded = 0;
            const totalStars = starColors.length;
            
            starColors.forEach(function(star) {
              createStarIcon(star.color, star.name, function(error, image, name) {
                if (error) {
                  console.error('Error creating star icon:', name, error);
                  return;
                }
                
                if (!map.hasImage(name)) {
                  map.addImage(name, image);
                  console.log('Star image added to map:', name);
                }
                
                starsLoaded++;
                
                // Once all stars are loaded, add the layer
                if (starsLoaded === totalStars) {
                  console.log('All star icons created successfully');
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'debug',
                      payload: 'All star icons created successfully'
                    }));
                  }
                  
                  // Add rated obstacles layer with symbols AFTER icons are loaded
                  if (!map.getLayer('obstacles-rated')) {
                    map.addLayer({
                      id: 'obstacles-rated',
                      type: 'symbol',
                      source: 'obstacles',
                      filter: ['has', 'rating'],
                      layout: {
                        'icon-image': [
                          'case',
                          ['<=', ['get', 'rating'], 2], 'star-red',
                          ['<=', ['get', 'rating'], 4], 'star-orange-red',
                          ['<=', ['get', 'rating'], 6], 'star-orange',
                          ['<=', ['get', 'rating'], 8], 'star-gold',
                          'star-green'
                        ],
                        'icon-size': 0.7, // Increased from 0.5 to ensure 44x44 touch target (64px * 0.7 = ~45px)
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true
                      },
                      paint: {
                        'icon-opacity': 1
                      }
                    });
                    console.log('obstacles-rated layer added with color-coded stars');
                    
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'debug',
                        payload: 'obstacles-rated layer created with color-coded stars'
                      }));
                    }
                  }
                }
              });
            });
            
            // Click handler for obstacles
            map.on('click', 'obstacles-unrated', handleObstacleClick);
            map.on('click', 'obstacles-rated', handleObstacleClick);
            
            // Cursor pointer on hover
            map.on('mouseenter', 'obstacles-unrated', function() {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'obstacles-unrated', function() {
              map.getCanvas().style.cursor = '';
            });
            map.on('mouseenter', 'obstacles-rated', function() {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'obstacles-rated', function() {
              map.getCanvas().style.cursor = '';
            });
            
            // Start memory monitoring
            memoryCheckInterval = setInterval(checkMemory, 5000);
            
            // Process pending operations
            processPendingOperations();
            
            // Send ready message
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
          });
          
          map.on('error', function(e) {
            // Log all error details for debugging
            console.error('Mapbox error event:', JSON.stringify(e));
            
            // Only report significant errors, not tile loading issues
            const errorMessage = e.error ? e.error.message : '';
            
            if (errorMessage && errorMessage.trim() !== '') {
              console.error('Mapbox error:', e);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'mapError',
                  payload: errorMessage
                }));
              }
            } else {
              // Log but don't report empty errors (usually tile loading issues)
              console.warn('Mapbox minor error (ignored):', e);
            }
          });
          
          // Add source error handler
          map.on('sourcedataloading', function(e) {
            console.log('Source data loading:', e.sourceId);
          });
          
          map.on('sourcedata', function(e) {
            if (e.isSourceLoaded) {
              console.log('Source data loaded:', e.sourceId);
            }
          });
          
          // Add style error handler
          map.on('styleimagemissing', function(e) {
            console.warn('Style image missing:', e.id);
          });
          
        } catch (error) {
          console.error('Map initialization error:', error);
          const errorMessage = error.message || 'Failed to initialize map';
          console.error('Error details:', errorMessage);
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapError',
              payload: errorMessage
            }));
          } else {
            console.error('ReactNativeWebView not available');
          }
        }

        // ============================================
        // Map Functions
        // ============================================
        
        function handleObstacleClick(e) {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const props = feature.properties;
            
            // Reconstruct obstacle feature
            const obstacleFeature = {
              id: props.id,
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0],
              attributes: {
                conditionScore: props.conditionScore,
                LocationDescription: props.LocationDescription,
                // Add accessibility information for screen readers
                accessibilityLabel: props.rating 
                  ? 'Rated feature with rating ' + props.rating + ' out of 10'
                  : 'Unrated accessibility feature',
                accessibilityHint: props.rating
                  ? 'Tap to view trip details where this feature was rated'
                  : 'Tap to view feature details'
              }
            };
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'featureTapped',
              payload: obstacleFeature
            }));
          }
        }
        
        function updateLocation(location) {
          queueMessage(function() {
            executeWhenReady(function() {
              const sanitized = sanitizeLocation(location);
              if (!sanitized) return;
              
              currentLocation = sanitized;
              const lngLat = [sanitized.longitude, sanitized.latitude];
              
              if (!userMarker) {
                const el = document.createElement('div');
                el.style.width = '16px';
                el.style.height = '16px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = '#007AFF';
                el.style.border = '2px solid #FFFFFF';
                el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                
                userMarker = new mapboxgl.Marker(el)
                  .setLngLat(lngLat)
                  .addTo(map);
              } else {
                userMarker.setLngLat(lngLat);
              }
              
              // Update accuracy circle
              if (sanitized.accuracy && sanitized.accuracy > 0) {
                const radiusInKm = sanitized.accuracy / 1000;
                
                if (!accuracyCircle) {
                  map.addSource('accuracy', {
                    type: 'geojson',
                    data: createCircle(lngLat, radiusInKm)
                  });
                  
                  map.addLayer({
                    id: 'accuracy',
                    type: 'fill',
                    source: 'accuracy',
                    paint: {
                      'fill-color': '#007AFF',
                      'fill-opacity': 0.1
                    }
                  });
                  
                  accuracyCircle = true;
                } else {
                  map.getSource('accuracy').setData(createCircle(lngLat, radiusInKm));
                }
              }
              
              // Center map if user hasn't panned
              if (!userHasPanned) {
                map.easeTo({ center: lngLat, duration: 500 });
              }
              
              // Update recenter button visibility
              const mapCenter = map.getCenter();
              const distance = getDistance(
                [mapCenter.lng, mapCenter.lat],
                lngLat
              );
              
              const btn = document.getElementById('recenter-btn');
              if (btn) {
                if (distance > 50) {
                  btn.classList.remove('hide');
                } else {
                  btn.classList.add('hide');
                }
              }
            });
          });
        }

        function setRoute(locations) {
          queueMessage(function() {
            executeWhenReady(function() {
              routePoints = [];
              
              for (let i = 0; i < locations.length && i < MAX_ROUTE_POINTS; i++) {
                const sanitized = sanitizeLocation(locations[i]);
                if (sanitized) {
                  routePoints.push([sanitized.longitude, sanitized.latitude]);
                }
              }
              
              if (routePoints.length > 1000) {
                routePoints = simplifyPolyline(routePoints, 0.0001);
              }
              
              map.getSource('route').setData({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routePoints
                }
              });
              
              if (routePoints.length > 0) {
                const bounds = routePoints.reduce(function(bounds, coord) {
                  return bounds.extend(coord);
                }, new mapboxgl.LngLatBounds(routePoints[0], routePoints[0]));
                
                map.fitBounds(bounds, { padding: 50 });
              }
            });
          });
        }
        
        function addRoutePoint(location) {
          queueMessage(function() {
            executeWhenReady(function() {
              const sanitized = sanitizeLocation(location);
              if (!sanitized) return;
              
              if (routePoints.length >= MAX_ROUTE_POINTS) {
                console.warn('Max route points reached, simplifying');
                routePoints = simplifyPolyline(routePoints, 0.0002);
              }
              
              routePoints.push([sanitized.longitude, sanitized.latitude]);
              
              let displayPoints = routePoints;
              if (routePoints.length > 1000) {
                displayPoints = simplifyPolyline(routePoints, 0.0001);
              }
              
              map.getSource('route').setData({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: displayPoints
                }
              });
            });
          });
        }
        
        function clearRoute() {
          queueMessage(function() {
            executeWhenReady(function() {
              routePoints = [];
              map.getSource('route').setData({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: []
                }
              });
            });
          });
        }

        function updateObstacles(features) {
          queueMessage(function() {
            executeWhenReady(function() {
              const ratedData = getFromCache('ratedFeatures') || { ids: [], ratings: {} };
              console.log('updateObstacles: Using cached rated data:', ratedData);
              
              // Limit obstacles to prevent memory issues
              const limitedFeatures = features.slice(0, MAX_OBSTACLES);
              
              const geojson = {
                type: 'FeatureCollection',
                features: limitedFeatures.map(function(feature) {
                  const sanitized = sanitizeLocation(feature);
                  if (!sanitized) return null;
                  
                  const isRated = ratedData.ids.includes(feature.id);
                  const rating = ratedData.ratings[feature.id];
                  
                  if (isRated) {
                    console.log('Feature', feature.id, 'is rated with rating:', rating);
                  }
                  
                  return {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [sanitized.longitude, sanitized.latitude]
                    },
                    properties: {
                      id: feature.id,
                      conditionScore: feature.attributes?.conditionScore || null,
                      LocationDescription: feature.attributes?.LocationDescription || '',
                      rating: isRated ? rating : undefined
                    }
                  };
                }).filter(function(f) { return f !== null; })
              };
              
              const ratedCount = geojson.features.filter(f => f.properties.rating !== undefined).length;
              console.log('updateObstacles: Created geojson with', ratedCount, 'rated features out of', geojson.features.length, 'total');
              
              currentObstacles = geojson;
              updateCache('obstacles', geojson);
              map.getSource('obstacles').setData(geojson);
            });
          });
        }
        
        function updateRatedFeatures(payload) {
          queueMessage(function() {
            executeWhenReady(function() {
              console.log('updateRatedFeatures called with:', payload);
              console.log('Rated IDs:', payload.ids);
              console.log('Ratings map:', payload.ratings);
              
              updateCache('ratedFeatures', payload);
              
              // Re-render obstacles with updated ratings
              if (currentObstacles) {
                const features = currentObstacles.features.map(function(feature) {
                  const isRated = payload.ids.includes(feature.properties.id);
                  const rating = payload.ratings[feature.properties.id];
                  
                  if (isRated) {
                    console.log('Marking feature as rated:', feature.properties.id, 'rating:', rating);
                  }
                  
                  return {
                    ...feature,
                    properties: {
                      ...feature.properties,
                      rating: isRated ? rating : undefined
                    }
                  };
                });
                
                const ratedCount = features.filter(f => f.properties.rating !== undefined).length;
                console.log('Updated obstacles with', ratedCount, 'rated features out of', features.length, 'total');
                
                const updatedGeojson = {
                  type: 'FeatureCollection',
                  features: features
                };
                
                currentObstacles = updatedGeojson;
                map.getSource('obstacles').setData(updatedGeojson);
                
                // Verify the layer exists and has the correct filter
                if (map.getLayer('obstacles-rated')) {
                  console.log('obstacles-rated layer exists');
                } else {
                  console.error('obstacles-rated layer NOT FOUND!');
                }
                
                // Check if star image exists
                if (map.hasImage('star')) {
                  console.log('star image exists in map');
                } else {
                  console.error('star image NOT FOUND in map!');
                }
              } else {
                console.warn('No currentObstacles to update');
              }
            });
          });
        }
        
        // ============================================
        // Lazy Loading Functions
        // ============================================
        
        function setAllObstacles(features) {
          queueMessage(function() {
            executeWhenReady(function() {
              console.log('setAllObstacles: Storing', features.length, 'obstacles for lazy loading');
              allObstacles = features;
              
              // Immediately update visible obstacles
              updateVisibleObstacles();
            });
          });
        }
        
        function fitToObstacles() {
          queueMessage(function() {
            executeWhenReady(function() {
              if (allObstacles.length === 0) {
                console.log('fitToObstacles: No obstacles to fit');
                return;
              }
              
              console.log('fitToObstacles: Fitting map to', allObstacles.length, 'obstacles');
              
              // Create bounds from all obstacles
              const coords = allObstacles.map(function(feature) {
                return [feature.longitude, feature.latitude];
              });
              
              if (coords.length === 1) {
                // Single feature - center on it
                map.easeTo({
                  center: coords[0],
                  zoom: 17,
                  duration: 1000
                });
              } else {
                // Multiple features - fit bounds
                const bounds = coords.reduce(function(bounds, coord) {
                  return bounds.extend(coord);
                }, new mapboxgl.LngLatBounds(coords[0], coords[0]));
                
                map.fitBounds(bounds, { 
                  padding: 80,
                  duration: 1000,
                  maxZoom: 17
                });
              }
            });
          });
        }
        
        function updateVisibleObstacles() {
          if (!lazyLoadingEnabled || allObstacles.length === 0) {
            return;
          }
          
          const startTime = Date.now();
          
          // Get current map bounds with padding
          const bounds = map.getBounds();
          const padding = 0.01; // ~1km padding
          const minLng = bounds.getWest() - padding;
          const maxLng = bounds.getEast() + padding;
          const minLat = bounds.getSouth() - padding;
          const maxLat = bounds.getNorth() + padding;
          
          // Filter obstacles within viewport
          const visibleFeatures = [];
          for (let i = 0; i < allObstacles.length && visibleFeatures.length < MAX_VISIBLE_OBSTACLES; i++) {
            const feature = allObstacles[i];
            if (feature.longitude >= minLng && feature.longitude <= maxLng &&
                feature.latitude >= minLat && feature.latitude <= maxLat) {
              visibleFeatures.push(feature);
            }
          }
          
          const filterTime = Date.now() - startTime;
          console.log('Lazy loading: Filtered', visibleFeatures.length, 'visible obstacles from', allObstacles.length, 'total in', filterTime, 'ms');
          
          // Update obstacles with visible features only
          const ratedData = getFromCache('ratedFeatures') || { ids: [], ratings: {} };
          
          const geojson = {
            type: 'FeatureCollection',
            features: visibleFeatures.map(function(feature) {
              const sanitized = sanitizeLocation(feature);
              if (!sanitized) return null;
              
              const isRated = ratedData.ids.includes(feature.id);
              const rating = ratedData.ratings[feature.id];
              
              return {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [sanitized.longitude, sanitized.latitude]
                },
                properties: {
                  id: feature.id,
                  conditionScore: feature.attributes?.conditionScore || null,
                  LocationDescription: feature.attributes?.LocationDescription || '',
                  rating: isRated ? rating : undefined
                }
              };
            }).filter(function(f) { return f !== null; })
          };
          
          currentObstacles = geojson;
          updateCache('obstacles', geojson);
          map.getSource('obstacles').setData(geojson);
          
          const totalTime = Date.now() - startTime;
          console.log('Lazy loading: Updated map with', geojson.features.length, 'features in', totalTime, 'ms');
        }
        
        function recenterMap() {
          if (currentLocation) {
            map.easeTo({
              center: [currentLocation.longitude, currentLocation.latitude],
              duration: 500
            });
            userHasPanned = false;
            const btn = document.getElementById('recenter-btn');
            if (btn) {
              btn.classList.add('hide');
            }
          }
        }
        
        function setZoom(zoom) {
          queueMessage(function() {
            executeWhenReady(function() {
              map.setZoom(zoom);
            });
          });
        }

        // ============================================
        // Utility Functions
        // ============================================
        
        // Douglas-Peucker simplification
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
        
        // Create circle for accuracy
        function createCircle(center, radiusInKm, points) {
          points = points || 64;
          const coords = {
            latitude: center[1],
            longitude: center[0]
          };
          
          const km = radiusInKm;
          const ret = [];
          const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
          const distanceY = km / 110.574;
          
          for (let i = 0; i < points; i++) {
            const theta = (i / points) * (2 * Math.PI);
            const x = distanceX * Math.cos(theta);
            const y = distanceY * Math.sin(theta);
            ret.push([coords.longitude + x, coords.latitude + y]);
          }
          ret.push(ret[0]);
          
          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [ret]
            }
          };
        }
        
        // Calculate distance between two points
        function getDistance(coord1, coord2) {
          const R = 6371e3; // Earth radius in meters
          const lat1 = coord1[1] * Math.PI / 180;
          const lat2 = coord2[1] * Math.PI / 180;
          const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
          const deltaLon = (coord2[0] - coord1[0]) * Math.PI / 180;
          
          const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          
          return R * c;
        }

        // ============================================
        // Message Handler
        // ============================================
        
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
              case 'setAllObstacles':
                setAllObstacles(message.payload);
                break;
              case 'enableLazyLoading':
                lazyLoadingEnabled = message.payload;
                console.log('Lazy loading', lazyLoadingEnabled ? 'enabled' : 'disabled');
                if (lazyLoadingEnabled && allObstacles.length > 0) {
                  updateVisibleObstacles();
                }
                break;
              case 'fitToObstacles':
                fitToObstacles();
                break;
              default:
                console.warn('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error handling message:', error);
          }
        });
        
        // Cleanup on unload
        window.addEventListener('beforeunload', function() {
          if (memoryCheckInterval) {
            clearInterval(memoryCheckInterval);
          }
          if (viewportUpdateTimeout) {
            clearTimeout(viewportUpdateTimeout);
          }
          if (map) {
            map.remove();
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
        <Text style={styles.errorSubtext}>Falling back to standard map view</Text>
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
        mixedContentMode="always"
        originWhitelist={['*']}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setError('Failed to load Mapbox map');
        }}
        accessible={true}
        accessibilityLabel="Interactive map showing rated accessibility features"
        accessibilityHint="Pan and zoom to explore features, tap markers to view details"
        accessibilityRole="image"
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
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
