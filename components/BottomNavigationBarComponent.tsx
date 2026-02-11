/**
 * BottomNavigationBarComponent: Main navigation bar
 *
 * Features:
 * - Record Button: Launches Start Trip Modal
 * - Home Button: Navigates to Home Screen
 * - History Button: Navigates to Trip History Screen
 *
 * Designed to be placed in the footer slot of BasemapLayout
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { StartTripParams, TripModal } from './TripModal';

export interface BottomNavigationBarProps {
  onRecordPress?: () => void; // Optional callback for custom record behavior
  autoOpenModal?: boolean; // Auto-open the modal (e.g., for orphaned trips)
  onModalVisibilityChange?: (visible: boolean) => void; // Callback when modal visibility changes
}

export function BottomNavigationBarComponent({
  onRecordPress,
  autoOpenModal = false,
  onModalVisibilityChange
}: BottomNavigationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Auto-open modal if requested (e.g., for orphaned trips)
  useEffect(() => {
    if (autoOpenModal && !isModalVisible) {
      setIsModalVisible(true);
      // Notify parent that modal was opened
      onModalVisibilityChange?.(true);
    }
  }, [autoOpenModal, isModalVisible, onModalVisibilityChange]);

  // Determine active route
  const isHome = pathname === '/(main)' || pathname === '/(main)/';
  const isHistory = pathname === '/(main)/history';

  const handleRecordPress = () => {
    if (onRecordPress) {
      onRecordPress();
    } else {
      // Show the Start Trip Modal
      setIsModalVisible(true);
    }
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    // Notify parent that modal was closed
    if (onModalVisibilityChange) {
      onModalVisibilityChange(false);
    }
  };

  const handleStartTrip = (tripParams: StartTripParams) => {
    // Close modal first
    handleModalClose();

    // Navigate to active trip screen with trip parameters
    router.push({
      pathname: '/(main)/active-trip',
      params: {
        mode: tripParams.mode,
        comfort: tripParams.comfort.toString(),
        purpose: tripParams.purpose,
      },
    });
  };

  const handleResumeTrip = () => {
    // Close modal first
    handleModalClose();

    // Navigate to active trip screen (trip is already active in TripService)
    router.push('/(main)/active-trip');
  };

  const handleEndOrphanedTrip = (tripSummary: any) => {
    // Close modal first
    handleModalClose();

    // Navigate to trip summary screen with the ended trip
    router.push({
      pathname: '/(main)/trip-summary',
      params: {
        tripId: tripSummary.tripId,
      },
    });
  };

  const handleHomePress = () => {
    router.push('/(main)');
  };

  const handleHistoryPress = () => {
    router.push('/(main)/history');
  };

  return (
    <>
      <View style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.icon + '30', // 30 = ~20% opacity
          paddingBottom: insets.bottom, // Use safe area inset (no minimum padding)
        }
      ]}>
        {/* History Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleHistoryPress}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isHistory ? 'list' : 'list-outline'}
            size={28}
            color={isHistory ? colors.tint : colors.icon}
          />
          <ThemedText
            style={[
              styles.label,
              { color: isHistory ? colors.tint : colors.icon }
            ]}
          >
            History
          </ThemedText>
        </TouchableOpacity>

        {/* Record Button (Center, Elevated) */}
        <TouchableOpacity
          style={[styles.recordButton, { backgroundColor: colors.buttonDanger }]}
          onPress={handleRecordPress}
          activeOpacity={0.8}
        >
          <Ionicons name="radio-button-on" size={32} color={colors.buttonText} />
        </TouchableOpacity>

        {/* Home Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleHomePress}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isHome ? 'home' : 'home-outline'}
            size={28}
            color={isHome ? colors.tint : colors.icon}
          />
          <ThemedText
            style={[
              styles.label,
              { color: isHome ? colors.tint : colors.icon }
            ]}
          >
            Home
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Trip Modal */}
      <TripModal
        visible={isModalVisible}
        onClose={handleModalClose}
        onStartTrip={handleStartTrip}
        onResumeTrip={handleResumeTrip}
        onEndOrphanedTrip={handleEndOrphanedTrip}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 80,
    paddingTop: 8,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 12,
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default BottomNavigationBarComponent;
