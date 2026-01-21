/**
 * Database type definitions matching Supabase schema
 * Generated from migrations in supabase/migrations/
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          age: number;
          mode_list: string[];
          trip_history_ids: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          age: number;
          mode_list: string[];
          trip_history_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          age?: number;
          mode_list?: string[];
          trip_history_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          boldness: number;
          purpose: string | null;
          start_time: string;
          end_time: string | null;
          duration_seconds: number | null;
          distance_miles: number | null;
          geometry: string | null;
          status: 'active' | 'paused' | 'completed';
          created_at: string;
          updated_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: string;
          boldness: number;
          purpose?: string | null;
          start_time: string;
          end_time?: string | null;
          duration_seconds?: number | null;
          distance_miles?: number | null;
          geometry?: string | null;
          status: 'active' | 'paused' | 'completed';
          created_at?: string;
          updated_at?: string;
          synced_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: string;
          boldness?: number;
          purpose?: string | null;
          start_time?: string;
          end_time?: string | null;
          duration_seconds?: number | null;
          distance_miles?: number | null;
          geometry?: string | null;
          status?: 'active' | 'paused' | 'completed';
          created_at?: string;
          updated_at?: string;
          synced_at?: string | null;
        };
      };
      rated_features: {
        Row: {
          id: string;
          user_id: string;
          trip_id: string;
          feature_id: string;
          user_rating: number;
          latitude: number;
          longitude: number;
          properties: Record<string, any> | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trip_id: string;
          feature_id: string;
          user_rating: number;
          latitude: number;
          longitude: number;
          properties?: Record<string, any> | null;
          timestamp: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          trip_id?: string;
          feature_id?: string;
          user_rating?: number;
          latitude?: number;
          longitude?: number;
          properties?: Record<string, any> | null;
          timestamp?: string;
          created_at?: string;
        };
      };

    };
  };
}

// Convenience type exports
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Trip = Database['public']['Tables']['trips']['Row'];
export type TripInsert = Database['public']['Tables']['trips']['Insert'];
export type TripUpdate = Database['public']['Tables']['trips']['Update'];

export type RatedFeature = Database['public']['Tables']['rated_features']['Row'];
export type RatedFeatureInsert = Database['public']['Tables']['rated_features']['Insert'];
export type RatedFeatureUpdate = Database['public']['Tables']['rated_features']['Update'];

export type TripStatus = 'active' | 'paused' | 'completed';
