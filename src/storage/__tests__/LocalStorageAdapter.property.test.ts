import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStorageAdapter } from '../LocalStorageAdapter';
import { UserProfile, Mode } from '../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('LocalStorageAdapter Property-Based Tests', () => {
  let adapter: LocalStorageAdapter;
  let storage: Map<string, string>;

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    storage = new Map<string, string>();

    // Mock AsyncStorage with in-memory storage
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) || null);
    });

    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });

    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });
  });

  // Generators for property-based testing
  const validDateArbitrary = fc
    .integer({ min: 0, max: Date.now() + 365 * 24 * 60 * 60 * 1000 })
    .map(timestamp => new Date(timestamp).toISOString());

  const modeArbitrary = fc.oneof(
    fc.constant('wheelchair' as Mode),
    fc.constant('assisted_walking' as Mode),
    fc.constant('skateboard' as Mode),
    fc.constant('scooter' as Mode),
    fc.constant('walking' as Mode)
  );

  const modeListArbitrary = fc.array(modeArbitrary, { minLength: 1, maxLength: 5 }).map(modes => {
    // Remove duplicates
    return Array.from(new Set(modes));
  });

  const profileArbitrary = fc.record({
    id: fc.uuid(),
    user_id: fc.option(fc.uuid(), { nil: undefined }),
    age: fc.integer({ min: 13, max: 120 }),
    mode_list: modeListArbitrary,
    trip_history_ids: fc.option(fc.array(fc.uuid(), { maxLength: 10 }), { nil: undefined }),
    created_at: validDateArbitrary,
    updated_at: validDateArbitrary,
  });

  /**
   * Feature: rolltracks-gps-tracking, Property 3: Profile data round trip
   * 
   * For any valid profile data, saving to AsyncStorage and then retrieving should return 
   * profile data equivalent to the original.
   * 
   * Validates: Requirements 10.1, 10.3
   */
  test('Property 3: Profile data round trip', async () => {
    await fc.assert(
      fc.asyncProperty(profileArbitrary, async (profile: UserProfile) => {
        // Save the profile
        await adapter.saveProfile(profile);

        // Retrieve the profile
        const retrieved = await adapter.getProfile();

        // The retrieved profile should be equivalent to the original
        expect(retrieved).not.toBeNull();
        expect(retrieved).toEqual(profile);
      }),
      { numRuns: 100 }
    );
  });
});
