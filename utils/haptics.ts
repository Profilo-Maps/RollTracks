/**
 * Haptic Feedback Utility
 * 
 * Centralized haptic feedback management for consistent user experience.
 * All haptic feedback calls should go through this utility.
 * 
 * Supports both iOS and Android platforms with appropriate fallbacks.
 * 
 * Platform differences:
 * - iOS: Full support for all feedback types with native Taptic Engine
 * - Android: Impact feedback supported, notifications fall back to medium impact
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Light impact - for subtle interactions
 * Use for: selections, toggles, slider adjustments, tab switches
 * 
 * iOS: Light Taptic Engine feedback
 * Android: Light vibration pattern
 */
export const lightImpact = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Medium impact - for standard interactions
 * Use for: button presses, navigation actions, recenter
 * 
 * iOS: Medium Taptic Engine feedback
 * Android: Medium vibration pattern
 */
export const mediumImpact = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Heavy impact - for significant actions
 * Use for: record button, stop trip, delete actions
 * 
 * iOS: Heavy Taptic Engine feedback
 * Android: Heavy vibration pattern
 */
export const heavyImpact = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Success notification - for successful completions
 * Use for: trip started, trip ended successfully, data saved
 * 
 * iOS: Success notification pattern
 * Android: Falls back to medium impact (notification types not supported)
 */
export const successNotification = () => {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (Platform.OS === 'android') {
    // Android doesn't support notification types, use medium impact as fallback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Warning notification - for warnings or destructive actions
 * Use for: stop trip confirmation, delete warnings
 * 
 * iOS: Warning notification pattern
 * Android: Falls back to heavy impact (notification types not supported)
 */
export const warningNotification = () => {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } else if (Platform.OS === 'android') {
    // Android doesn't support notification types, use heavy impact as fallback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Error notification - for errors or failures
 * Use for: validation errors, network failures
 * 
 * iOS: Error notification pattern
 * Android: Falls back to heavy impact (notification types not supported)
 */
export const errorNotification = () => {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } else if (Platform.OS === 'android') {
    // Android doesn't support notification types, use heavy impact as fallback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Selection feedback - for picker/selector changes
 * Use for: mode selection, purpose selection, comfort level
 * 
 * iOS: Selection feedback (light tap)
 * Android: Falls back to light impact (selection type not supported)
 */
export const selectionFeedback = () => {
  if (Platform.OS === 'ios') {
    Haptics.selectionAsync();
  } else if (Platform.OS === 'android') {
    // Android doesn't support selection type, use light impact as fallback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};
