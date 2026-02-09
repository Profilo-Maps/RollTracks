import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import SelectModeListComponent from '@/components/SelectModeListComponent';
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
 * - Fetch statistics from History Service and DataRanger Service
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, deleteUserData, toggleDataRangerMode, updateUser } = useAuth();
  const [isModeModalVisible, setIsModeModalVisible] = useState(false);
  const [selectedModes, setSelectedModes] = useState<string[]>(user?.modeList ?? []);

  const buttonPrimaryColor = useThemeColor({}, 'buttonPrimary');
  const buttonDangerColor = useThemeColor({}, 'buttonDanger');
  const buttonTextColor = useThemeColor({}, 'buttonText');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigate to login screen after successful logout
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteData = () => {
    // First confirmation - explain what will be deleted
    Alert.alert(
      '⚠️ Delete Account',
      'This will PERMANENTLY delete:\n\n• All your trips and routes\n• All feature ratings\n• All segment corrections\n• Your account and recovery credentials\n\nThis action CANNOT be undone and your data CANNOT be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Second confirmation - final warning
            Alert.alert(
              '🛑 Final Warning',
              'Are you absolutely sure you want to permanently delete all your data?\n\nThis is your last chance to cancel.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteUserData();
                      // User will be automatically logged out and redirected to auth screen
                    } catch (error) {
                      console.error('Delete data failed:', error);
                      Alert.alert(
                        'Error',
                        'Failed to delete data. Please try again or contact support if the problem persists.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleToggleDataRanger = async () => {
    try {
      await toggleDataRangerMode();
    } catch (error) {
      console.error('Toggle DataRanger failed:', error);
      Alert.alert('Error', 'Failed to toggle DataRanger mode. Please try again.');
    }
  };

  const handleOpenModeModal = () => {
    setSelectedModes(user?.modeList ?? []);
    setIsModeModalVisible(true);
  };

  const handleSaveModes = async () => {
    try {
      await updateUser({ modeList: selectedModes });
      setIsModeModalVisible(false);
    } catch (error) {
      console.error('Update modes failed:', error);
      Alert.alert('Error', 'Failed to update modes. Please try again.');
    }
  };

  return (
    <>
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
          <Pressable style={styles.modeButton} onPress={handleOpenModeModal}>
            <ThemedText style={styles.modeText}>
              {user?.modeList && user.modeList.length > 0
                ? user.modeList.join(', ')
                : 'No modes selected'}
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
              <ThemedText style={styles.statLabel}>Avg Length</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText type="defaultSemiBold">--</ThemedText>
              <ThemedText style={styles.statLabel}>Avg Duration</ThemedText>
            </View>
            {user?.dataRangerMode && (
              <>
                <View style={styles.statItem}>
                  <ThemedText type="defaultSemiBold">--</ThemedText>
                  <ThemedText style={styles.statLabel}>Avg Rating</ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText type="defaultSemiBold">--</ThemedText>
                  <ThemedText style={styles.statLabel}>Corrections</ThemedText>
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
            <View style={[
              styles.toggle,
              { backgroundColor: user?.dataRangerMode ? tintColor : '#ccc' }
            ]}>
              <ThemedText style={styles.toggleText}>
                {user?.dataRangerMode ? 'ON' : 'OFF'}
              </ThemedText>
            </View>
          </Pressable>
        </ThemedView>

        {/* Actions Section */}
        <ThemedView style={styles.section}>
          <Pressable 
            style={[styles.button, { backgroundColor: buttonPrimaryColor }]} 
            onPress={handleLogout}
          >
            <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
              Logout
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.button, styles.dangerButton, { backgroundColor: buttonDangerColor }]}
            onPress={handleDeleteData}
          >
            <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
              Delete Account & All Data
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>

      {/* Mode Selection Modal */}
      <Modal
        visible={isModeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContent, { backgroundColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Select Travel Modes</ThemedText>
              <Pressable onPress={() => setIsModeModalVisible(false)}>
                <ThemedText type="link">Cancel</ThemedText>
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <SelectModeListComponent
                selected={selectedModes}
                onChange={setSelectedModes}
              />
            </View>

            <Pressable
              style={[styles.button, { backgroundColor: buttonPrimaryColor }]}
              onPress={handleSaveModes}
            >
              <ThemedText style={[styles.buttonText, { color: buttonTextColor }]}>
                Save
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </>
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
  modeText: {
    flex: 1,
    marginRight: 12,
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
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButton: {
    marginTop: 8,
  },
  buttonText: {
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBody: {
    marginBottom: 20,
  },
});
