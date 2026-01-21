import { canGradeTrip, getRemainingGradingTime, formatRemainingTime } from '../timeValidation';

describe('timeValidation', () => {
  const mockTrip = {
    id: 'test-trip',
    status: 'completed' as const,
    end_time: null,
  };

  describe('canGradeTrip', () => {
    it('should return false for active trips', () => {
      const activeTrip = { ...mockTrip, status: 'active' as const };
      expect(canGradeTrip(activeTrip)).toBe(false);
    });

    it('should return false for trips without end_time', () => {
      expect(canGradeTrip(mockTrip)).toBe(false);
    });

    it('should return true for completed trips within 24 hours', () => {
      const recentTrip = {
        ...mockTrip,
        end_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      };
      expect(canGradeTrip(recentTrip)).toBe(true);
    });

    it('should return false for completed trips older than 24 hours', () => {
      const oldTrip = {
        ...mockTrip,
        end_time: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(), // 25 hours ago
      };
      expect(canGradeTrip(oldTrip)).toBe(false);
    });
  });

  describe('getRemainingGradingTime', () => {
    it('should return 0 for trips that cannot be graded', () => {
      expect(getRemainingGradingTime(mockTrip)).toBe(0);
    });

    it('should return remaining time for recent trips', () => {
      const recentTrip = {
        ...mockTrip,
        end_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      };
      const remaining = getRemainingGradingTime(recentTrip);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(23 * 60 * 60 * 1000); // Less than 23 hours
    });
  });

  describe('formatRemainingTime', () => {
    it('should format hours and minutes correctly', () => {
      const twoHours = 2 * 60 * 60 * 1000;
      expect(formatRemainingTime(twoHours)).toBe('2h 0m remaining');
    });

    it('should format minutes only for less than an hour', () => {
      const thirtyMinutes = 30 * 60 * 1000;
      expect(formatRemainingTime(thirtyMinutes)).toBe('30m remaining');
    });

    it('should return "Expired" for zero or negative time', () => {
      expect(formatRemainingTime(0)).toBe('Expired');
      expect(formatRemainingTime(-1000)).toBe('Expired');
    });
  });
});