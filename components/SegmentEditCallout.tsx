/**
 * SegmentEditCallout: Segment attribute editing callout for DataRanger mode
 *
 * Displays editable attributes for a tapped network segment facility.
 * Shows form fields appropriate to each attribute type:
 * - Dropdowns for categorical values
 * - Numeric inputs for measurements
 * - Toggles for boolean fields
 *
 * Read-only fields (maxspeed, public_data_id_*, geometry) are not shown.
 */

import { Colors, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { FacilityType, NetworkSegment, SegmentEdit } from '@/services/types/NetworkSegment';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from './themed-text';

// Field definition for the edit form
interface FieldDef {
  key: string;
  label: string;
  type: 'dropdown' | 'numeric' | 'toggle' | 'text';
  options?: string[]; // For dropdowns
}

// Shared smoothness/condition options (OSM smoothness tag values)
const SMOOTHNESS_OPTIONS = ['excellent', 'good', 'intermediate', 'bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'] as const;

// Shared surface options
const SURFACE_OPTIONS = ['asphalt', 'concrete', 'paving_stones', 'cobblestone', 'gravel', 'dirt', 'grass', 'sand', 'wood', 'metal', 'unpaved'] as const;

// Field definitions per facility type
const STREET_FIELDS: FieldDef[] = [
  { key: 'highway', label: 'Highway Type', type: 'dropdown', options: ['residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway', 'unclassified', 'service', 'living_street', 'pedestrian', 'footway', 'cycleway', 'path', 'track'] },
  { key: 'oneway', label: 'One-way', type: 'dropdown', options: ['yes', 'no', '-1'] },
  { key: 'lanes', label: 'Lanes', type: 'numeric' },
  { key: 'laneWidth', label: 'Lane Width (m)', type: 'numeric' },
  { key: 'surface', label: 'Surface', type: 'dropdown', options: [...SURFACE_OPTIONS] },
  { key: 'condition', label: 'Condition', type: 'dropdown', options: [...SMOOTHNESS_OPTIONS] },
];

const SIDEWALK_FIELDS: FieldDef[] = [
  { key: 'presence', label: 'Presence', type: 'dropdown', options: ['yes', 'no', 'separate', 'left', 'right', 'both'] },
  { key: 'surface', label: 'Surface', type: 'dropdown', options: [...SURFACE_OPTIONS] },
  { key: 'condition', label: 'Condition', type: 'dropdown', options: [...SMOOTHNESS_OPTIONS] },
  { key: 'width', label: 'Width (m)', type: 'numeric' },
  { key: 'seperator', label: 'Separator', type: 'dropdown', options: ['grass_verge', 'parking_lane', 'flex_posts', 'fence', 'guard_rail', 'bushes', 'trees', 'none'] },
];

const CROSSWALK_FIELDS: FieldDef[] = [
  { key: 'type', label: 'Type', type: 'dropdown', options: ['marked', 'unmarked', 'signalized', 'zebra', 'pelican', 'toucan', 'puffin'] },
  { key: 'controlled', label: 'Controlled', type: 'dropdown', options: ['yes', 'no', 'traffic_signals', 'stop', 'yield'] },
  { key: 'marked', label: 'Marked', type: 'dropdown', options: ['yes', 'no'] },
  { key: 'markings', label: 'Markings', type: 'dropdown', options: ['zebra', 'lines', 'dots', 'ladder', 'dashes', 'surface', 'pictogram', 'none'] },
  { key: 'signals', label: 'Signals', type: 'text' },
  { key: 'island', label: 'Island', type: 'toggle' },
  { key: 'kerb', label: 'Kerb', type: 'dropdown', options: ['raised', 'lowered', 'flush', 'rolled'] },
  { key: 'tactilePaving', label: 'Tactile Paving', type: 'dropdown', options: ['yes', 'no', 'incorrect', 'contrasted'] },
  { key: 'trafficCalming', label: 'Traffic Calming', type: 'dropdown', options: ['yes', 'no', 'bump', 'hump', 'table', 'cushion', 'chicane', 'choker', 'island'] },
  { key: 'continuous', label: 'Continuous', type: 'toggle' },
  { key: 'condition', label: 'Condition', type: 'dropdown', options: ['excellent', 'good', 'intermediate', 'bad', 'very_bad'] },
];

const BIKEWAY_FIELDS: FieldDef[] = [
  { key: 'type', label: 'Type', type: 'dropdown', options: ['lane', 'track', 'share_busway', 'shared_lane', 'opposite', 'opposite_lane', 'opposite_track', 'crossing', 'none'] },
  { key: 'surface', label: 'Surface', type: 'dropdown', options: [...SURFACE_OPTIONS] },
  { key: 'condition', label: 'Condition', type: 'dropdown', options: [...SMOOTHNESS_OPTIONS] },
  { key: 'permitted', label: 'Permitted', type: 'dropdown', options: ['yes', 'no', 'designated', 'dismount', 'use_sidepath'] },
  { key: 'width', label: 'Width (m)', type: 'numeric' },
  { key: 'seperator', label: 'Separator', type: 'dropdown', options: ['grass_verge', 'parking_lane', 'flex_posts', 'fence', 'guard_rail', 'bushes', 'trees', 'none'] },
];

const CURB_RAMP_FIELDS: FieldDef[] = [
  { key: 'returnloc', label: 'Return Location', type: 'text' },
  { key: 'returnposition', label: 'Return Position', type: 'text' },
  { key: 'condition_score', label: 'Condition Score', type: 'numeric' },
];

function getFieldsForFacilityType(facilityType: FacilityType): FieldDef[] {
  if (facilityType === 'street') return STREET_FIELDS;
  if (facilityType.startsWith('sidewalk')) return SIDEWALK_FIELDS;
  if (facilityType.startsWith('crosswalk')) return CROSSWALK_FIELDS;
  if (facilityType.startsWith('bikeway')) return BIKEWAY_FIELDS;
  if (facilityType === 'curb_ramp') return CURB_RAMP_FIELDS;
  return [];
}

function getFacilityLabel(facilityType: FacilityType): string {
  const labels: Record<FacilityType, string> = {
    street: 'Street',
    sidewalk_left: 'Left Sidewalk',
    sidewalk_right: 'Right Sidewalk',
    crosswalk_start: 'Start Crosswalk',
    crosswalk_end: 'End Crosswalk',
    bikeway_left_1: 'Left Bikeway 1',
    bikeway_left_2: 'Left Bikeway 2',
    bikeway_right_1: 'Right Bikeway 1',
    bikeway_right_2: 'Right Bikeway 2',
    curb_ramp: 'Curb Ramp',
  };
  return labels[facilityType] ?? facilityType;
}

/** Get the current value of a field from the segment's facility data */
function getFacilityFieldValue(
  segment: NetworkSegment,
  facilityType: FacilityType,
  fieldKey: string,
): string | null {
  let facility: Record<string, unknown> | null = null;

  switch (facilityType) {
    case 'street': facility = segment.street as unknown as Record<string, unknown>; break;
    case 'sidewalk_left': facility = segment.sidewalkLeft as unknown as Record<string, unknown>; break;
    case 'sidewalk_right': facility = segment.sidewalkRight as unknown as Record<string, unknown>; break;
    case 'crosswalk_start': facility = segment.crosswalkStart as unknown as Record<string, unknown>; break;
    case 'crosswalk_end': facility = segment.crosswalkEnd as unknown as Record<string, unknown>; break;
    case 'bikeway_left_1': facility = segment.bikewayLeft1 as unknown as Record<string, unknown>; break;
    case 'bikeway_left_2': facility = segment.bikewayLeft2 as unknown as Record<string, unknown>; break;
    case 'bikeway_right_1': facility = segment.bikewayRight1 as unknown as Record<string, unknown>; break;
    case 'bikeway_right_2': facility = segment.bikewayRight2 as unknown as Record<string, unknown>; break;
  }

  if (!facility) return null;
  const val = facility[fieldKey];
  if (val == null) return null;
  return String(val);
}

export interface SegmentEditCalloutProps {
  visible: boolean;
  segment: NetworkSegment | null;
  facilityType: FacilityType;
  onClose: () => void;
  onSubmitEdit: (edit: Omit<SegmentEdit, 'tripId' | 'userId' | 'id' | 'createdAt'>) => Promise<void>;
  /**
   * When mode='new', SegmentEditCallout collects attributes for a brand-new
   * segment (no existing parquet row). The submit button reads "Start Recording
   * Segment" and calls onStartRecording instead of onSubmitEdit.
   */
  mode?: 'edit' | 'new';
  onStartRecording?: (attributes: Record<string, string>, facilityType: FacilityType) => void;
}

export function SegmentEditCallout({
  visible,
  segment,
  facilityType,
  onClose,
  onSubmitEdit,
  mode = 'edit',
  onStartRecording,
}: SegmentEditCalloutProps) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  // Track pending edits as field -> new value
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});
  const [conditionRating, setConditionRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);

  const fields = useMemo(() => getFieldsForFacilityType(facilityType), [facilityType]);

  // Reset state when modal opens with new segment
  React.useEffect(() => {
    if (visible) {
      setPendingEdits({});
      setConditionRating(null);
      setIsSubmitting(false);
      setExpandedDropdown(null);
    }
  }, [visible, segment?.streetGridId, facilityType]);

  const getCurrentValue = useCallback((fieldKey: string): string | null => {
    if (!segment) return null;
    // Check pending edits first
    if (fieldKey in pendingEdits) return pendingEdits[fieldKey];
    return getFacilityFieldValue(segment, facilityType, fieldKey);
  }, [segment, facilityType, pendingEdits]);

  const handleFieldChange = useCallback((fieldKey: string, newValue: string) => {
    setPendingEdits(prev => ({ ...prev, [fieldKey]: newValue }));
    setExpandedDropdown(null);
  }, []);

  const handleSubmit = async () => {
    if (mode === 'new') {
      onStartRecording?.(pendingEdits, facilityType);
      return;
    }
    if (!segment || Object.keys(pendingEdits).length === 0) return;

    setIsSubmitting(true);
    try {
      // Submit condition rating if set
      if (conditionRating !== null) {
        await onSubmitEdit({
          streetGridId: segment.streetGridId,
          facilityType,
          fieldName: 'condition_score',
          oldValue: null,
          newValue: String(conditionRating),
        });
      }
      // Submit each pending field edit
      for (const [fieldName, newValue] of Object.entries(pendingEdits)) {
        const oldValue = getFacilityFieldValue(segment, facilityType, fieldName);
        await onSubmitEdit({
          streetGridId: segment.streetGridId,
          facilityType,
          fieldName,
          oldValue,
          newValue,
        });
      }
      setPendingEdits({});
      setConditionRating(null);
      onClose();
    } catch (error) {
      console.error('[SegmentEditCallout] Submit error:', error);
      Alert.alert('Error', 'Failed to submit edits. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'edit' && !segment) return null;

  const editCount = Object.keys(pendingEdits).length + (conditionRating !== null ? 1 : 0);
  const streetName = mode === 'new' ? 'New Segment' : (segment?.street.name ?? 'Unnamed Street');

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
            {
              position: 'absolute',
              top: '8%',
              left: 16,
              right: 16,
              maxHeight: '75%',
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <View style={styles.headerLeft}>
              <ThemedText style={styles.headerTitle}>{mode === 'new' ? `New ${getFacilityLabel(facilityType)}` : `Edit ${getFacilityLabel(facilityType)}`}</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: colors.icon }]}>
                {streetName}{segment ? ` (${segment.streetGridId})` : ''}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <ThemedText style={[styles.closeText, { color: colors.icon }]}>X</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Condition Rating — only for existing segment edits */}
            {mode === 'edit' && <View style={[styles.ratingSection, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.ratingSectionHeader}>
                <ThemedText style={styles.ratingSectionTitle}>Condition Rating</ThemedText>
                {conditionRating !== null && (
                  <ThemedText style={[styles.ratingCurrentValue, { color: colors.tint }]}>
                    {conditionRating}/10
                  </ThemedText>
                )}
              </View>
              <View style={styles.ratingSlider}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                  <Pressable
                    key={v}
                    style={[
                      styles.ratingButton,
                      {
                        backgroundColor: conditionRating !== null && conditionRating >= v ? colors.tint : (colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
                        borderColor: conditionRating !== null && conditionRating >= v ? colors.tint : colors.icon,
                      },
                    ]}
                    onPress={() => setConditionRating(conditionRating === v && v === 1 ? null : v)}
                  >
                    <ThemedText style={[styles.ratingButtonText, { color: conditionRating !== null && conditionRating >= v ? colors.buttonText : colors.text }]}>
                      {v}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.ratingSliderLabels}>
                <ThemedText style={[styles.ratingSliderLabel, { color: colors.icon }]}>Poor</ThemedText>
                <ThemedText style={[styles.ratingSliderLabel, { color: colors.icon }]}>Excellent</ThemedText>
              </View>
            </View>}

            {fields.map((field) => {
              const currentValue = getCurrentValue(field.key);
              const isEdited = field.key in pendingEdits;
              const isMissing = currentValue == null || currentValue === '';

              return (
                <View
                  key={field.key}
                  style={[
                    styles.fieldRow,
                    isMissing && !isEdited && styles.fieldMissing,
                    { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                  ]}
                >
                  <View style={styles.fieldLabelRow}>
                    <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
                    {isMissing && !isEdited && (
                      <ThemedText style={styles.needsInputBadge}>needs input</ThemedText>
                    )}
                    {isEdited && (
                      <ThemedText style={[styles.editedBadge, { color: colors.tint }]}>edited</ThemedText>
                    )}
                  </View>

                  {field.type === 'dropdown' && field.options && (
                    <View>
                      <Pressable
                        style={[
                          styles.dropdownButton,
                          {
                            backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                            borderColor: isEdited ? colors.tint : colors.icon,
                          },
                        ]}
                        onPress={() => setExpandedDropdown(expandedDropdown === field.key ? null : field.key)}
                      >
                        <ThemedText style={styles.dropdownValue}>
                          {currentValue ?? 'Select...'}
                        </ThemedText>
                        <ThemedText style={[styles.dropdownArrow, { color: colors.icon }]}>
                          {expandedDropdown === field.key ? '\u25B2' : '\u25BC'}
                        </ThemedText>
                      </Pressable>
                      {expandedDropdown === field.key && (
                        <View style={[styles.dropdownList, { backgroundColor: colors.background, borderColor: colors.icon }]}>
                          {field.options.map((option) => (
                            <Pressable
                              key={option}
                              style={[
                                styles.dropdownOption,
                                currentValue === option && { backgroundColor: colors.tint + '20' },
                              ]}
                              onPress={() => handleFieldChange(field.key, option)}
                            >
                              <ThemedText style={[
                                styles.dropdownOptionText,
                                currentValue === option && { fontWeight: '800' },
                              ]}>
                                {option}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {field.type === 'numeric' && (
                    <TextInput
                      style={[
                        styles.numericInput,
                        {
                          color: colors.text,
                          backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          borderColor: isEdited ? colors.tint : colors.icon,
                        },
                      ]}
                      value={currentValue ?? ''}
                      placeholder="Enter value"
                      placeholderTextColor={colors.icon}
                      keyboardType="decimal-pad"
                      onChangeText={(text) => handleFieldChange(field.key, text)}
                    />
                  )}

                  {field.type === 'toggle' && (
                    <View style={styles.toggleRow}>
                      {['yes', 'no'].map((option) => (
                        <Pressable
                          key={option}
                          style={[
                            styles.toggleButton,
                            {
                              backgroundColor: currentValue === option
                                ? colors.tint
                                : colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                              borderColor: currentValue === option ? colors.tint : colors.icon,
                            },
                          ]}
                          onPress={() => handleFieldChange(field.key, option)}
                        >
                          <ThemedText style={[
                            styles.toggleText,
                            { color: currentValue === option ? colors.buttonText : colors.text },
                          ]}>
                            {option}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {field.type === 'text' && (
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          color: colors.text,
                          backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                          borderColor: isEdited ? colors.tint : colors.icon,
                        },
                      ]}
                      value={currentValue ?? ''}
                      placeholder="Enter value"
                      placeholderTextColor={colors.icon}
                      onChangeText={(text) => handleFieldChange(field.key, text)}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer with submit */}
          <View style={[styles.footer, { borderTopColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: (mode === 'new' || editCount > 0) ? colors.buttonPrimary : colors.icon },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || (mode === 'edit' && editCount === 0)}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <ThemedText style={[styles.submitButtonText, { color: colors.buttonText }]}>
                  {mode === 'new' ? 'Start Recording Segment' : (editCount > 0 ? `Submit ${editCount} Edit${editCount > 1 ? 's' : ''}` : 'No Changes')}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    fontFamily: Fonts.regular,
    fontWeight: '600',
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  fieldRow: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  fieldMissing: {
    backgroundColor: 'rgba(255, 82, 82, 0.06)',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    fontWeight: '700',
  },
  needsInputBadge: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
    color: '#FF5252',
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  editedBadge: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dropdownValue: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  dropdownArrow: {
    fontSize: 10,
    marginLeft: 8,
  },
  dropdownList: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOptionText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  numericInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    fontWeight: '700',
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
  ratingSection: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  ratingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingSectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    fontWeight: '700',
  },
  ratingCurrentValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    fontWeight: '900',
  },
  ratingSlider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 3,
    marginBottom: 4,
  },
  ratingButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
  },
  ratingButtonText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    fontWeight: '800',
  },
  ratingSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingSliderLabel: {
    fontSize: 10,
    fontFamily: Fonts.regular,
  },
});
