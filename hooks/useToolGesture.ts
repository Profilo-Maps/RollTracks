/**
 * useToolGesture.ts
 * Converts React Native touch/press events from @rnmapbox/maps into MapTapEvent
 * objects and calls handleToolTap() / handleToolFinish() from @proximity/shared.
 * Manages ToolSessionState across taps. Owns edit-preview state and exposes it
 * for the caller to render a preview ShapeSource.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  handleToolTap,
  handleToolFinish,
  createToolSession,
  TOOL_STATUS,
  type ToolId,
  type ToolSubtype,
  type MapTapEvent,
  type MapAdapter,
  type ToolCallbacks,
  type ToolSessionState,
  type Geometry,
} from '@proximity/shared';

// Re-export tool identifier types so consumers (e.g. DataRangerToolPanels) can
// import them from this module without depending on @proximity/shared directly.
export type { ToolId, ToolSubtype };

// --- SourceMutation (mirrors the union in @proximity/shared) ---
// Defined locally so it can be used in the options interface. Callers may also
// import it from @proximity/shared; the shapes are identical.
import type { Feature } from 'geojson';

export type SourceMutation =
  | { type: 'delete'; matchId: string; matchKey: '_node_id' | '_seg_id' | '_fid' }
  | { type: 'add'; feature: Feature }
  | { type: 'updateCoords'; matchId: string; matchKey: '_seg_id' | '_fid'; vertexIndex: number; coords: [number, number] };

// --- EditPreviewFeature ---

export interface EditPreviewFeature {
  geometry: Geometry;
  editType: string;
  props?: Record<string, unknown>;
}

// --- Hook options ---

export interface UseToolGestureOptions {
  adapter: MapAdapter;
  activeTool: ToolId | null;
  subtype?: ToolSubtype | null;
  /** Called whenever the shared tool logic updates the status message. */
  onStatusChange?: (text: string) => void;
  /** Called whenever the selected feature ID changes (null to deselect). */
  onSelectedFeatureChange?: (id: string | null) => void;
  /** Called when the tool logic mutates a GeoJSON source layer. */
  onSourceMutation?: (mutation: SourceMutation) => void;
  /**
   * Called with a functional updater whenever edit previews should change.
   * Mirrors the React setState(prev => next) pattern so callers can keep their
   * own state if they need it; the hook also maintains its own copy for the
   * returned `editPreviews` array.
   */
  onEditPreviewsChange?: (updater: (prev: EditPreviewFeature[]) => EditPreviewFeature[]) => void;
  /**
   * Called for every recorded edit. `type` is a snake_case changeset type name;
   * `data` is the edit payload forwarded to DataRangerService.
   */
  onChangeset?: (type: string, data: unknown) => void;
}

// --- Hook return type ---

export interface UseToolGestureReturn {
  /** Handle a map tap event (from @rnmapbox/maps onPress). */
  onMapTap: (coords: { longitude: number; latitude: number }) => void;
  /** Handle long press for move_point drag initiation. */
  onMapLongPress: (coords: { longitude: number; latitude: number }) => void;
  /** Finalize a multi-tap tool (replaces Enter key / double-click). */
  confirmTool: () => void;
  /** Cancel the current tool operation and reset session + previews. */
  cancelTool: () => void;
  /** Current tool status text (falls back to TOOL_STATUS default for the active tool). */
  statusText: string;
  /** Current session state for UI display of in-progress operations. */
  session: ToolSessionState;
  /** Live edit-preview features; render these in a Mapbox ShapeSource overlay. */
  editPreviews: EditPreviewFeature[];
}

/**
 * Hook that bridges RN Mapbox touch events to @proximity/shared tool logic.
 *
 * Usage:
 * ```tsx
 * const { onMapTap, onMapLongPress, confirmTool, cancelTool, statusText, editPreviews } =
 *   useToolGesture({
 *     adapter: rnMapboxAdapter,
 *     activeTool: 'move_point',
 *     subtype: 'move',
 *     onStatusChange: setText,
 *     onChangeset: (type, data) => DataRangerService.record(type, data),
 *   });
 * ```
 */
