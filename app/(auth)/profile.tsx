import React from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Profile Screen
 * Part of Auth Stack - manages user account settings.
 *
 * Features:
 * - Mode list with modal to edit user's mode list (Select Mode List Component)
 * - User summary statistics:
 *   - Average trip length
 *   - Average trip duration
 *   - Average feature rating (DataRanger mode only)
 *   - Average corrected segment (DataRanger mode only)
 * - Buttons: Logout, Delete all user data, Toggle DataRanger mode
 *
 * TODO:
 * - Integrate with Auth Context for user data
 * - Implement Select Mode List Component modal
 * - Fetch statistics from History Service and DataRanger Service
 */
export default function ProfileScreen() {
  const { user, signOut, deleteUserData, toggleDataRangerMode } = useAuth();
  const buttonPrimaryColor = useThemeColor({}, 'buttonPrimary');
  const buttonDangerColor = useThemeColor({}, 'buttonDanger');
  const buttonTextColor = useThemeColor({}, 'buttonText');

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDeleteData = async () => {
    // TODO: Add confirmation dialog
    try {
      await deleteUserData();
    } catch (error) {
      console.error('Delete data failed:', error);
    }
  };

  const handleToggleDataRanger = async () => {
    try {
      await toggleDataRangerMode();
    } catch (error) {
      console.error('Toggle DataRanger failed:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        <ThemedText style={styles.displayName}>
          {user?.displayName ?? 'Guest'}
        </ThemedText>
      </ThemedView>

      {/* Mode List Section */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Travel Modes</ThemedText>
        <Pressable style={styles.modeButton}>
          <ThemedText>
            {user?.modeList?.join(', ') ?? 'No modes selected'}
          </ThemedText>
          <ThemedText type="link">Edit</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Statistics Section */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Statistics</ThemedText>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <ThemedText type="defaultSemiBold">--</ThemedText>
            <ThemedText>Avg Length</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="defaultSemiBold">--</ThemedText>
            <ThemedText>Avg Duration</ThemedText>
          </View>
          {user?.dataRangerMode && (
            <>
              <View style={styles.statItem}>
                <ThemedText type="defaultSemiBold">--</ThemedText>
                <ThemedText>Avg Rating</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="defaultSemiBold">--</ThemedText>
                <ThemedText>Corrections</ThemedText>
              </View>
            </>
          )}
        </View>
      </ThemedView>

      {/* Settings Section */}
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Settings</ThemedText>

        <Pressable style={styles.settingRow} onPress={handleToggleDataRanger}>
          <ThemedText>DataRanger Mode</ThemedText>
          <ThemedText type="defaultSemiBold">
            {user?.dataRangerMode ? 'ON' : 'OFF'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {/* Actions Section */}
      <ThemedView style={styles.section}>
        <Pressable style={[styles.button, { backgroundColor: buttonPrimaryColor }]} onPress={handleLogout}>
          <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>Logout</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: buttonDangerColor }]}
          onPress={handleDeleteData}
        >
          <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
            Delete All Data
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 60,
  },
  displayName: {
    opacity: 0.7,
    marginTop: 4,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  modeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  statItem: {
    width: '50%',
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontWeight: '600',
  },
});
