import Geolocation from 'react-native-geolocation-service';
import polyline from '@mapbox/polyline';
import { LocationPoint } from '../types';
import { Platform, PermissionsAndroid } from 'react-native';

export class GPSService {
  private watchId: number | null = null;
  private locationCallback: ((location: LocationPoint) => void) | null = null;

  /**
   * Request location permissions from the device
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // iOS permissions are handled through Info.plist
        // Request authorization
        const result = await Geolocation.requestAuthorization('whenInUse');
        return result === 'granted';
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'RollTracks needs access to your location to track your trips.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }

      return false;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Start tracking GPS location
   */
  async startTracking(callback: (location: LocationPoint) => void): Promise<void> {
    if (this.watchId !== null) {
      console.warn('GPS tracking is already active');
      return;
    }

    this.locationCallback = callback;

    this.watchId = Geolocation.watchPosition(
      (position) => {
        if (!this.locationCallback) {
          return;
        }

        // Validate location accuracy (< 50 meters for quality tracking)
        if (position.coords.accuracy > 50) {
          console.warn('Low GPS accuracy:', position.coords.accuracy);
        }

        const locationPoint: LocationPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy,
        };

        // Validate coordinates
        if (this.isValidLocation(locationPoint)) {
          console.log('GPS point recorded:', {
            lat: locationPoint.latitude.toFixed(6),
            lng: locationPoint.longitude.toFixed(6),
            accuracy: locationPoint.accuracy ? locationPoint.accuracy.toFixed(2) : 'N/A',
          });
          this.locationCallback(locationPoint);
        } else {
          console.warn('Invalid GPS coordinates:', locationPoint);
        }
      },
      (error) => {
        console.error('GPS tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5, // Minimum 5 meters between updates
        interval: 2000, // Update every 2 seconds
        fastestInterval: 2000,
        showLocationDialog: true,
        forceRequestLocation: true,
      }
    );
  }

  /**
   * Stop tracking GPS location
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.locationCallback = null;
    }
  }

  /**
   * Validate location point coordinates
   */
  private isValidLocation(point: LocationPoint): boolean {
    // Validate latitude bounds
    if (point.latitude < -90 || point.latitude > 90) {
      return false;
    }

    // Validate longitude bounds
    if (point.longitude < -180 || point.longitude > 180) {
      return false;
    }

    return true;
  }

  /**
   * Encode GPS points to polyline string
   */
  encodePolyline(points: LocationPoint[]): string {
    // Convert LocationPoint[] to [lat, lng][] format for polyline library
    const coordinates: [number, number][] = points.map(point => [
      point.latitude,
      point.longitude,
    ]);
    
    return polyline.encode(coordinates);
  }

  /**
   * Decode polyline string to GPS points
   */
  decodePolyline(encoded: string): LocationPoint[] {
    const coordinates = polyline.decode(encoded);
    
    // Convert [lat, lng][] back to LocationPoint[]
    return coordinates.map(([latitude, longitude]) => ({
      latitude,
      longitude,
      timestamp: Date.now(), // Timestamp is lost in encoding, use current time
    }));
  }

  /**
   * Calculate distance in miles from GPS points
   * Uses Haversine formula for great-circle distance
   */
  calculateDistance(points: LocationPoint[]): number {
    if (points.length < 2) {
      return 0;
    }

    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const point1 = points[i];
      const point2 = points[i + 1];
      
      totalDistance += this.haversineDistance(
        point1.latitude,
        point1.longitude,
        point2.latitude,
        point2.longitude
      );
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in miles
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3958.8; // Earth's radius in miles
    
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
