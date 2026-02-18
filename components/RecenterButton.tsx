/**
 * RecenterButton: Floating button to recenter map on user location
 *
 * Features:
 * - Circular button with location icon
 * - Positioned on the right side of its container
 * - Calls onPress callback to trigger map recentering
 * - Themed with light/dark mode support
 *
 * Usage:
 * - Place in secondary footer slot for Home/Trip Summary screens
 * - Place in body slot for Active Trip screen (during segment correction)
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mediumImpact } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export interface RecenterButtonProps {
  onPress: () => void;
  position?: 'secondary-footer' | 'body'; // Different positioning contexts
}

export function RecenterButton({ onPress, position = 'secondary-footer' }: RecenterButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handlePress = () => {
    mediumImpact(); // Medium impact for recenter action
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.background },
        position === 'body' ? styles.bodyPosition : styles.secondaryFooterPosition,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons name="locate" size={24} color={colors.tint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  secondaryFooterPosition: {
    // Position on right side of secondary footer slot
    alignSelf: 'flex-end',
    marginRight: 16,
    marginBottom: 8,
  },
  bodyPosition: {
    // Position in bottom right of body slot
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
});

export default RecenterButton;
