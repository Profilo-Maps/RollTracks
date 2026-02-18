/**
 * TripModal: Hook for Bottom Navigation Bar
 *
 * Features:
 * - Mode selection from user's mode list
 * - Comfort Level slider (1-10) for selected mode
 * - Trip Purpose input
 * - Start Trip button (activates trip recording)
 * - Orphaned trip detection and resume/end options
 *
 * Props:
 * - visible: boolean to control modal visibility
 * - onClose: callback when modal is dismissed
 * - onStartTrip: callback with trip parameters when user starts trip
 * - onResumeTrip: callback when user resumes an orphaned trip
 * - onEndOrphanedTrip: callback when user ends an orphaned trip
 */

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { OrphanedTripInfo, TripService } from '@/services/TripService';
import { mediumImpact, selectionFeedback, successNotification, warningNotification } from '@/utils/haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { ThemedText } from './themed-text';

export interface StartTripParams {
  mode: string;
  comfort: number;
  purpose: string;
}

export interface PostTripResult {
  reachedDest: boolean;
}

export interface TripModalProps {
  visible: boolean;
  onClose: () => void;
  onStartTrip: (params: StartTripParams) => void;
  onResumeTrip?: () => void;
  onEndOrphanedTrip?: (tripSummary: any) => void;
  /** When true, shows the post-trip survey instead of start trip form */
  postTripMode?: boolean;
  /** Called when user completes the post-trip survey */
  onPostTripComplete?: (result: PostTripResult) => void;
}

