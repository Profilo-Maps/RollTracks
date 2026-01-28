import React, { createContext, useContext, useEffect, useState } from 'react';
import { TripService } from '../services/TripService';
import { ProfileService } from '../services/ProfileService';
import { RatingService } from '../services/RatingService';
import { StatisticsService } from '../services/StatisticsService';
import { SyncService } from '../services/SyncService';
import { HybridStorageAdapter } from '../storage/HybridStorageAdapter';
import { StorageAdapter } from '../storage/types';

interface ServicesContextType {
  tripService: TripService;
  profileService: ProfileService;
  ratingService: RatingService;
  statisticsService: StatisticsService;
  syncService: SyncService;
  storageAdapter: StorageAdapter;
  isReady: boolean;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

export const ServicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [services, setServices] = useState<ServicesContextType | null>(null);

  useEffect(() => {
    const initializeServices = async () => {
      // Initialize SyncService
      const syncService = new SyncService();
      await syncService.initialize();

      // Initialize storage adapter with sync
      const storageAdapter = new HybridStorageAdapter(syncService) as StorageAdapter;

      // Initialize all services with the same storage adapter
      const tripService = new TripService(storageAdapter);
      const profileService = new ProfileService(storageAdapter);
      const ratingService = new RatingService(storageAdapter as any);
      const statisticsService = new StatisticsService(storageAdapter);

      setServices({
        tripService,
        profileService,
        ratingService,
        statisticsService,
        syncService,
        storageAdapter,
        isReady: true,
      });

      console.log('Services initialized and ready');
    };

    initializeServices();
  }, []);

  if (!services) {
    return null; // Or a loading screen
  }

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
};

export const useServices = (): ServicesContextType => {
  const context = useContext(ServicesContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
};
