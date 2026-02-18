/**
 * Time Validation Utilities
 * 
 * Provides functions for validating time-based constraints,
 * particularly for the 6-hour grading window for DataRanger features.
 */

/**
 * Extract timestamp from ULID-based trip ID.
 * Trip IDs are ULIDs which encode a timestamp in the first 10 characters.
 * 
 * @param tripId - ULID-formatted trip ID
 * @returns Timestamp in milliseconds, or null if invalid
 */
function extractTimestampFromTripId(tripId: string): number | null {
  if (!tripId || tripId.length < 10) {
    return null;
  }

  try {
    // ULID timestamp is encoded in first 10 characters (base32)
    // Crockford's base32 alphabet
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    
    const timestampPart = tripId.substring(0, 10).toUpperCase();
    let timestamp = 0;
    
    for (let i = 0; i < timestampPart.length; i++) {
      const char = timestampPart[i];
      const value = ENCODING.indexOf(char);
      
      if (value === -1) {
        return null; // Invalid character
      }
      
      timestamp = timestamp * 32 + value;
    }
    
    return timestamp;
  } catch (error) {
    console.error('[timeValidation] Failed to extract timestamp from trip ID:', error);
    return null;
  }
}

/**
 * Check if a trip is within the 6-hour grading window.
 * Features can only be graded within 6 hours of trip completion.
 * 
 * For active trips, always returns true (no time limit during trip).
 * For completed trips, checks if less than 6 hours have passed since completion.
 * 
 * @param tripId - ULID-formatted trip ID (contains creation timestamp)
 * @param status - Trip status ('active', 'paused', 'completed')
 * @returns true if grading is allowed, false otherwise
 */
export function canGradeTrip(tripId: string, status: 'active' | 'paused' | 'completed'): boolean {
  // Active and paused trips can always be graded
  if (status === 'active' || status === 'paused') {
    return true;
  }

  // For completed trips, check 6-hour window
  const tripTimestamp = extractTimestampFromTripId(tripId);
  if (!tripTimestamp) {
    console.warn('[timeValidation] Could not extract timestamp from trip ID:', tripId);
    return false;
  }

  const now = Date.now();
  const hoursSinceTrip = (now - tripTimestamp) / (1000 * 60 * 60);
  
  return hoursSinceTrip <= 6;
}

/**
 * Get remaining time in the grading window (in milliseconds).
 * Returns 0 if window has expired or trip is not completed.
 * 
 * @param tripId - ULID-formatted trip ID
 * @param status - Trip status
 * @returns Remaining time in milliseconds, or 0 if expired/not applicable
 */
export function getRemainingGradingTime(tripId: string, status: 'active' | 'paused' | 'completed'): number {
  // Active and paused trips have no time limit
  if (status === 'active' || status === 'paused') {
    return Infinity;
  }

  const tripTimestamp = extractTimestampFromTripId(tripId);
  if (!tripTimestamp) {
    return 0;
  }

  const now = Date.now();
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const elapsed = now - tripTimestamp;
  const remaining = sixHoursMs - elapsed;
  
  return Math.max(0, remaining);
}

/**
 * Format remaining time as a human-readable string.
 * 
 * @param milliseconds - Remaining time in milliseconds
 * @returns Formatted string (e.g., "2h 30m", "45m", "5m")
 */
export function formatRemainingTime(milliseconds: number): string {
  if (milliseconds <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}
