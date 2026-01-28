import { TourService } from '../TourService';
import { TourStorage } from '../../storage/TourStorage';
import { ProfileService } from '../ProfileService';
import { TourState } from '../../types/tour.types';

/**
 * Unit tests for TourService
 * 
 * Tests cover:
 * - Tour initialization and lifecycle
 * - Step navigation and validation
 * - Tour completion and dismissal
 * - Tour restart functionality
 * - Integration with ProfileService and TourStorage
 * - Error handling for invalid operations
 */
describe('TourService', () => {
  let tourService: TourService;
  let mockStorage: jest.Mocked<TourStorage>;
  let mockProfileService: jest.Mocked<ProfileService>;
  let mockNavigationRef: any;
  const mockUserId = 'user-123';

  beforeEach(() => {
    // Create mocks
    mockStorage = {
      getTourState: jest.fn(),
      saveTourState: jest.fn(),
      clearTourState: jest.fn(),
    } as any;

    mockProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    } as any;

    mockNavigationRef = {
      current: {
        navigate: jest.fn(),
      },
    };

    // Create service instance
    tourService = new TourService(
      mockStorage,
      mockProfileService,
      mockNavigationRef
    );
  });

  describe('initialization', () => {
    it('should initialize with 5 tour steps', () => {
      expect(tourService.getTotalSteps()).toBe(5);
    });

    it('should have correct step configuration', () => {
      const firstStep = tourService.getStep(0);
      expect(firstStep.id).toBe('home_profile_nav');
      expect(firstStep.screen).toBe('Home');
      expect(firstStep.title).toBe('Welcome to RollTracks!');

      const lastStep = tourService.getStep(4);
      expect(lastStep.id).toBe('trip_history');
      expect(lastStep.screen).toBe('History');
    });
  });

  describe('shouldStartTour', () => {
    it('should return true for new user with complete profile and not_started status', async () => {
      mockProfileService.getProfile.mockResolvedValue({
        id: 'profile-1',
        user_id: mockUserId,
        age: 25,
        mode_list: ['wheelchair'],
        trip_history_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tourCompleted: false,
      } as any);
      mockStorage.getTourState.mockResolvedValue({
        currentStep: 0,
        status: 'not_started',
        lastUpdated: new Date().toISOString(),
      });

      const result = await tourService.shouldStartTour(mockUserId);

      expect(result).toBe(true);
      expect(mockProfileService.getProfile).toHaveBeenCalled();
      expect(mockStorage.getTourState).toHaveBeenCalledWith(mockUserId);
    });

    it('should return false if tour is already completed', async () => {
      mockProfileService.getProfile.mockResolvedValue({
        tourCompleted: true,
      } as any);
      mockStorage.getTourState.mockResolvedValue({
        currentStep: 4,
        status: 'completed',
        lastUpdated: new Date().toISOString(),
      });

      const result = await tourService.shouldStartTour(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false if tour is dismissed', async () => {
      mockProfileService.getProfile.mockResolvedValue({
        tourCompleted: false,
      } as any);
      mockStorage.getTourState.mockResolvedValue({
        currentStep: 2,
        status: 'dismissed',
        lastUpdated: new Date().toISOString(),
      });

      const result = await tourService.shouldStartTour(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockProfileService.getProfile.mockRejectedValue(new Error('Profile error'));

      const result = await tourService.shouldStartTour(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('startTour', () => {
    it('should initialize tour state correctly', async () => {
      const result = await tourService.startTour(mockUserId);

      expect(result).toEqual({
        isActive: true,
        currentStep: 0,
        totalSteps: 5,
        status: 'in_progress',
      });
      expect(mockStorage.saveTourState).toHaveBeenCalledWith(mockUserId, result);
    });
  });

  describe('navigateToStep', () => {
    const currentState: TourState = {
      isActive: true,
      currentStep: 0,
      totalSteps: 5,
      status: 'in_progress',
    };

    it('should navigate to valid step index', async () => {
      const result = await tourService.navigateToStep(mockUserId, 1, currentState);

      expect(result.currentStep).toBe(1);
      expect(mockStorage.saveTourState).toHaveBeenCalledWith(mockUserId, result);
    });

    it('should throw error for negative step index', async () => {
      await expect(
        tourService.navigateToStep(mockUserId, -1, currentState)
      ).rejects.toThrow('Invalid step index');
    });

    it('should throw error for step index >= totalSteps', async () => {
      await expect(
        tourService.navigateToStep(mockUserId, 5, currentState)
      ).rejects.toThrow('Invalid step index');
    });

    it('should navigate to screen when action is navigate', async () => {
      await tourService.navigateToStep(mockUserId, 1, currentState);

      expect(mockNavigationRef.current.navigate).toHaveBeenCalledWith('Profile');
    });

    it('should handle missing navigation ref gracefully', async () => {
      const serviceWithoutNav = new TourService(
        mockStorage,
        mockProfileService,
        { current: null }
      );

      // Should not throw
      await expect(
        serviceWithoutNav.navigateToStep(mockUserId, 1, currentState)
      ).resolves.toBeDefined();
    });
  });

  describe('dismissTour', () => {
    const currentState: TourState = {
      isActive: true,
      currentStep: 2,
      totalSteps: 5,
      status: 'in_progress',
    };

    it('should set tour to dismissed state', async () => {
      const result = await tourService.dismissTour(mockUserId, currentState);

      expect(result.isActive).toBe(false);
      expect(result.status).toBe('dismissed');
      expect(mockStorage.saveTourState).toHaveBeenCalledWith(mockUserId, result);
    });
  });

  describe('completeTour', () => {
    const currentState: TourState = {
      isActive: true,
      currentStep: 4,
      totalSteps: 5,
      status: 'in_progress',
    };

    it('should set tour to completed state', async () => {
      const result = await tourService.completeTour(mockUserId, currentState);

      expect(result.isActive).toBe(false);
      expect(result.status).toBe('completed');
      expect(mockStorage.saveTourState).toHaveBeenCalledWith(mockUserId, result);
    });

    it('should update profile with tourCompleted flag', async () => {
      await tourService.completeTour(mockUserId, currentState);

      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ tourCompleted: true })
      );
    });

    it('should handle profile update failure gracefully', async () => {
      mockProfileService.updateProfile.mockRejectedValue(new Error('Profile error'));

      // Should not throw
      const result = await tourService.completeTour(mockUserId, currentState);

      expect(result.status).toBe('completed');
    });
  });

  describe('restartTour', () => {
    it('should clear existing state and start fresh tour', async () => {
      const result = await tourService.restartTour(mockUserId);

      expect(mockStorage.clearTourState).toHaveBeenCalledWith(mockUserId);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ tourCompleted: false })
      );
      expect(result).toEqual({
        isActive: true,
        currentStep: 0,
        totalSteps: 5,
        status: 'in_progress',
      });
    });

    it('should handle profile update failure gracefully', async () => {
      mockProfileService.updateProfile.mockRejectedValue(new Error('Profile error'));

      // Should not throw
      const result = await tourService.restartTour(mockUserId);

      expect(result.status).toBe('in_progress');
      expect(result.currentStep).toBe(0);
    });
  });

  describe('getStep', () => {
    it('should return correct step for valid index', () => {
      const step = tourService.getStep(2);

      expect(step.id).toBe('start_trip');
      expect(step.screen).toBe('StartTrip');
    });
  });

  describe('getTotalSteps', () => {
    it('should return total number of steps', () => {
      expect(tourService.getTotalSteps()).toBe(5);
    });
  });
});
