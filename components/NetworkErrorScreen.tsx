/**
 * NetworkErrorScreen Component
 * 
 * Displays when the app cannot connect to the network on initial load.
 * Provides a retry button to attempt reconnection.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface NetworkErrorScreenProps {
  onRetry: () => void;
}

export function NetworkErrorScreen({ onRetry }: NetworkErrorScreenProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');
  const errorColor = useThemeColor({}, 'error');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  console.log('[NetworkErrorScreen] Rendering with colors:', { backgroundColor, tintColor, errorColor });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ThemedView style={styles.content}>
        {/* Error Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${errorColor}20` }]}>
          <Ionicons name="cloud-offline-outline" size={80} color={errorColor} />
        </View>

        {/* Error Title */}
        <ThemedText type="title" style={styles.title}>
          No Network Connection
        </ThemedText>

        {/* Error Message */}
        <ThemedText style={styles.message}>
          Unable to connect to the server. Please check your internet connection and try again.
        </ThemedText>

        {/* Troubleshooting Tips */}
        <View style={styles.tipsContainer}>
          <ThemedText style={styles.tipsTitle}>Troubleshooting:</ThemedText>
          <ThemedText style={styles.tip}>• Check your WiFi or mobile data</ThemedText>
          <ThemedText style={styles.tip}>• Verify server URL in .env file</ThemedText>
          <ThemedText style={styles.tip}>• Ensure Supabase project is running</ThemedText>
        </View>

        {/* Retry Button */}
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: tintColor },
            pressed && styles.retryButtonPressed,
          ]}
          accessibilityLabel="Retry connection"
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={24} color={buttonTextColor} style={styles.retryIcon} />
          <ThemedText style={[styles.retryButtonText, { color: buttonTextColor }]}>
            Retry Connection
          </ThemedText>
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.8,
  },
  tipsContainer: {
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  tip: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    opacity: 0.7,
    marginBottom: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
});
