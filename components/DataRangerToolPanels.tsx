/**
 * DataRangerToolPanels
 *
 * A single "+" overlay button rendered over the map during a DataRanger trip.
 * Opens a creation panel for adding new segments (GPS-recorded) and new point
 * features (curb ramps, traffic calming).
 *
 * Rating and segment editing are NOT handled here — they happen tacitly via
 * map taps (onRatingSubmit → DataRangerCallout, onSegmentPress → SegmentEditCallout).
 */

import { Colors, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { EditPreviewFeature, SourceMutation } from '@/hooks/useToolGesture';
import type { ToolSubtype } from '@proximity/shared';
import { TOOL_SUBTYPES } from '@proximity/shared';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FacilityType } from '@/services/types/NetworkSegment';
import type { MapAdapter } from '@/services/rnMapboxAdapter';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DataRangerToolPanelsProps {
  isDataRangerMode: boolean;
  onSourceMutation: (mutation: SourceMutation) => void;
  onEditPreviewsChange: (updater: (prev: EditPreviewFeature[]) => EditPreviewFeature[]) => void;
  onChangeset: (type: string, data: unknown) => void;
  adapter: MapAdapter | null;
  /** Called when user triggers the "Start Recording Segment" flow. */
  onNewSegmentRequest?: (facilityType: FacilityType) => void;
  /** Called when user confirms placement of a new point feature. */
  onAddNodeSubmit?: (subtype: 'ramp' | 'calm', coords: [number, number], attributes: Record<string, string>) => void;
}

export interface DataRangerToolPanelsRef {
  onMapTap: (coords: { longitude: number; latitude: number }) => void;
  onMapLongPress: (coords: { longitude: number; latitude: number }) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAW_SEGMENT_SUBTYPES: ToolSubtype[] =
  TOOL_SUBTYPES['draw_segment']?.options.map(o => o.id) ??
  (['street', 'bikeway', 'sidewalk', 'crosswalk', 'curb_return'] as ToolSubtype[]);

function drawSubtypeToFacilityType(subtype: string): FacilityType {
  if (subtype.startsWith('sidewalk') || subtype === 'sidewalk') return 'sidewalk_left';
  if (subtype.startsWith('bikeway') || subtype === 'bikeway') return 'bikeway_left_1';
  if (subtype.startsWith('crosswalk') || subtype === 'curb_return') return 'crosswalk_start';
  return 'street';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DataRangerToolPanels = forwardRef<
  DataRangerToolPanelsRef,
  DataRangerToolPanelsProps
>(function DataRangerToolPanels(
  { isDataRangerMode, onEditPreviewsChange, onNewSegmentRequest, onAddNodeSubmit },
  ref,
) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  // --- Panel open/close ---
  const [panelOpen, setPanelOpen] = useState(false);

  // --- New segment subtype ---
  const [segmentSubtype, setSegmentSubtype] = useState<ToolSubtype>(
    DRAW_SEGMENT_SUBTYPES[0] ?? ('street' as ToolSubtype),
  );

  // --- Add point feature state ---
  const [nodeSubtype, setNodeSubtype] = useState<'ramp' | 'calm'>('ramp');
  const [isPlacingNode, setIsPlacingNode] = useState(false);
  const [pendingNodeCoords, setPendingNodeCoords] = useState<[number, number] | null>(null);
  const [nodeRampAttrs, setNodeRampAttrs] = useState({ returnloc: '', returnposition: '' });
  const [nodeCalmSubtype, setNodeCalmSubtype] = useState('');

  // --- Map tap: only used for point feature placement ---
  const handleMapTap = useCallback((coords: { longitude: number; latitude: number }) => {
    if (!isPlacingNode) return;
    setPendingNodeCoords([coords.longitude, coords.latitude]);
    onEditPreviewsChange(() => [{
      geometry: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
      editType: 'add_node',
      props: { subtype: nodeSubtype },
    }]);
  }, [isPlacingNode, nodeSubtype, onEditPreviewsChange]);

  const handleMapLongPress = useCallback((_coords: { longitude: number; latitude: number }) => {}, []);

  useImperativeHandle(ref, () => ({ onMapTap: handleMapTap, onMapLongPress: handleMapLongPress }), [handleMapTap, handleMapLongPress]);

  // --- Add node confirm ---
  const handleAddNodeConfirm = useCallback(() => {
    if (!pendingNodeCoords) return;
    const attrs: Record<string, string> =
      nodeSubtype === 'ramp'
        ? Object.fromEntries(Object.entries(nodeRampAttrs).filter(([, v]) => v !== ''))
        : nodeCalmSubtype ? { calm_subtype: nodeCalmSubtype } : {};
    onAddNodeSubmit?.(nodeSubtype, pendingNodeCoords, attrs);
    setPendingNodeCoords(null);
    setIsPlacingNode(false);
    onEditPreviewsChange(() => []);
  }, [pendingNodeCoords, nodeSubtype, nodeRampAttrs, nodeCalmSubtype, onAddNodeSubmit, onEditPreviewsChange]);

  const handleAddNodeCancel = useCallback(() => {
    setPendingNodeCoords(null);
    setIsPlacingNode(false);
    onEditPreviewsChange(() => []);
  }, [onEditPreviewsChange]);

  if (!isDataRangerMode) return null;

  const panelBg = colorScheme === 'dark' ? 'rgba(30,30,35,0.92)' : 'rgba(255,255,255,0.92)';
  const activeColor = colors.buttonPrimary;
  const textColor = colors.text;
  const borderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* Placement hint + confirm/cancel when placing a node */}
      {isPlacingNode && (
        <View style={[styles.placementBar, { backgroundColor: panelBg, borderColor }]}>
          <Text style={[styles.placementHint, { color: textColor }]}>
            {pendingNodeCoords ? '📍 Tap map to reposition' : '📍 Tap map to place point'}
          </Text>
          {pendingNodeCoords && (
            <View style={styles.confirmRow}>
              <Pressable style={[styles.confirmBtn, { backgroundColor: activeColor }]} onPress={handleAddNodeConfirm}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, { borderColor }]} onPress={handleAddNodeCancel}>
                <Text style={[styles.cancelBtnText, { color: textColor }]}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <View style={styles.row} pointerEvents="box-none">

        {/* Left: creation panel */}
        <View style={styles.expandedArea} pointerEvents="box-none">
          {panelOpen && (
            <View style={[styles.panel, { backgroundColor: panelBg, borderColor }]}>

              {/* ── New Segment ── */}
              <Text style={[styles.sectionTitle, { color: textColor }]}>New Segment</Text>
              <View style={styles.chipRow}>
                {DRAW_SEGMENT_SUBTYPES.map(st => (
                  <PillButton
                    key={st}
                    label={st.replace(/_/g, ' ')}
                    active={segmentSubtype === st}
                    activeColor={activeColor}
                    textColor={textColor}
                    borderColor={borderColor}
                    onPress={() => setSegmentSubtype(st)}
                  />
                ))}
              </View>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: activeColor }]}
                onPress={() => {
                  onNewSegmentRequest?.(drawSubtypeToFacilityType(segmentSubtype as string));
                  setPanelOpen(false);
                }}
              >
                <Text style={styles.actionBtnText}>▶  Set Attributes & Start Recording</Text>
              </Pressable>

              <View style={[styles.divider, { backgroundColor: borderColor }]} />

              {/* ── Add Point Feature ── */}
              <Text style={[styles.sectionTitle, { color: textColor }]}>Add Point Feature</Text>
              <View style={styles.chipRow}>
                <PillButton
                  label="Curb Ramp"
                  active={nodeSubtype === 'ramp'}
                  activeColor={activeColor}
                  textColor={textColor}
                  borderColor={borderColor}
                  onPress={() => setNodeSubtype('ramp')}
                />
                <PillButton
                  label="Traffic Calming"
                  active={nodeSubtype === 'calm'}
                  activeColor={activeColor}
                  textColor={textColor}
                  borderColor={borderColor}
                  onPress={() => setNodeSubtype('calm')}
                />
              </View>

              {nodeSubtype === 'ramp' && (
                <>
                  <TextInput
                    style={[styles.attrInput, { color: textColor, borderColor }]}
                    placeholder="Return location (e.g. SE corner)"
                    placeholderTextColor="#888"
                    value={nodeRampAttrs.returnloc}
                    onChangeText={v => setNodeRampAttrs(p => ({ ...p, returnloc: v }))}
                  />
                  <TextInput
                    style={[styles.attrInput, { color: textColor, borderColor }]}
                    placeholder="Return position (e.g. parallel)"
                    placeholderTextColor="#888"
                    value={nodeRampAttrs.returnposition}
                    onChangeText={v => setNodeRampAttrs(p => ({ ...p, returnposition: v }))}
                  />
                </>
              )}
              {nodeSubtype === 'calm' && (
                <TextInput
                  style={[styles.attrInput, { color: textColor, borderColor }]}
                  placeholder="Calming subtype (e.g. speed_bump)"
                  placeholderTextColor="#888"
                  value={nodeCalmSubtype}
                  onChangeText={setNodeCalmSubtype}
                />
              )}

              <Pressable
                style={[styles.actionBtn, { backgroundColor: activeColor }]}
                onPress={() => {
                  setIsPlacingNode(true);
                  setPanelOpen(false);
                }}
              >
                <Text style={styles.actionBtnText}>📍  Tap Map to Place Point</Text>
              </Pressable>

            </View>
          )}
        </View>

