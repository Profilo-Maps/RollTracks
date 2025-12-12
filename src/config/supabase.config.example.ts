/**
 * Supabase Configuration Example
 * 
 * Copy this file to supabase.config.ts and fill in your credentials:
 * 1. Go to your Supabase project dashboard
 * 2. Navigate to Settings → API
 * 3. Copy the Project URL and anon/public key
 * 4. Paste them below
 */

export const SUPABASE_CONFIG = {
  url: 'your_supabase_project_url',
  anonKey: 'your_supabase_anon_key',
};

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
};