export function useToolGesture({
  adapter,
  activeTool,
  subtype,
  onStatusChange,
  onSelectedFeatureChange,
  onSourceMutation,
  onEditPreviewsChange,
  onChangeset,
}: UseToolGestureOptions): UseToolGestureReturn {
  const sessionRef = useRef<ToolSessionState>(createToolSession());
  const [statusText, setStatusText] = useState('');
  const [editPreviews, setEditPreviews] = useState<EditPreviewFeature[]>([]);

  // Stable helper: apply an updater to both internal state and the caller's
  // optional external state setter.
  const applyPreviewUpdater = useCallback(
    (updater: (prev: EditPreviewFeature[]) => EditPreviewFeature[]) => {
      setEditPreviews(updater);
      onEditPreviewsChange?.(updater);
    },
    [onEditPreviewsChange],
  );

  // Build the ToolCallbacks object that @proximity/shared expects.
  // Recreated only when the option callbacks change.
  const callbacks: ToolCallbacks = useMemo(
    () => ({
      // --- UI state ---
      setStatusText(text: string): void {
        setStatusText(text);
        onStatusChange?.(text);
      },

      setSelectedFeatureId(id: string | null): void {
        onSelectedFeatureChange?.(id);
      },

      // --- Edit previews ---
      addEditPreview(geometry: Geometry, editType: string, props?: Record<string, unknown>): void {
        applyPreviewUpdater(prev => [...prev, { geometry, editType, props }]);
      },

      replaceEditPreviews(
        filter: (et: string) => boolean,
        newFeature: { geometry: Geometry; editType: string } | null,
      ): void {
        applyPreviewUpdater(prev => {
          const kept = prev.filter(f => !filter(f.editType));
          return newFeature ? [...kept, { geometry: newFeature.geometry, editType: newFeature.editType }] : kept;
        });
      },

      // --- Source mutations ---
      mutateSource(mutation: SourceMutation): void {
        onSourceMutation?.(mutation);
      },

      // --- Changeset recording ---
      recordAddedNode(edit: { x: number; y: number }): void {
        onChangeset?.('added_node', edit);
      },

      recordMovedEndpoint(edit: {
        node_id: string;
        new_x: number;
        new_y: number;
        rubber_band_segments: string[];
      }): void {
        onChangeset?.('moved_endpoint', edit);
      },

      recordDrawnCrosswalk(edit: {
        ramp_a: { segment_id: string; side: string; position: string; index: number };
        ramp_b: { segment_id: string; side: string; position: string; index: number };
      }): void {
        onChangeset?.('drawn_crosswalk', edit);
      },

      recordEditedHull(edit: {
        node_id: string;
        geometry: { type: 'Polygon'; coordinates: [number, number][][] };
      }): void {
        onChangeset?.('edited_hull', edit);
      },

      recordDeletedPoint(edit: { node_id: string; x: number; y: number }): void {
        onChangeset?.('deleted_point', edit);
      },

      recordDeletedHull(edit: { node_id: string }): void {
        onChangeset?.('deleted_hull', edit);
      },

      recordMergedSegments(edit: {
        surviving_seg_id: string;
        consumed_seg_id: string;
        shared_node_id: string;
      }): void {
        onChangeset?.('merged_segments', edit);
      },

      recordDrawnSegment(edit: { coordinates: [number, number][] }): void {
        onChangeset?.('drawn_segment', edit);
      },
    }),
    // Stable references: state setters from useState never change; option
    // callbacks are the only real dependencies.
    [onStatusChange, onSelectedFeatureChange, onSourceMutation, applyPreviewUpdater, onChangeset],
  );

  // --- Event handlers ---

  const onMapTap = useCallback(
    (coords: { longitude: number; latitude: number }) => {
      if (!activeTool) return;
      const tap: MapTapEvent = { lng: coords.longitude, lat: coords.latitude };
      handleToolTap(activeTool, tap, adapter, callbacks, sessionRef.current, subtype ?? undefined);
    },
    [activeTool, adapter, subtype, callbacks],
  );

  const onMapLongPress = useCallback(
    (coords: { longitude: number; latitude: number }) => {
      if (activeTool !== 'move_point') return;
      const tap: MapTapEvent = { lng: coords.longitude, lat: coords.latitude };
      // Long-press for move_point re-uses the shared tap handler for first-tap selection.
      handleToolTap(activeTool, tap, adapter, callbacks, sessionRef.current, subtype ?? undefined);
    },
    [activeTool, adapter, subtype, callbacks],
  );

  const confirmTool = useCallback((): void => {
    if (!activeTool) return;
    const consumed = handleToolFinish(activeTool, callbacks, sessionRef.current, subtype ?? undefined);
    if (consumed) {
      sessionRef.current = createToolSession();
    }
  }, [activeTool, subtype, callbacks]);

  const cancelTool = useCallback((): void => {
    sessionRef.current = createToolSession();
    callbacks.setStatusText('');
    callbacks.setSelectedFeatureId(null);
    // Clear all previews.
    applyPreviewUpdater(() => []);
  }, [callbacks, applyPreviewUpdater]);

  return {
    onMapTap,
    onMapLongPress,
    confirmTool,
    cancelTool,
    statusText: activeTool ? (statusText || TOOL_STATUS[activeTool] || '') : '',
    session: sessionRef.current,
    editPreviews,
  };
}