        {/* Right: "+" toggle button */}
        <View style={styles.buttonColumn}>
          <Pressable
            style={[
              styles.addButton,
              { backgroundColor: panelOpen ? activeColor : panelBg, borderColor },
            ]}
            onPress={() => setPanelOpen(o => !o)}
          >
            <Text style={[styles.addIcon, panelOpen && styles.addIconActive]}>+</Text>
            <Text style={[styles.addLabel, { color: panelOpen ? '#fff' : textColor }]}>Add</Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PillButtonProps {
  label: string;
  active: boolean;
  activeColor: string;
  textColor: string;
  borderColor: string;
  onPress: () => void;
}

function PillButton({ label, active, activeColor, textColor, borderColor, onPress }: PillButtonProps) {
  return (
    <Pressable
      style={[styles.pill, { borderColor: active ? activeColor : borderColor }, active && { backgroundColor: activeColor }]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, { color: active ? '#fff' : textColor }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: 8,
    right: 8,
    zIndex: 200,
    alignItems: 'flex-end',
  },
  placementBar: {
    alignSelf: 'stretch',
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  placementHint: {
    fontSize: 12,
    fontFamily: Fonts?.mono ?? undefined,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts?.mono ?? undefined,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontFamily: Fonts?.mono ?? undefined,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  expandedArea: {
    flex: 1,
    alignItems: 'flex-end',
  },
  buttonColumn: {
    gap: 8,
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  addIcon: {
    fontSize: 24,
    color: '#888',
    lineHeight: 28,
  },
  addIconActive: {
    color: '#fff',
  },
  addLabel: {
    fontSize: 9,
    marginTop: 0,
    fontFamily: Fonts?.mono ?? undefined,
  },
  panel: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts?.mono ?? undefined,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontFamily: Fonts?.mono ?? undefined,
  },
  attrInput: {
    fontSize: 11,
    fontFamily: Fonts?.mono ?? undefined,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts?.mono ?? undefined,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});
