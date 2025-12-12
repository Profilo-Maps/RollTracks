import { ProfileService } from '../ProfileService';
import { LocalStorageAdapter } from '../../storage/LocalStorageAdapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mode } from '../../types';

describe('ProfileService Integration Tests', () => {
  let profileService: ProfileService;

  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();
    profileService = new ProfileService(new LocalStorageAdapter());
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  describe('createProfile', () => {
    it('should create a profile successfully', async () => {
      const profileData = {
        age: 25,
        mode_list: ['wheelchair', 'walking'] as Mode[],
      };

      const result = await profileService.createProfile(profileData);

      expect(result).toBeDefined();
      expect(result.age).toBe(25);
      expect(result.mode_list).toEqual(['wheelchair', 'walking']);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should validate age is required', async () => {
      const profileData = {
        age: NaN,
        mode_list: ['wheelchair'] as Mode[],
      };

      await expect(profileService.createProfile(profileData)).rejects.toThrow(
        'Age must be a valid number'
      );
    });

    it('should validate age range', async () => {
      const profileData = {
        age: 10,
        mode_list: ['wheelchair'] as Mode[],
      };

      await expect(profileService.createProfile(profileData)).rejects.toThrow(
        'Age must be between 13 and 120'
      );
    });

    it('should validate mode_list is required', async () => {
      const profileData = {
        age: 25,
        mode_list: [] as Mode[],
      };

      await expect(profileService.createProfile(profileData)).rejects.toThrow(
        'Mode list must contain at least one mode'
      );
    });

    it('should validate mode_list contains valid modes', async () => {
      const profileData = {
        age: 25,
        mode_list: ['invalid_mode'] as any,
      };

      await expect(profileService.createProfile(profileData)).rejects.toThrow(
        'Invalid mode'
      );
    });

    it('should throw error if profile already exists', async () => {
      const profileData = {
        age: 25,
        mode_list: ['wheelchair'] as Mode[],
      };

      // Create first profile
      const firstProfile = await profileService.createProfile(profileData);
      expect(firstProfile).toBeDefined();

      // Try to create second profile - should fail
      await expect(profileService.createProfile(profileData)).rejects.toThrow(
        'Profile already exists'
      );
    });
  });

  describe('getProfile', () => {
    it('should return null when no profile exists', async () => {
      const result = await profileService.getProfile();
      expect(result).toBeNull();
    });

    it('should retrieve existing profile', async () => {
      const profileData = {
        age: 25,
        mode_list: ['skateboard', 'scooter'] as Mode[],
      };

      const createdProfile = await profileService.createProfile(profileData);
      expect(createdProfile).toBeDefined();
      
      const result = await profileService.getProfile();

      expect(result).toBeDefined();
      expect(result?.age).toBe(25);
      expect(result?.mode_list).toEqual(['skateboard', 'scooter']);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const profileData = {
        age: 25,
        mode_list: ['wheelchair'] as Mode[],
      };

      const createdProfile = await profileService.createProfile(profileData);
      expect(createdProfile).toBeDefined();

      const result = await profileService.updateProfile({
        age: 30,
        mode_list: ['walking', 'assisted_walking'] as Mode[],
      });

      expect(result.age).toBe(30);
      expect(result.mode_list).toEqual(['walking', 'assisted_walking']);
    });

    it('should throw error if profile does not exist', async () => {
      await expect(
        profileService.updateProfile({ age: 30 })
      ).rejects.toThrow('Profile not found');
    });

    it('should validate updated data', async () => {
      const profileData = {
        age: 25,
        mode_list: ['wheelchair'] as Mode[],
      };

      const createdProfile = await profileService.createProfile(profileData);
      expect(createdProfile).toBeDefined();

      await expect(
        profileService.updateProfile({ age: 10 })
      ).rejects.toThrow('Age must be between 13 and 120');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics with zero trips', async () => {
      const profileData = {
        age: 25,
        mode_list: ['wheelchair'] as Mode[],
      };

      await profileService.createProfile(profileData);
      
      const stats = await profileService.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.averageBoldness).toBe(0);
      expect(stats.averageTripLength).toBe(0);
      expect(stats.totalTrips).toBe(0);
    });
  });
});
