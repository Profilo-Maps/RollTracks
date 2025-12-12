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
          preferred_route: string | null;
          vehicle_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          age: number;
          preferred_route?: string | null;
          vehicle_type: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          age?: number;
          preferred_route?: string | null;
          vehicle_type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string | null;
          duration_seconds: number | null;
          route_info: string | null;
          status: 'active' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          end_time?: string | null;
          duration_seconds?: number | null;
          route_info?: string | null;
          status: 'active' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string | null;
          duration_seconds?: number | null;
          route_info?: string | null;
          status?: 'active' | 'completed';
          created_at?: string;
          updated_at?: string;
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

export type TripStatus = 'active' | 'completed';
