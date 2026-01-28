import { User, Session } from '@supabase/supabase-js';

// Export database types
export * from './database.types';

// Export tour types
export * from './tour.types';

// Mode type enum for RollTracks
export type Mode = 'wheelchair' | 'assisted_walking' | 'skateboard' | 'scooter' | 'walking';

// Trip purpose type
export type TripPurpose = 'work' | 'recreation' | 'other';

// LocationPoint interface for GPS data
export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export interface UserProfile {
  id: string;
  user_id: string; // Required in cloud mode
  age: number;
  mode_list: Mode[]; // Changed from vehicle_type
  trip_history_ids?: string[]; // References to trips
  created_at: string;
  updated_at: string;
  tourCompleted?: boolean; // Flag indicating tour completion
}

// Note: Trip type is imported from database.types.ts



export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export interface AppError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface AppMode {
  supabaseConfigured: boolean;
  authenticated: boolean;
}

export type SyncStatus = 'pending' | 'synced' | 'failed';

// Obstacle visualization types
export interface ObstacleFeature {
  id: string;
  latitude: number;
  longitude: number;
  attributes: Record<string, any>;
}

export interface ProximityQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

// Accessibility rating types
export interface RatedFeature {
  id: string;                    // Original feature ID
  tripId: string;                // Associated trip ID
  userRating: number;            // Rating value (1-10)
  timestamp: string;             // ISO 8601 timestamp
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: Record<string, any>; // Original obstacle properties
}

// Extended ObstacleFeature for UI state
export interface ObstacleFeatureWithRating extends ObstacleFeature {
  rating?: number;               // Present if feature has been rated
  isRated: boolean;              // Flag for visual distinction
}

// Component prop interfaces
export interface RatingModalProps {
  visible: boolean;
  initialRating?: number;
  onSubmit: (rating: number) => void;
  onCancel: () => void;
  nativeID?: string;
}

export interface FeaturePopupProps {
  feature: ObstacleFeatureWithRating;
  visible: boolean;
  onClose: () => void;
  onRate: () => void;
  tripId: string;
}
