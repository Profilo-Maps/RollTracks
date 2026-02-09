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
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { ThemedText } from './themed-text';

export interface BottomNavigationBarProps {
  onRecordPress?: () => void; // Callback to launch Start Trip Modal
}

export function BottomNavigationBarComponent({ onRecordPress }: BottomNavigationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Determine active route
  const isHome = pathname === '/(main)' || pathname === '/(main)/';
  const isHistory = pathname === '/(main)/history';

  const handleRecordPress = () => {
    // TODO: Launch Start Trip Modal when implemented
    if (onRecordPress) {
      onRecordPress();
    } else {
      console.log('Start Trip Modal not yet implemented');
      // For now, navigate to active-trip as placeholder
      router.push('/(main)/active-trip');
    }
  };

  const handleHomePress = () => {
    router.push('/(main)/');
  };

  const handleHistoryPress = () => {
    router.push('/(main)/history');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 90 : 70,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -8,
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
