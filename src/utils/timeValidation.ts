/**
 * Utility functions for time-based validation
 */

/**
 * Check if a trip is within the 24-hour grading window
 * @param trip - The trip to check
 * @returns true if the trip can still be graded, false otherwise
 */
export const canGradeTrip = (trip: { end_time: string | null; status: string }): boolean => {
  // Only completed trips can be graded
  if (trip.status !== 'completed' || !trip.end_time) {
    return false;
  }

  const endTime = new Date(trip.end_time);
  const now = new Date();
  const timeDifferenceMs = now.getTime() - endTime.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  return timeDifferenceMs <= twentyFourHoursMs;
};

/**
 * Get the remaining time for grading a trip
 * @param trip - The trip to check
 * @returns remaining time in milliseconds, or 0 if expired
 */
export const getRemainingGradingTime = (trip: { end_time: string | null; status: string }): number => {
  if (trip.status !== 'completed' || !trip.end_time) {
    return 0;
  }

  const endTime = new Date(trip.end_time);
  const now = new Date();
  const timeDifferenceMs = now.getTime() - endTime.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  return Math.max(0, twentyFourHoursMs - timeDifferenceMs);
};

/**
 * Format remaining time as a human-readable string
 * @param remainingMs - Remaining time in milliseconds
 * @returns formatted string like "23h 45m remaining"
 */
export const formatRemainingTime = (remainingMs: number): string => {
  if (remainingMs <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
};