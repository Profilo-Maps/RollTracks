/**
 * StartTripModal: Hook for Bottom Navigation Bar
 *
 * Features:
 * - Mode selection from user's mode list
 * - Comfort Level slider (1-10) for selected mode
 * - Trip Purpose input
 * - Start Trip button (activates trip recording)
 *
 * Props:
 * - visible: boolean to control modal visibility
 * - onClose: callback when modal is dismissed
 * - onStartTrip: callback with trip parameters when user starts trip
 */

import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState } from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme,
} from 'react-native';
import { ThemedText } from './themed-text';

export interface StartTripParams {
  mode: string;
  comfort: number;
  purpose: string;
}

export interface StartTripModalProps {
  visible: boolean;
  onClose: () => void;
  onStartTrip: (params: StartTripParams) => void;
}

export function StartTripModal({ visible, onClose, onStartTrip }: StartTripModalProps) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Form state
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [comfort, setComfort] = useState<number>(5);
  const [purpose, setPurpose] = useState<string>('');

  // Get user's mode list, default to common modes if not available
  const modeList = user?.modeList || ['wheelchair', 'skateboard', 'walking', 'scooter', 'assisted walking'];

  const handleStartTrip = () => {
    if (!selectedMode) {
      // Could add validation feedback here
      return;
    }

    onStartTrip({
      mode: selectedMode,
      comfort,
      purpose: purpose.trim() || 'General',
    });

    // Reset form
    setSelectedMode(null);
    setComfort(5);
    setPurpose('');
  };

  const handleClose = () => {
    // Reset form on close
    setSelectedMode(null);
    setComfort(5);
    setPurpose('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Start New Trip</ThemedText>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <ThemedText style={[styles.closeText, { color: colors.icon }]}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Mode Selection */}
            <View style={styles.section}>
              <ThemedText style={styles.label}>Select Mode</ThemedText>
              <View style={styles.modeGrid}>
                {modeList.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: selectedMode === mode ? colors.tint : colors.background,
                        borderColor: selectedMode === mode ? colors.tint : colors.icon,
                      },
                    ]}
                    onPress={() => setSelectedMode(mode)}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.modeText,
                        {
                          color: selectedMode === mode ? colors.buttonText : colors.text,
                        },
                      ]}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comfort Level */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <ThemedText style={styles.label}>Comfort Level</ThemedText>
                <ThemedText style={[styles.comfortValue, { color: colors.tint }]}>
                  {comfort}/10
                </ThemedText>
              </View>
              <View style={styles.sliderContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.sliderButton,
                      {
                        backgroundColor: comfort >= value ? colors.tint : colors.background,
                        borderColor: colors.icon,
                      },
                    ]}
                    onPress={() => setComfort(value)}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.sliderButtonText,
                        {
                          color: comfort >= value ? colors.buttonText : colors.icon,
                        },
                      ]}
                    >
                      {value}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.comfortLabels}>
                <ThemedText style={[styles.comfortLabel, { color: colors.icon }]}>
                  Uncomfortable
                </ThemedText>
                <ThemedText style={[styles.comfortLabel, { color: colors.icon }]}>
                  Very Comfortable
                </ThemedText>
              </View>
            </View>

            {/* Trip Purpose */}
            <View style={styles.section}>
              <ThemedText style={styles.label}>Trip Purpose (Optional)</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g., Commute, Recreation, Shopping"
                placeholderTextColor={colors.icon}
                value={purpose}
                onChangeText={setPurpose}
                maxLength={50}
              />
            </View>
          </ScrollView>

          {/* Footer with Start Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.startButton,
                {
                  backgroundColor: selectedMode ? colors.buttonPrimary : colors.icon,
                },
              ]}
              onPress={handleStartTrip}
              disabled={!selectedMode}
              activeOpacity={0.8}
            >
              <ThemedText style={[styles.startButtonText, { color: colors.buttonText }]}>
                Start Trip
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    fontWeight: '300',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  comfortValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    minWidth: 100,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  sliderButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  sliderButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  comfortLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  comfortLabel: {
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  startButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

