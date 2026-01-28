import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useServices } from '../contexts/ServicesContext';
import { useTour } from '../contexts/TourContext';
import { TourOverlay } from '../components/TourOverlay';
import { GPSService } from '../services/GPSService';

import { ModeSelector } from '../components/ModeSelector';
import { BoldnessSelector } from '../components/BoldnessSelector';
import { PurposeSelector } from '../components/PurposeSelector';
import { Mode, TripPurpose } from '../types';
import { handleError } from '../utils/errors';

export const StartTripScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { showError, showSuccess } = useToast();
  const { state: tourState, nextStep, previousStep, dismissTour, completeTour } = useTour();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [availableModes, setAvailableModes] = useState<Mode[]>([]);
  
  // Form state
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [selectedBoldness, setSelectedBoldness] = useState<number | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<TripPurpose | null>(null);

  // Initialize services
  const { profileService, tripService } = useServices();
  const gpsService = new GPSService();

  useEffect(() => {
    loadProfile();
  }, []);

  // Reload profile when screen comes into focus
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('focus', () => {
      loadProfile();
    });
    return unsubscribe;
  }, [navigation]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // First check if user has profile data in AuthContext
      if (user?.modeList && user.modeList.length > 0) {
        setAvailableModes(user.modeList as Mode[]);
      } else {
        // Fallback to checking local storage
        const profile = await profileService.getProfile();
        if (profile) {
          setAvailableModes(profile.mode_list);
        } else {
          showError('Please create a profile first');
          // Navigate to profile screen
          (navigation as any).navigate('Profile');
        }
      }
    } catch (error: any) {
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (modes: Mode[]) => {
    // Single select - take the first mode
    setSelectedMode(modes.length > 0 ? modes[0] : null);
  };

  const isStartEnabled = selectedMode !== null && selectedBoldness !== null && selectedPurpose !== null;

  const handleStartTrip = async () => {
    if (!selectedMode || selectedBoldness === null || !selectedPurpose) {
      return;
    }

    if (!user?.id) {
      showError('User not authenticated. Please log in again.');
      // Sign out to trigger auth state change and show login screen
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
      return;
    }

    setStarting(true);
    try {
      // Check for location permissions FIRST before creating any trip records
      const hasPermission = await gpsService.requestPermissions();
      if (!hasPermission) {
        // Permission denied - show alert with option to open settings
        Alert.alert(
          'Location Permission Required',
          'RollTracks needs location access to track your trips. Please enable location permission in your device settings.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        setStarting(false);
        return;
      }

      // Now create the trip with permissions already granted
      const newTrip = await tripService.startTrip({
        mode: selectedMode,
        boldness: selectedBoldness,
        purpose: selectedPurpose,
        userId: user.id, // Now guaranteed to be available
      });
      
      showSuccess('Trip started successfully');
      
      // Navigate to ActiveTripScreen
      (navigation as any).navigate('ActiveTrip', { tripId: newTrip.id });
    } catch (error: any) {
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      accessible={false}
      accessibilityLabel="Start trip screen"
    >
      
      <View style={styles.content}>
        <Text 
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel="Start Trip"
        >
          Start Trip
        </Text>
        
        <View style={styles.formGroup}>
          <ModeSelector
            selectedModes={selectedMode ? [selectedMode] : []}
            onSelectionChange={handleModeChange}
            availableModes={availableModes}
            label="Mode"
            multiSelect={false}
          />
        </View>
        
        <View style={styles.formGroup}>
          <BoldnessSelector
            value={selectedBoldness}
            onChange={setSelectedBoldness}
          />
        </View>
        
        <View style={styles.formGroup}>
          <PurposeSelector
            value={selectedPurpose}
            onChange={setSelectedPurpose}
          />
        </View>
        
        <View nativeID="start_trip_button">
          <TouchableOpacity
            style={[
              styles.button,
              isStartEnabled ? styles.buttonEnabled : styles.buttonDisabled,
              starting && styles.buttonLoading,
            ]}
            onPress={handleStartTrip}
            disabled={!isStartEnabled || starting}
            accessibilityLabel="Start trip"
            accessibilityRole="button"
            accessibilityHint={
              !isStartEnabled
                ? 'Select mode, boldness, and purpose to enable'
                : starting
                ? 'Starting trip'
                : 'Tap to start your trip'
            }
            accessibilityState={{ disabled: !isStartEnabled || starting }}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" accessibilityLabel="Starting" />
            ) : (
              <Text style={styles.buttonText}>Start Trip</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Tour Overlay - Onboarding Tutorial */}
      {tourState.isActive && tourState.currentStep === 2 && (
        <TourOverlay
          step={{
            id: 'start_trip',
            screen: 'StartTrip',
            title: 'Record Your Trips',
            description: "Look for the red Record button (●) at the bottom of the screen. Tap it to start recording your trip and tracking accessibility features.",
            highlightElement: 'start_trip_button',
            position: 'bottom',
          }}
          currentStep={tourState.currentStep}
          totalSteps={tourState.totalSteps}
          onNext={nextStep}
          onPrevious={previousStep}
          onDismiss={dismissTour}
          onComplete={completeTour}
        />
      )}
      
      {/* Tour Overlay - Step 4: Active Trip Info */}
      {tourState.isActive && tourState.currentStep === 3 && (
        <TourOverlay
          step={{
            id: 'active_trip_info',
            screen: 'StartTrip',
            title: 'Rating Features',
            description: "When a trip is active, dots representing street features will pop up on the map. Click on the dots to rate them and help improve accessibility data!",
            highlightElement: 'start_trip_button',
            position: 'bottom',
          }}
          currentStep={tourState.currentStep}
          totalSteps={tourState.totalSteps}
          onNext={nextStep}
          onPrevious={previousStep}
          onDismiss={dismissTour}
          onComplete={completeTour}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    minHeight: 52,
    minWidth: 44,
    justifyContent: 'center',
  },
  buttonEnabled: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonLoading: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
