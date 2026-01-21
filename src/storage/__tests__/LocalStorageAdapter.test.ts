import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStorageAdapter } from '../LocalStorageAdapter';
import { UserProfile, Trip } from '../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    jest.clearAllMocks();
  });

  describe('Profile Operations', () => {
    const mockProfile: UserProfile = {
      id: 'profile-1',
      age: 25,
      mode_list: ['walking', 'wheelchair'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    test('getProfile returns null when no profile exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await adapter.getProfile();

      expect(result).toBeNull();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@rolltracks:profile');
    });

    test('getProfile returns parsed profile when it exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockProfile));

      const result = await adapter.getProfile();

      expect(result).toEqual(mockProfile);
    });

    test('saveProfile stores profile as JSON', async () => {
      await adapter.saveProfile(mockProfile);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rolltracks:profile',
        JSON.stringify(mockProfile)
      );
    });

    test('updateProfile updates existing profile', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockProfile));

      const updates = { age: 26, mode_list: ['walking', 'scooter'] };
      await adapter.updateProfile('profile-1', updates);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData.age).toBe(26);
      expect(savedData.mode_list).toEqual(['walking', 'scooter']); // Updated
    });

    test('updateProfile throws error when profile not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(adapter.updateProfile('profile-1', { age: 26 })).rejects.toThrow(
        'Profile with id profile-1 not found'
      );
    });
  });

  describe('Trip Operations', () => {
    const mockTrip: Trip = {
      id: 'trip-1',
      mode: 'walking',
      boldness: 7,
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T11:00:00Z',
      duration_seconds: 3600,
      distance_miles: 2.5,
      geometry: 'encoded_polyline_string',
      status: 'completed',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T11:00:00Z',
    };

    test('getTrips returns empty array when no trips exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await adapter.getTrips();

      expect(result).toEqual([]);
    });

    test('getTrips returns parsed trips array', async () => {
      const trips = [mockTrip];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(trips));

      const result = await adapter.getTrips();

      expect(result).toEqual(trips);
    });

    test('getTrip returns specific trip by id', async () => {
      const trips = [mockTrip];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(trips));

      const result = await adapter.getTrip('trip-1');

      expect(result).toEqual(mockTrip);
    });

    test('getTrip returns null when trip not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const result = await adapter.getTrip('nonexistent');

      expect(result).toBeNull();
    });

    test('saveTrip adds new trip to empty list', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await adapter.saveTrip(mockTrip);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@rolltracks:trips',
        JSON.stringify([mockTrip])
      );
    });

    test('saveTrip updates existing trip', async () => {
      const existingTrips = [mockTrip];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingTrips));

      const updatedTrip = { ...mockTrip, duration_seconds: 7200 };
      await adapter.saveTrip(updatedTrip);

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].duration_seconds).toBe(7200);
    });

    test('updateTrip updates specific trip fields', async () => {
      const trips = [mockTrip];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(trips));

      await adapter.updateTrip('trip-1', { end_time: '2024-01-01T12:00:00Z', duration_seconds: 7200 });

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData[0].end_time).toBe('2024-01-01T12:00:00Z');
      expect(savedData[0].duration_seconds).toBe(7200);
    });

    test('updateTrip throws error when trip not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await expect(adapter.updateTrip('trip-1', { duration_seconds: 7200 })).rejects.toThrow(
        'Trip with id trip-1 not found'
      );
    });

    test('deleteTrip removes trip from list', async () => {
      const trips = [mockTrip, { ...mockTrip, id: 'trip-2' }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(trips));

      await adapter.deleteTrip('trip-1');

      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('trip-2');
    });
  });
});
