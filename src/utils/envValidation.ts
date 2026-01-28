/**
 * Environment validation utility
 * Validates Supabase configuration and provides fallback to offline mode
 */

export interface EnvValidationResult {
  isValid: boolean;
  supabaseConfigured: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate environment variables
 * @returns Validation result with errors and warnings
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Load from config file
  const { SUPABASE_CONFIG } = require('../config/supabase.config');
  const supabaseUrl = SUPABASE_CONFIG.url || '';
  const supabaseAnonKey = SUPABASE_CONFIG.anonKey || '';

  // Check if Supabase is configured
  if (!supabaseUrl || !supabaseAnonKey) {
    warnings.push('Supabase not configured - running in offline mode');
    return {
      isValid: true, // Valid for offline mode
      supabaseConfigured: false,
      errors,
      warnings,
    };
  }

  // Check if Supabase is configured
  if (!supabaseUrl || !supabaseAnonKey) {
    warnings.push('Supabase not configured - running in offline mode');
    return {
      isValid: true, // Valid for offline mode
      supabaseConfigured: false,
      errors,
      warnings,
    };
  }

  // Check for placeholder values
  if (supabaseUrl === 'your_supabase_project_url' || supabaseAnonKey === 'your_supabase_anon_key') {
    warnings.push('Supabase credentials are placeholder values - running in offline mode');
    return {
      isValid: true, // Valid for offline mode
      supabaseConfigured: false,
      errors,
      warnings,
    };
  }

  // Validate Supabase URL format
  if (!isValidSupabaseUrl(supabaseUrl)) {
    errors.push('Invalid Supabase URL format. Expected: https://[project-id].supabase.co');
  }

  // Validate Anon Key format (should be a JWT token starting with 'eyJ')
  if (!isValidAnonKey(supabaseAnonKey)) {
    warnings.push('Anon key format looks unusual. Expected JWT token starting with "eyJ"');
  }

  const supabaseConfigured = errors.length === 0;

  return {
    isValid: errors.length === 0,
    supabaseConfigured,
    errors,
    warnings,
  };
}

/**
 * Validate Supabase URL format
 * @param url - Supabase URL to validate
 * @returns true if valid, false otherwise
 */
function isValidSupabaseUrl(url: string): boolean {
  try {
    // Use a simple regex check instead of URL constructor for React Native compatibility
    const urlPattern = /^https:\/\/[a-zA-Z0-9-]+\.(supabase\.co|supabase\.in)(\/.*)?$/;
    return urlPattern.test(url);
  } catch (error) {
    return false;
  }
}

/**
 * Validate Anon Key format
 * @param key - Anon key to validate
 * @returns true if valid, false otherwise
 */
function isValidAnonKey(key: string): boolean {
  // Supabase anon keys are JWT tokens that start with 'eyJ'
  return key.startsWith('eyJ') && key.length > 100;
}

/**
 * Get environment mode
 * @returns 'cloud' if Supabase is configured, 'offline' otherwise
 */
export function getEnvironmentMode(): 'cloud' | 'offline' {
  const validation = validateEnvironment();
  return validation.supabaseConfigured ? 'cloud' : 'offline';
}

/**
 * Log environment validation results
 */
export function logEnvironmentValidation(): void {
  const validation = validateEnvironment();

  console.log('=== Environment Validation ===');
  console.log(`Mode: ${validation.supabaseConfigured ? 'Cloud' : 'Offline'}`);

  if (validation.errors.length > 0) {
    console.error('Errors:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.warn('Warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    console.log('✓ Environment validation passed');
  }

  console.log('==============================');
}
