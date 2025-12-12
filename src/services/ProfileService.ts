import { StorageAdapter } from '../storage/types';
import { UserProfile, Mode } from '../types';
import { StatisticsService, Statistics } from './StatisticsService';

export class ProfileService {
  private storageAdapter: StorageAdapter;
  private statisticsService: StatisticsService;

  constructor(storageAdapter: StorageAdapter) {
    this.storageAdapter = storageAdapter;
    this.statisticsService = new StatisticsService(storageAdapter);
  }

  /**
   * Validate profile data
   * @param profileData - Profile data to validate
   * @throws Error if validation fails
   */
  private validateProfileData(profileData: {
    age: number;
    mode_list: Mode[];
  }): void {
    // Validate age
    if (typeof profileData.age !== 'number' || isNaN(profileData.age)) {
      throw new Error('Age must be a valid number');
    }
    if (profileData.age < 13 || profileData.age > 120) {
      throw new Error('Age must be between 13 and 120');
    }

    // Validate mode_list
    if (!Array.isArray(profileData.mode_list) || profileData.mode_list.length === 0) {
      throw new Error('Mode list must contain at least one mode');
    }

    // Validate each mode is valid
    const validModes: Mode[] = ['wheelchair', 'assisted_walking', 'skateboard', 'scooter', 'walking'];
    for (const mode of profileData.mode_list) {
      if (!validModes.includes(mode)) {
        throw new Error(`Invalid mode: ${mode}`);
      }
    }
  }

  /**
   * Create a new user profile
   * @param profileData - Profile data to create
   * @returns Created profile
   * @throws Error if creation fails or validation fails
   */
  async createProfile(profileData: {
    user_id?: string;
    age: number;
    mode_list: Mode[];
  }): Promise<UserProfile> {
    try {
      // Validate profile data
      this.validateProfileData(profileData);

      // Check if profile already exists
      const existingProfile = await this.storageAdapter.getProfile();
      if (existingProfile) {
        throw new Error('Profile already exists. Use updateProfile to modify it.');
      }

      // Create new profile
      const now = new Date().toISOString();
      const newProfile: UserProfile = {
        id: this.generateId(),
        user_id: profileData.user_id,
        age: profileData.age,
        mode_list: profileData.mode_list,
        trip_history_ids: [],
        created_at: now,
        updated_at: now,
      };

      await this.storageAdapter.saveProfile(newProfile);
      return newProfile;
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while creating profile');
    }
  }

  /**
   * Get user profile
   * @returns Profile if found, null otherwise
   * @throws Error if fetch fails
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      return await this.storageAdapter.getProfile();
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching profile');
    }
  }

  /**
   * Update user profile
   * @param updates - Profile fields to update
   * @returns Updated profile
   * @throws Error if update fails or validation fails
   */
  async updateProfile(updates: {
    age?: number;
    mode_list?: Mode[];
  }): Promise<UserProfile> {
    try {
      // Get existing profile
      const existingProfile = await this.storageAdapter.getProfile();
      if (!existingProfile) {
        throw new Error('Profile not found. Create a profile first.');
      }

      // Prepare updated data
      const updatedData = {
        age: updates.age !== undefined ? updates.age : existingProfile.age,
        mode_list: updates.mode_list !== undefined ? updates.mode_list : existingProfile.mode_list,
      };

      // Validate updated data
      this.validateProfileData(updatedData);

      // Update profile
      await this.storageAdapter.updateProfile(existingProfile.id, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      // Return updated profile
      const updatedProfile = await this.storageAdapter.getProfile();
      if (!updatedProfile) {
        throw new Error('Failed to retrieve updated profile');
      }

      return updatedProfile;
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while updating profile');
    }
  }

  /**
   * Get profile statistics
   * @returns Statistics including average boldness and trip length
   * @throws Error if fetch fails
   */
  async getStatistics(): Promise<Statistics> {
    try {
      const profile = await this.getProfile();
      if (!profile) {
        throw new Error('Profile not found');
      }

      return await this.statisticsService.getProfileStatistics(profile.id);
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching statistics');
    }
  }

  /**
   * Generate a unique ID for profile
   * @returns Unique ID string
   */
  private generateId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
