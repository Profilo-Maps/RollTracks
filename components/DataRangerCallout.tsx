/**
 * DataRangerCallout: Feature rating callout bubble for DataRanger mode
 * 
 * Renders inside MapboxGL.Callout to show feature details and rating interface.
 * Compact design optimized for callout bubble display on the active trip screen.
 * 
 * Features:
 * - Displays feature details (location, condition score, intersection, curb position)
 * - Rating slider (1-10 scale, defaults to 5)
 * - Image upload (camera or photo library)
 * - Calls DataRangerService to log ratings to Supabase
 * - Read-only mode for features encountered more than 6 hours ago (info only, no interaction)
 * - Available on Active Trip, Trip Summary, and Home screens
 */

import { Feature } from '@/components/MapViewComponent';
import { Colors, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemedText } from './themed-text';

export interface DataRangerCalloutProps {
  visible: boolean;
  feature: Feature | null;
  existingRating: number | null;
  onClose: () => void;
  onSubmit: (rating: number, imageUri?: string) => Promise<void>;
  /** Timestamp when the feature was encountered (for 6-hour time window check) */
  encounterTimestamp?: string;
  /** Force read-only mode (overrides time window check) */
  readOnly?: boolean;
  /** Screen position to anchor the callout (x, y coordinates) */
  anchorPosition?: { x: number; y: number };
}

export function DataRangerCallout({
  visible,
  feature,
  existingRating,
  onClose,
  onSubmit,
  encounterTimestamp,
  readOnly = false,
  anchorPosition,
}: DataRangerCalloutProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  const [rating, setRating] = useState<number>(existingRating ?? 5);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && feature) {
      setRating(existingRating ?? 5);
      setImageUri(null);
      setIsSubmitting(false);
    }
  }, [visible, feature, existingRating]);

  // Check if feature is outside the 6-hour rating window
  const isOutsideTimeWindow = React.useMemo(() => {
    if (!encounterTimestamp) return false;
    
    const encounterTime = new Date(encounterTimestamp).getTime();
    const now = Date.now();
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    
    return (now - encounterTime) > sixHoursInMs;
  }, [encounterTimestamp]);

  // Determine if callout should be in read-only mode
  const isReadOnly = readOnly || isOutsideTimeWindow;

  const handleImageUpload = () => {
    Alert.alert(
      'Upload Image',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera permissions.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setImageUri(result.assets[0].uri);
              }
            } catch (error) {
              console.error('[DataRangerCallout] Camera error:', error);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant photo library permissions.');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setImageUri(result.assets[0].uri);
              }
            } catch (error) {
              console.error('[DataRangerCallout] Image picker error:', error);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleSubmit = async () => {
    if (!feature) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(rating, imageUri ?? undefined);
      onClose();
    } catch (error) {
      console.error('[DataRangerCallout] Submit error:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!feature) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1}
          style={[
            styles.container, 
            { backgroundColor: colors.background },
            // Position higher on screen to avoid footer overlap
            {
              position: 'absolute',
              top: '10%', // Position from top
              left: 20,
              right: 20,
              maxHeight: '65%', // Increased to fit all content without scrolling
            }
          ]}
        >
          {/* Header with close button */}
          <View style={[
            styles.header,
            { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
          ]}>
            <ThemedText style={styles.headerTitle}>
              {isReadOnly ? 'Feature Details' : 'Rate Feature'}
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <ThemedText style={[styles.closeText, { color: colors.icon }]}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Feature Details */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Feature Details</ThemedText>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Location:</ThemedText>
            <ThemedText style={styles.detailValue} numberOfLines={2}>
              {feature.properties?.location_description || 'Unknown'}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Condition:</ThemedText>
            <ThemedText style={styles.detailValue}>
              {feature.properties?.condition_score != null
                ? `${feature.properties.condition_score}/10`
                : 'N/A'}
            </ThemedText>
          </View>
          {feature.properties?.location_in_intersection && (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Intersection:</ThemedText>
              <ThemedText style={styles.detailValue} numberOfLines={2}>
                {feature.properties.location_in_intersection}
              </ThemedText>
            </View>
          )}
          {feature.properties?.position_on_curb && (
            <View style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Curb Position:</ThemedText>
              <ThemedText style={styles.detailValue}>
                {feature.properties.position_on_curb}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Show existing rating in read-only mode */}
        {isReadOnly && existingRating !== null && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Your Rating</ThemedText>
            <View style={styles.readOnlyRating}>
              <ThemedText style={[styles.readOnlyRatingValue, { color: colors.tint }]}>
                {existingRating}/10
              </ThemedText>
              <ThemedText style={[styles.readOnlyRatingLabel, { color: colors.icon }]}>
                (Rating window closed)
              </ThemedText>
            </View>
          </View>
        )}

        {/* Interactive rating UI - only show if not read-only */}
        {!isReadOnly && (
          <>
            {/* Rating Slider */}
            <View style={styles.section}>
              <View style={styles.ratingHeader}>
                <ThemedText style={styles.sectionTitle}>Your Rating</ThemedText>
                <ThemedText style={[styles.ratingValue, { color: colors.tint }]}>
                  {rating}/10
                </ThemedText>
              </View>
              <View style={styles.sliderContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.sliderButton,
                      {
                        backgroundColor: rating >= value ? colors.tint : colors.background,
                        borderColor: colors.icon,
                      },
                    ]}
                    onPress={() => setRating(value)}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[
                        styles.sliderButtonText,
                        {
                          color: rating >= value ? colors.tintButtonText : colors.icon,
                        },
                      ]}
                    >
                      {value}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.ratingLabels}>
                <ThemedText style={[styles.ratingLabel, { color: colors.icon }]}>
                  Poor
                </ThemedText>
                <ThemedText style={[styles.ratingLabel, { color: colors.icon }]}>
                  Excellent
                </ThemedText>
              </View>
            </View>

            {/* Image Upload */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Photo (Optional)</ThemedText>
              {imageUri ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: imageUri }} style={styles.image} />
                  <TouchableOpacity
                    style={[styles.removeButton, { backgroundColor: colors.background }]}
                    onPress={() => setImageUri(null)}
                  >
                    <ThemedText style={[styles.removeText, { color: colors.icon }]}>✕</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    {
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: colors.icon,
                    },
                  ]}
                  onPress={handleImageUpload}
                >
                  <ThemedText style={[styles.uploadIcon, { color: colors.icon }]}>📷</ThemedText>
                  <ThemedText style={[styles.uploadText, { color: colors.text }]}>
                    Upload Image
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
          </ScrollView>

          {/* Submit Button - only show if not read-only */}
          {!isReadOnly && (
            <View style={[
              styles.footer,
              { borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
            ]}>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.buttonPrimary }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <ThemedText style={[styles.submitButtonText, { color: colors.buttonText }]}>
                    {existingRating !== null ? 'Update Rating' : 'Submit Rating'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 16,
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
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
  scrollView: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingValue: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '900',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 8,
  },
  sliderButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  sliderButtonText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  uploadText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    fontWeight: '700',
  },
  imagePreview: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  removeText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  readOnlyRating: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  readOnlyRatingValue: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    marginBottom: 4,
  },
  readOnlyRatingLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
});