export function TripModal({ visible, onClose, onStartTrip, onResumeTrip, onEndOrphanedTrip, postTripMode, onPostTripComplete }: TripModalProps) {
  const { user } = useAuth();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  // Orphaned trip state
  const [orphanedTrip, setOrphanedTrip] = useState<OrphanedTripInfo | null>(null);
  const [isCheckingOrphans, setIsCheckingOrphans] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [comfort, setComfort] = useState<number>(5);
  const [purpose, setPurpose] = useState<string>('');

  // Post-trip survey state
  const [reachedDest, setReachedDest] = useState<boolean | null>(null);

  // Get user's mode list, default to common modes if not available
  const modeList = user?.modeList || ['wheelchair', 'skateboard', 'walking', 'scooter', 'assisted walking'];

  // Check for orphaned trips when modal becomes visible (skip in post-trip mode)
  useEffect(() => {
    if (visible && !postTripMode) {
      checkForOrphanedTrips();
    }
  }, [visible, postTripMode]);

  const checkForOrphanedTrips = async () => {
    setIsCheckingOrphans(true);
    try {
      const orphanedTripInfo = await TripService.checkForOrphanedTrip();
      setOrphanedTrip(orphanedTripInfo);
    } catch (error) {
      console.error('[TripModal] Failed to check for orphaned trips:', error);
      Alert.alert('Error', 'Failed to check for existing trips. Please try again.');
    } finally {
      setIsCheckingOrphans(false);
    }
  };

  const handleResumeTrip = async () => {
    if (!orphanedTrip) return;

    mediumImpact(); // Medium impact for resume action
    setIsProcessing(true);
    try {
      await TripService.resumeTrip();
      setOrphanedTrip(null);

      // Call parent callback if provided
      if (onResumeTrip) {
        onResumeTrip();
      }

      onClose();
    } catch (error) {
      console.error('[TripModal] Failed to resume trip:', error);
      Alert.alert('Error', 'Failed to resume trip. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndOrphanedTrip = async () => {
    if (!orphanedTrip) return;

    warningNotification(); // Warning for ending trip
    setIsProcessing(true);
    try {
      const tripSummary = await TripService.endTrip();
      setOrphanedTrip(null);

      // Call parent callback if provided
      if (onEndOrphanedTrip) {
        onEndOrphanedTrip(tripSummary);
      }

      onClose();
    } catch (error) {
      console.error('[TripModal] Failed to end trip:', error);
      Alert.alert('Error', 'Failed to end trip. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTrip = () => {
    if (!selectedMode || !purpose) {
      // Require both mode and purpose to be selected
      return;
    }

    successNotification(); // Success notification for starting trip

    onStartTrip({
      mode: selectedMode,
      comfort,
      purpose,
    });

    // Reset form
    setSelectedMode(null);
    setComfort(5);
    setPurpose('');
  };

  const handlePostTripSubmit = () => {
    if (reachedDest === null) return;

    successNotification(); // Success notification for completing survey

    if (onPostTripComplete) {
      onPostTripComplete({ reachedDest });
    }

    // Reset post-trip state
    setReachedDest(null);
  };

  const handleClose = () => {
    // Reset form on close
    setSelectedMode(null);
    setComfort(5);
    setPurpose('');
    setOrphanedTrip(null);
    setReachedDest(null);
    onClose();
  };

  // Helper function to format trip time
  const formatTripTime = (startTime: string) => {
    const date = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Helper function to calculate distance traveled
  const calculateDistance = (coordinates: [number, number][]) => {
    if (coordinates.length < 2) return 0;

    let totalMeters = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];

      // Haversine formula (simplified)
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalMeters += R * c;
    }

    return (totalMeters / 1609.34).toFixed(2); // Convert to miles
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
          <View style={[
            styles.header,
            { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
          ]}>
            <ThemedText style={styles.title}>
              {postTripMode
                ? 'Trip Complete'
                : isCheckingOrphans
                  ? 'Checking...'
                  : orphanedTrip
                    ? 'Trip In Progress'
                    : 'Start New Trip'}
            </ThemedText>
            {!postTripMode && (
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <ThemedText style={[styles.closeText, { color: colors.icon }]}>✕</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Post Trip Survey */}
          {postTripMode && (
            <>
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                  <ThemedText style={styles.label}>
                    Did you reach your destination?
                  </ThemedText>
                  <View style={styles.purposeGrid}>
                    <TouchableOpacity
                      style={[
                        styles.postTripButton,
                        {
                          backgroundColor: reachedDest === true ? '#4CAF50' : colors.background,
                          borderColor: reachedDest === true ? '#4CAF50' : colors.icon,
                        },
                      ]}
                      onPress={() => {
                        selectionFeedback();
                        setReachedDest(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.purposeText,
                          {
                            color: reachedDest === true ? '#FFFFFF' : colors.text,
                          },
                        ]}
                      >
                        Yes
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.postTripButton,
                        {
                          backgroundColor: reachedDest === false ? colors.buttonDanger ?? '#FF3B30' : colors.background,
                          borderColor: reachedDest === false ? colors.buttonDanger ?? '#FF3B30' : colors.icon,
                        },
                      ]}
                      onPress={() => {
                        selectionFeedback();
                        setReachedDest(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.purposeText,
                          {
                            color: reachedDest === false ? '#FFFFFF' : colors.text,
                          },
                        ]}
                      >
                        No
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              <View style={[
                styles.footer,
                { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}>
                <TouchableOpacity
                  style={[
                    styles.startButton,
                    {
                      backgroundColor: reachedDest !== null ? colors.buttonPrimary : colors.icon,
                    },
                  ]}
                  onPress={handlePostTripSubmit}
                  disabled={reachedDest === null}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.startButtonText, { color: reachedDest !== null ? colors.buttonText : (colorScheme === 'dark' ? '#000000' : '#FFFFFF') }]}>
                    Submit
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Loading State */}
          {!postTripMode && isCheckingOrphans && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={styles.loadingText}>Checking for existing trips...</ThemedText>
            </View>
          )}

          {/* Orphaned Trip UI */}
          {!postTripMode && !isCheckingOrphans && orphanedTrip && (
            <>
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                  <View style={[
                    styles.warningBanner,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(10, 126, 164, 0.1)',
                      borderColor: colorScheme === 'dark' ? colors.icon : colors.tint
                    }
                  ]}>
                    <ThemedText style={styles.warningIcon}>⚠️</ThemedText>
                    <View style={styles.warningContent}>
                      <ThemedText style={styles.warningTitle}>
                        {orphanedTrip.status === 'paused' ? 'Paused Trip Found' : 'Active Trip Found'}
                      </ThemedText>
                      <ThemedText style={styles.warningDescription}>
                        You have a {orphanedTrip.status} trip from {formatTripTime(orphanedTrip.tripData.metadata.startTime)}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText style={styles.label}>Trip Details</ThemedText>
                  <View style={[
                    styles.tripDetails,
                    { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
                  ]}>
                    <View style={[
                      styles.detailRow,
                      { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                    ]}>
                      <ThemedText style={styles.detailLabel}>Mode:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {orphanedTrip.tripData.metadata.mode.charAt(0).toUpperCase() +
                         orphanedTrip.tripData.metadata.mode.slice(1)}
                      </ThemedText>
                    </View>
                    <View style={[
                      styles.detailRow,
                      { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                    ]}>
                      <ThemedText style={styles.detailLabel}>Distance:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {calculateDistance(orphanedTrip.tripData.coordinates)} miles
                      </ThemedText>
                    </View>
                    <View style={[
                      styles.detailRow,
                      { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                    ]}>
                      <ThemedText style={styles.detailLabel}>Purpose:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {orphanedTrip.tripData.metadata.purpose}
                      </ThemedText>
                    </View>
                    {orphanedTrip.distanceFromLastPoint !== null && (
                      <View style={[
                        styles.detailRow,
                        { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                      ]}>
                        <ThemedText style={styles.detailLabel}>Distance from last point:</ThemedText>
                        <ThemedText style={styles.detailValue}>
                          {orphanedTrip.distanceFromLastPoint.toFixed(0)}m
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText style={[styles.infoText, { color: colors.icon }]}>
                    {orphanedTrip.status === 'paused'
                      ? 'You can resume this trip to continue recording, or end it to save what you\'ve recorded so far.'
                      : 'This trip is still active. You can resume recording or end it now.'}
                  </ThemedText>
                </View>
              </ScrollView>

              {/* Orphaned Trip Actions */}
              <View style={[
                styles.footer,
                { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.resumeButton,
                    { backgroundColor: colors.buttonPrimary }
                  ]}
                  onPress={handleResumeTrip}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <ThemedText style={[styles.actionButtonText, { color: colors.buttonText }]}>
                      Resume Trip
                    </ThemedText>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.endButton,
                    {
                      backgroundColor: 'transparent',
                      borderColor: colors.text,
                      borderWidth: 2
                    }
                  ]}
                  onPress={handleEndOrphanedTrip}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                      End Trip
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Normal Start Trip UI */}
          {!postTripMode && !isCheckingOrphans && !orphanedTrip && (
            <>
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
                    onPress={() => {
                      selectionFeedback();
                      setSelectedMode(mode);
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.modeText,
                        {
                          color: selectedMode === mode ? colors.tintButtonText : colors.text,
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
                    onPress={() => {
                      selectionFeedback();
                      setComfort(value);
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.sliderButtonText,
                        {
                          color: comfort >= value ? colors.tintButtonText : colors.icon,
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
                  <ThemedText style={styles.label}>Trip Purpose</ThemedText>
                  <View style={styles.purposeGrid}>
                    {['commute', 'recreation', 'errand', 'other'].map((purposeOption) => (
                      <TouchableOpacity
                        key={purposeOption}
                        style={[
                          styles.purposeButton,
                          {
                            backgroundColor: purpose === purposeOption ? colors.tint : colors.background,
                            borderColor: purpose === purposeOption ? colors.tint : colors.icon,
                          },
                        ]}
                        onPress={() => {
                          selectionFeedback();
                          setPurpose(purposeOption);
                        }}
                        activeOpacity={0.7}
                      >
                        <ThemedText
                          style={[
                            styles.purposeText,
                            {
                              color: purpose === purposeOption ? colors.tintButtonText : colors.text,
                            },
                          ]}
                        >
                          {purposeOption.charAt(0).toUpperCase() + purposeOption.slice(1)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Footer with Start Button */}
              <View style={[
                styles.footer,
                { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
              ]}>
                <TouchableOpacity
                  style={[
                    styles.startButton,
                    {
                      backgroundColor: (selectedMode && purpose) ? colors.buttonPrimary : colors.icon,
                    },
                  ]}
                  onPress={handleStartTrip}
                  disabled={!selectedMode || !purpose}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.startButtonText, { color: (selectedMode && purpose) ? colors.buttonText : (colorScheme === 'dark' ? '#000000' : '#FFFFFF') }]}>
                    Start Trip
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 24,
    fontFamily: Fonts.regular,
    fontWeight: '600',
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
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
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
    fontFamily: Fonts.bold,
    fontWeight: '900',
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
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
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
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  comfortLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  comfortLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },
  purposeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  purposeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    minWidth: 90,
    alignItems: 'center',
  },
  purposeText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  postTripButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
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
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  // Orphaned Trip Styles
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: Fonts.medium,
    fontWeight: '700',
  },
  warningBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    fontWeight: '900', // Upgraded from 700 to 900
    marginBottom: 4,
  },
  warningDescription: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    fontWeight: '700', // Upgraded from 500 to 700
  },
  tripDetails: {
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    fontWeight: '700', // Upgraded from 500 to 700
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    fontWeight: '800', // Upgraded from 600 to 800
  },
  infoText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resumeButton: {
    // Primary button styling applied via backgroundColor prop
  },
  endButton: {
    // Outlined button styling applied via borderColor/borderWidth props
  },
  actionButtonText: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    fontWeight: '600',
  },
});

