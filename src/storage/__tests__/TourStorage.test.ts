import AsyncStorage from '@react-native-async-storage/async-storage';
import { TourStorage } from '../TourStorage';
import { TourState, StoredTourState } from '../../types/tour.types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('TourStorage', () => {
  let storage: TourStorage;
  const mockUserId = 'user-123';

  beforeEach(() => {
    storage = new TourStorage();
    jest.clearAllMocks();
  });

  describe('getTourState', () => {
    it('should return default state when no data exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await storage.getTourState(mockUserId);

      expect(result).toEqual({
        currentStep: 0,
        status: 'not_started',
        lastUpdated: expect.any(String),
      });
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`@tour_state_${mockUserId}`);
    });

    it('should return parsed tour state when data exists', async () => {
      const mockStoredState: StoredTourState = {
        currentStep: 2,
        status: 'in_progress',
        lastUpdated: '2024-01-01T10:00:00Z',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockStoredState));

      const result = await storage.getTourState(mockUserId);

      expect(result).toEqual(mockStoredState);
    });

    it('should return default state on JSON parse error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const result = await storage.getTourState(mockUserId);

      expect(result).toEqual({
        currentStep: 0,
        status: 'not_started',
        lastUpdated: expect.any(String),
      });
    });

    it('should return default state on AsyncStorage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await storage.getTourState(mockUserId);

      expect(result).toEqual({
        currentStep: 0,
        status: 'not_started',
        lastUpdated: expect.any(String),
      });
    });

    it('should log error when storage fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await storage.getTourState(mockUserId);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load tour state:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveTourState', () => {
    it('should save tour state to AsyncStorage', async () => {
      const mockTourState: TourState = {
        isActive: true,
        currentStep: 3,
        totalSteps: 5,
        status: 'in_progress',
        simulatedTrip: null,
      };

      await storage.saveTourState(mockUserId, mockTourState);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `@tour_state_${mockUserId}`,
        expect.any(String)
      );

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData).toEqual({
        currentStep: 3,
        status: 'in_progress',
        lastUpdated: expect.any(String),
      });
    });

    it('should only persist relevant fields from TourState', async () => {
      const mockTourState: TourState = {
        isActive: true,
        currentStep: 2,
        totalSteps: 5,
        status: 'in_progress',
        simulatedTrip: {
          id: 'sim_123',
          isSimulated: true,
          startTime: new Date(),
          mode: 'walking',
          obstacles: [],
        },
      };

      await storage.saveTourState(mockUserId, mockTourState);

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData).not.toHaveProperty('isActive');
      expect(savedData).not.toHaveProperty('totalSteps');
      expect(savedData).not.toHaveProperty('simulatedTrip');
      expect(savedData).toHaveProperty('currentStep');
      expect(savedData).toHaveProperty('status');
      expect(savedData).toHaveProperty('lastUpdated');
    });

    it('should update lastUpdated timestamp on save', async () => {
      const mockTourState: TourState = {
        isActive: true,
        currentStep: 1,
        totalSteps: 5,
        status: 'in_progress',
        simulatedTrip: null,
      };

      const beforeSave = new Date().toISOString();
      await storage.saveTourState(mockUserId, mockTourState);
      const afterSave = new Date().toISOString();

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData.lastUpdated).toBeDefined();
      expect(savedData.lastUpdated >= beforeSave).toBe(true);
      expect(savedData.lastUpdated <= afterSave).toBe(true);
    });

    it('should throw error when AsyncStorage fails', async () => {
      const mockTourState: TourState = {
        isActive: true,
        currentStep: 1,
        totalSteps: 5,
        status: 'in_progress',
        simulatedTrip: null,
      };
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      await expect(storage.saveTourState(mockUserId, mockTourState)).rejects.toThrow(
        'Storage full'
      );
    });

    it('should log error when save fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockTourState: TourState = {
        isActive: true,
        currentStep: 1,
        totalSteps: 5,
        status: 'in_progress',
        simulatedTrip: null,
      };
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      await expect(storage.saveTourState(mockUserId, mockTourState)).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save tour state:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearTourState', () => {
    it('should remove tour state from AsyncStorage', async () => {
      await storage.clearTourState(mockUserId);

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`@tour_state_${mockUserId}`);
    });

    it('should not throw error when AsyncStorage fails', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(storage.clearTourState(mockUserId)).resolves.not.toThrow();
    });

    it('should log error when clear fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await storage.clearTourState(mockUserId);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to clear tour state:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Storage key format', () => {
    it('should use correct key format for different user IDs', async () => {
      const userIds = ['user-1', 'user-abc', '12345'];

      for (const userId of userIds) {
        await storage.getTourState(userId);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith(`@tour_state_${userId}`);
      }
    });
  });
});
