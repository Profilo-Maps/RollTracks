/**
 * DataRangerToolPanels
 *
 * Collapsible overlay panels rendered over the map during an active DataRanger
 * trip. Houses all gesture-driven editing tools. Two top-level panels:
 *
 *   1. Rating Panel  — tap features to contribute ratings (highlight_point tool)
 *   2. Correction Panel — point/node editing + segment drawing corrections
 *
 * The component owns activeTool/activeSubtype state and instantiates
 * useToolGesture internally. onMapTap and onMapLongPress are exposed to the
 * parent MapViewComponent through a forwarded ref via useImperativeHandle.
 */

import { Colors, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import {
  type EditPreviewFeature,
  type SourceMutation,
  useToolGesture,
} from '@/hooks/useToolGesture';
import type { MapAdapter, ToolId, ToolSubtype } from '@proximity/shared';
import { TOOL_SUBTYPES } from '@proximity/shared';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FacilityType } from '@/services/types/NetworkSegment';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DataRangerToolPanelsProps {
  isDataRangerMode: boolean;
  onSourceMutation: (mutation: SourceMutation) => void;
  onEditPreviewsChange: (updater: (prev: EditPreviewFeature[]) => EditPreviewFeature[]) => void;
  onChangeset: (type: string, data: unknown) => void;
  adapter: MapAdapter | null;
  /** Called when user triggers the "Start Recording Segment" flow from the panel. */
  onNewSegmentRequest?: (facilityType: FacilityType) => void;
  /** Called when user confirms placement of a new point feature. */
  onAddNodeSubmit?: (subtype: 'ramp' | 'calm', coords: [number, number], attributes: Record<string, string>) => void;
}

/** Methods exposed to the parent via ref so MapViewComponent can forward events. */
export interface DataRangerToolPanelsRef {
  onMapTap: (coords: { longitude: number; latitude: number }) => void;
  onMapLongPress: (coords: { longitude: number; latitude: number }) => void;
}

// ---------------------------------------------------------------------------
// Internal layout types
// ---------------------------------------------------------------------------

type TopPanel = 'rating' | 'correction' | null;
type CorrectionSubPanel = 'point_editor' | 'segment_corrector' | null;

// Rating sub-tool feature types. These are DataRanger-specific label keys and
// are NOT part of the shared ToolSubtype union, so we use a plain string type.
const RATING_SUBTYPES: Array<{ label: string; subtype: string }> = [
  { label: 'Street',          subtype: 'street' },
  { label: 'Sidewalk L',      subtype: 'sidewalk_left' },
  { label: 'Sidewalk R',      subtype: 'sidewalk_right' },
  { label: 'X-walk Start',    subtype: 'crosswalk_start' },
  { label: 'X-walk End',      subtype: 'crosswalk_end' },
  { label: 'Bikeway',         subtype: 'bikeway' },
];

// Segment draw subtypes from the shared constant (new structure: { options, default }).
const DRAW_SEGMENT_SUBTYPES: ToolSubtype[] =
  TOOL_SUBTYPES['draw_segment']?.options.map(o => o.id) ??
  (['street', 'bikeway', 'sidewalk', 'crosswalk', 'curb_return'] as ToolSubtype[]);

// add_node subtypes available on mobile (intersection nodes are not user-placeable).
const ADD_NODE_SUBTYPES: Array<{ label: string; subtype: ToolSubtype }> = [
  { label: 'Curb Ramp', subtype: 'ramp' },
  { label: 'Traffic Calming', subtype: 'calm' },
];

