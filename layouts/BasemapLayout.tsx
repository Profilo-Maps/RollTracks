/**
 * BasemapLayout: Default layout for map-based screens
 * 
 * Provides a persistent MapViewComponent as full-screen background with overlay slots:
 * - Header slot at top (respects safe area)
 * - Body slot in middle (fills available space)
 * - Secondary footer slot above footer
 * - Footer slot at bottom (respects safe area)
 * 
 * All slots are transparent by default to show map through.
 */

import { MapViewComponent, MapViewComponentProps, MapViewComponentRef } from '@/components/MapViewComponent';
import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Props interface for BasemapLayout component
 * Extends MapViewComponentProps to accept all map configuration props
 * Adds optional ReactNode slots for screen-specific content
 */
export interface BasemapLayoutProps extends MapViewComponentProps {
  /** Optional content for header slot (top of screen, respects safe area) */
  header?: React.ReactNode;
  
  /** Optional content for body slot (middle, fills available space) */
  body?: React.ReactNode;
  
  /** Optional content for secondary footer slot (above footer) */
  secondaryFooter?: React.ReactNode;
  
  /** Optional content for footer slot (bottom of screen, respects safe area) */
  footer?: React.ReactNode;
}

/**
 * BasemapLayout Component
 *
 * Wraps MapViewComponent with overlay slots for screen-specific content.
 * Uses absolute positioning to layer content over the map background.
 * Forwards ref to MapViewComponent for imperative methods (e.g., recenter).
 *
 * @param props - BasemapLayoutProps including map config and slot content
 * @param ref - Ref to forward to MapViewComponent
 * @returns React component with map background and overlay slots
 */
export const BasemapLayout = forwardRef<MapViewComponentRef, BasemapLayoutProps>(
  (props, ref) => {
    // Destructure slot props from MapViewComponent props
    const {
      header,
      body,
      secondaryFooter,
      footer,
      ...mapViewProps
    } = props;

    return (
      <View style={styles.container}>
        {/* Map background layer - full screen */}
        <View style={styles.mapBackground}>
          <MapViewComponent ref={ref} {...mapViewProps} />
        </View>

        {/* Overlay container for slots */}
        <View style={styles.overlayContainer}>
          {/* Header slot - top of screen */}
          {header && (
            <View style={styles.headerSlot}>
              {header}
            </View>
          )}

          {/* Body slot - fills remaining space (always rendered to push footer down) */}
          <View style={styles.bodySlot}>
            {body}
          </View>

          {/* Secondary footer slot - above footer */}
          {secondaryFooter && (
            <View style={styles.secondaryFooterSlot}>
              {secondaryFooter}
            </View>
          )}

          {/* Footer slot - bottom of screen */}
          {footer && (
            <View style={styles.footerSlot}>
              {footer}
            </View>
          )}
        </View>
      </View>
    );
  }
);

// Add display name for debugging
BasemapLayout.displayName = 'BasemapLayout';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  headerSlot: {
    width: '100%',
    // No background color - transparent by default
  },
  bodySlot: {
    flex: 1,
    width: '100%',
    // No background color - transparent by default
  },
  secondaryFooterSlot: {
    width: '100%',
    // No background color - transparent by default
  },
  footerSlot: {
    width: '100%',
    // No background color - transparent by default
  },
});

// Export the component as default for convenience
export default BasemapLayout;