/** Maps draw_segment ToolSubtype to the nearest FacilityType for attribute capture. */
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
  { isDataRangerMode, onSourceMutation, onEditPreviewsChange, onChangeset, adapter, onNewSegmentRequest, onAddNodeSubmit },
  ref,
) {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  // --- Panel open/close state ---
  const [openPanel, setOpenPanel] = useState<TopPanel>(null);
  const [openSubPanel, setOpenSubPanel] = useState<CorrectionSubPanel>(null);

  // --- Tool selection state (owned here, passed down to useToolGesture) ---
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [activeSubtype, setActiveSubtype] = useState<ToolSubtype | null>(null);

  // --- add_node placement state (bypasses shared tool machinery on mobile) ---
  const [pendingNodeCoords, setPendingNodeCoords] = useState<[number, number] | null>(null);
  const [nodeRampAttrs, setNodeRampAttrs] = useState({ returnloc: '', returnposition: '' });
  const [nodeCalmSubtype, setNodeCalmSubtype] = useState<string>('');

  // Helper: activate a tool + subtype together.
  // Silently ignores the request when adapter is not yet ready so that tool
  // tap handlers are never invoked against a null adapter.
  const selectTool = useCallback((tool: ToolId | null, subtype: ToolSubtype | null = null) => {
    if (tool !== null && adapter === null) return;
    setActiveTool(tool);
    setActiveSubtype(subtype);
    if (tool !== 'add_node') {
      setPendingNodeCoords(null);
      onEditPreviewsChange(() => []);
    }
  }, [adapter, onEditPreviewsChange]);

  // --- useToolGesture (instantiated here, adapter from props) ---
  // useToolGesture requires a non-null MapAdapter, but this component accepts
  // null until the map finishes initialising. selectTool() blocks tool
  // activation while adapter is null, so onMapTap / onMapLongPress will never
  // fire with an active tool when adapter === null. The cast is therefore safe.
  const {
    onMapTap,
    onMapLongPress,
    confirmTool,
    cancelTool,
    statusText,
  } = useToolGesture({
    adapter: adapter as MapAdapter,
    activeTool,
    subtype: activeSubtype,
    onSourceMutation,
    onEditPreviewsChange,
    onChangeset,
  });

  // --- add_node: confirm placement ---
  const handleAddNodeConfirm = useCallback(() => {
    if (!pendingNodeCoords || !activeSubtype) return;
    const subtype = activeSubtype === 'calm' ? 'calm' : 'ramp';
    const attributes: Record<string, string> =
      subtype === 'ramp'
        ? Object.fromEntries(Object.entries(nodeRampAttrs).filter(([, v]) => v !== ''))
        : nodeCalmSubtype ? { calm_subtype: nodeCalmSubtype } : {};
    onAddNodeSubmit?.(subtype, pendingNodeCoords, attributes);
    setPendingNodeCoords(null);
    onEditPreviewsChange(() => []);
    selectTool(null);
    cancelTool();
  }, [pendingNodeCoords, activeSubtype, nodeRampAttrs, nodeCalmSubtype, onAddNodeSubmit, onEditPreviewsChange, selectTool, cancelTool]);

  // --- add_node: intercept map taps to place/move preview node ---
  const handleMapTap = useCallback((coords: { longitude: number; latitude: number }) => {
    if (activeTool === 'add_node') {
      setPendingNodeCoords([coords.longitude, coords.latitude]);
      // Emit preview via onEditPreviewsChange so the parent can render it on the map.
      // EditPreviewFeature shape: { geometry, editType, props? } — NOT a GeoJSON Feature.
      onEditPreviewsChange(() => [{
        geometry: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
        editType: 'add_node',
        props: { subtype: activeSubtype ?? 'ramp' },
      }]);
    } else {
      onMapTap(coords);
    }
  }, [activeTool, activeSubtype, onMapTap, onEditPreviewsChange]);

  // --- Expose tap handlers to parent via ref ---
  useImperativeHandle(ref, () => ({ onMapTap: handleMapTap, onMapLongPress }), [handleMapTap, onMapLongPress]);

  // --- Panel toggle handlers ---

  const handleRatingToggle = useCallback(() => {
    const opening = openPanel !== 'rating';
    setOpenPanel(opening ? 'rating' : null);
    setOpenSubPanel(null);
    if (opening) {
      selectTool('highlight_point', RATING_SUBTYPES[0].subtype as ToolSubtype);
    } else {
      selectTool(null);
      cancelTool();
    }
  }, [openPanel, selectTool, cancelTool]);

  const handleCorrectionToggle = useCallback(() => {
    const opening = openPanel !== 'correction';
    setOpenPanel(opening ? 'correction' : null);
    setOpenSubPanel(null);
    if (!opening) {
      selectTool(null);
      cancelTool();
    }
  }, [openPanel, selectTool, cancelTool]);

  const handleSubPanelToggle = useCallback((sub: CorrectionSubPanel) => {
    const opening = openSubPanel !== sub;
    setOpenSubPanel(opening ? sub : null);
    selectTool(null);
    cancelTool();
  }, [openSubPanel, selectTool, cancelTool]);

  // --- Confirm / cancel ---

  const handleConfirm = useCallback(() => {
    confirmTool();
  }, [confirmTool]);

  // Cancel clears the in-progress session but keeps the active tool selected
  // so the user can immediately start a new operation without re-selecting.
  const handleCancel = useCallback(() => {
    cancelTool();
  }, [cancelTool]);

  // Whether either sub-panel should show Confirm + Cancel.
  const needsConfirmCancel =
    activeTool === 'move_point' ||
    activeTool === 'add_node' ||
    activeTool === 'delete_point' ||
    activeTool === 'draw_segment' ||
    activeTool === 'merge_segments' ||
    activeTool === 'split_segment';

  if (!isDataRangerMode) return null;

  // Dynamic colours
  const panelBg = colorScheme === 'dark' ? 'rgba(30,30,35,0.92)' : 'rgba(255,255,255,0.92)';
  const activeColor = colors.buttonPrimary;
  const textColor = colors.text;
  const borderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Status hint bar */}
      {!!statusText && (
        <View style={[styles.statusBar, { backgroundColor: panelBg, borderColor }]}>
          <Text style={[styles.statusText, { color: textColor }]}>{statusText}</Text>
        </View>
      )}

      {/* Expanded panels sit to the left of the header buttons */}
      <View style={styles.row} pointerEvents="box-none">

        {/* ── Left: expanded content ── */}
        <View style={styles.expandedArea} pointerEvents="box-none">

          {/* Rating Panel expanded content */}
          {openPanel === 'rating' && (
            <View style={[styles.subPanel, { backgroundColor: panelBg, borderColor }]}>
              <Text style={[styles.subPanelTitle, { color: textColor }]}>Rate Feature</Text>
              <View style={styles.chipRow}>
                {RATING_SUBTYPES.map(({ label, subtype }) => (
                  <PillButton
                    key={subtype}
                    label={label}
                    active={activeTool === 'highlight_point' && activeSubtype === subtype}
                    activeColor={activeColor}
                    textColor={textColor}
                    borderColor={borderColor}
                    onPress={() => selectTool('highlight_point', subtype as ToolSubtype)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Correction Panel expanded content */}
          {openPanel === 'correction' && (
            <View style={styles.correctionColumn} pointerEvents="box-none">

              {/* Sub-panel A: Move/Add/Delete Points */}
              <View style={[styles.subPanel, { backgroundColor: panelBg, borderColor }]}>
                <Pressable onPress={() => handleSubPanelToggle('point_editor')}>
                  <Text style={[styles.subPanelTitle, { color: textColor }]}>
                    Move / Add / Delete Points
                    {openSubPanel === 'point_editor' ? '  ▲' : '  ▼'}
                  </Text>
                </Pressable>

                {openSubPanel === 'point_editor' && (
                  <>
                    {/* Tool row */}
                    <View style={styles.chipRow}>
                      <PillButton
                        label="Move Point"
                        active={activeTool === 'move_point'}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                        onPress={() => selectTool('move_point', null)}
                      />
                      <PillButton
                        label="Add Node"
                        active={activeTool === 'add_node'}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                        onPress={() => selectTool('add_node', ADD_NODE_SUBTYPES[0].subtype)}
                      />
                      <PillButton
                        label="Delete Point"
                        active={activeTool === 'delete_point'}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                        onPress={() => selectTool('delete_point', null)}
                      />
                    </View>

                    {/* Subtype selector: only shown when add_node is active */}
                    {activeTool === 'add_node' && (
                      <View style={styles.subtypeRow}>
                        {ADD_NODE_SUBTYPES.map(({ label, subtype }) => (
                          <PillButton
                            key={subtype}
                            label={label}
                            active={activeSubtype === subtype}
                            activeColor={activeColor}
                            textColor={textColor}
                            borderColor={borderColor}
                            onPress={() => setActiveSubtype(subtype)}
                          />
                        ))}
                      </View>
                    )}

                    {/* add_node: inline attributes + placement hint */}
                    {activeTool === 'add_node' && (
                      <View style={[styles.nodeAttrsBox, { borderColor }]}>
                        {activeSubtype === 'ramp' && (
                          <>
                            <TextInput
                              style={[styles.nodeAttrInput, { color: textColor, borderColor }]}
                              placeholder="Return location (e.g. SE corner)"
                              placeholderTextColor="#888"
                              value={nodeRampAttrs.returnloc}
                              onChangeText={v => setNodeRampAttrs(p => ({ ...p, returnloc: v }))}
                            />
                            <TextInput
                              style={[styles.nodeAttrInput, { color: textColor, borderColor }]}
                              placeholder="Return position (e.g. parallel)"
                              placeholderTextColor="#888"
                              value={nodeRampAttrs.returnposition}
                              onChangeText={v => setNodeRampAttrs(p => ({ ...p, returnposition: v }))}
                            />
                          </>
                        )}
                        {activeSubtype === 'calm' && (
                          <TextInput
                            style={[styles.nodeAttrInput, { color: textColor, borderColor }]}
                            placeholder="Calming subtype (e.g. speed_bump)"
                            placeholderTextColor="#888"
                            value={nodeCalmSubtype}
                            onChangeText={setNodeCalmSubtype}
                          />
                        )}
                        <Text style={[styles.nodePlacementHint, { color: textColor }]}>
                          {pendingNodeCoords ? '📍 Tap map to move point' : '📍 Tap map to place point'}
                        </Text>
                        {pendingNodeCoords && (
                          <ConfirmCancelRow
                            onConfirm={handleAddNodeConfirm}
                            onCancel={handleCancel}
                            activeColor={activeColor}
                            textColor={textColor}
                            borderColor={borderColor}
                          />
                        )}
                      </View>
                    )}

                    {needsConfirmCancel && (activeTool === 'move_point' || activeTool === 'delete_point') && (
                      <ConfirmCancelRow
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                      />
                    )}
                  </>
                )}
              </View>

              {/* Sub-panel B: Segment Corrector */}
              <View style={[styles.subPanel, { backgroundColor: panelBg, borderColor }]}>
                <Pressable onPress={() => handleSubPanelToggle('segment_corrector')}>
                  <Text style={[styles.subPanelTitle, { color: textColor }]}>
                    Segment Corrector
                    {openSubPanel === 'segment_corrector' ? '  ▲' : '  ▼'}
                  </Text>
                </Pressable>

                {openSubPanel === 'segment_corrector' && (
                  <>
                    {/* draw_segment */}
                    <View style={styles.chipRow}>
                      <PillButton
                        label="Draw Segment"
                        active={activeTool === 'draw_segment'}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                        onPress={() => selectTool('draw_segment', DRAW_SEGMENT_SUBTYPES[0])}
                      />
                      <PillButton
                        label="Merge Segments"
                        active={activeTool === 'merge_segments'}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                        onPress={() => selectTool('merge_segments', null)}
                      />
                      <PillButton
                        label="Split Segment"
                        active={activeTool === 'split_segment'}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                        onPress={() => selectTool('split_segment', null)}
                      />
                    </View>

                    {/* draw_segment: subtype selector + "Start Recording" */}
                    {activeTool === 'draw_segment' && (
                      <>
                        <View style={styles.subtypeRow}>
                          {DRAW_SEGMENT_SUBTYPES.map(subtype => (
                            <PillButton
                              key={subtype}
                              label={subtype.replace('_', ' ')}
                              active={activeSubtype === subtype}
                              activeColor={activeColor}
                              textColor={textColor}
                              borderColor={borderColor}
                              onPress={() => setActiveSubtype(subtype)}
                            />
                          ))}
                        </View>
                        {activeSubtype && (
                          <Pressable
                            style={[styles.startRecordingButton, { backgroundColor: activeColor }]}
                            onPress={() => {
                              const ft = drawSubtypeToFacilityType(activeSubtype as string);
                              onNewSegmentRequest?.(ft);
                            }}
                          >
                            <Text style={styles.startRecordingText}>▶ Set Attributes & Start Recording</Text>
                          </Pressable>
                        )}
                      </>
                    )}

                    {needsConfirmCancel && (
                      activeTool === 'merge_segments' ||
                      activeTool === 'split_segment'
                    ) && (
                      <ConfirmCancelRow
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        activeColor={activeColor}
                        textColor={textColor}
                        borderColor={borderColor}
                      />
                    )}
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Right: header buttons column ── */}
        <View style={styles.headerColumn}>
          <Pressable
            style={[
              styles.headerButton,
              { backgroundColor: openPanel === 'rating' ? activeColor : panelBg, borderColor },
            ]}
            onPress={handleRatingToggle}
          >
            <Text style={[styles.headerIcon, openPanel === 'rating' && styles.headerIconActive]}>
              ★
            </Text>
            <Text style={[styles.headerLabel, { color: openPanel === 'rating' ? '#fff' : textColor }]}>
              Rate
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.headerButton,
              { backgroundColor: openPanel === 'correction' ? activeColor : panelBg, borderColor },
            ]}
            onPress={handleCorrectionToggle}
          >
            <Text style={[styles.headerIcon, openPanel === 'correction' && styles.headerIconActive]}>
              ✎
            </Text>
            <Text style={[styles.headerLabel, { color: openPanel === 'correction' ? '#fff' : textColor }]}>
              Correct
            </Text>
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
      style={[
        styles.pill,
        { borderColor: active ? activeColor : borderColor },
        active && { backgroundColor: activeColor },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, { color: active ? '#fff' : textColor }]}>{label}</Text>
    </Pressable>
  );
}

interface ConfirmCancelRowProps {
  onConfirm: () => void;
  onCancel: () => void;
  activeColor: string;
  textColor: string;
  borderColor: string;
}

function ConfirmCancelRow({ onConfirm, onCancel, activeColor, textColor, borderColor }: ConfirmCancelRowProps) {
  return (
    <View style={styles.confirmRow}>
      <Pressable
        style={[styles.confirmButton, { backgroundColor: activeColor }]}
        onPress={onConfirm}
      >
        <Text style={styles.confirmButtonText}>Confirm</Text>
      </Pressable>
      <Pressable
        style={[styles.cancelButton, { borderColor }]}
        onPress={onCancel}
      >
        <Text style={[styles.cancelButtonText, { color: textColor }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,           // Above the trip footer
    left: 8,
    right: 8,
    zIndex: 200,
    alignItems: 'flex-end',
  },
  statusBar: {
    alignSelf: 'center',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 320,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Fonts?.mono ?? undefined,
    textAlign: 'center',
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
  headerColumn: {
    gap: 8,
  },
  headerButton: {
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
  headerIcon: {
    fontSize: 20,
    color: '#888',
  },
  headerIconActive: {
    color: '#fff',
  },
  headerLabel: {
    fontSize: 9,
    marginTop: 2,
    fontFamily: Fonts?.mono ?? undefined,
  },
  correctionColumn: {
    gap: 6,
    alignItems: 'flex-end',
    width: '100%',
  },
  subPanel: {
    borderRadius: 12,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  subPanelTitle: {
    fontSize: 11,
    fontFamily: Fonts?.mono ?? undefined,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subtypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
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
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts?.mono ?? undefined,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 12,
    fontFamily: Fonts?.mono ?? undefined,
  },
  startRecordingButton: {
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startRecordingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts?.mono ?? undefined,
  },
  nodeAttrsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  nodeAttrInput: {
    fontSize: 11,
    fontFamily: Fonts?.mono ?? undefined,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nodePlacementHint: {
    fontSize: 10,
    fontFamily: Fonts?.mono ?? undefined,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
});
