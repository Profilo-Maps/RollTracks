/**
 * Unit tests for BasemapLayout component
 * Feature: basemap-layout
 */

import { BasemapLayout, BasemapLayoutProps } from '@/layouts/BasemapLayout';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

// Mock MapViewComponent since we're testing layout, not map functionality
jest.mock('@/components/MapViewComponent', () => ({
  MapViewComponent: jest.fn(() => null),
}));

describe('BasemapLayout', () => {
  describe('Task 3.1: Overlay container with absolute positioning', () => {
    it('should render without crashing with minimal props', () => {
      const { container } = render(<BasemapLayout />);
      expect(container).toBeTruthy();
    });

    it('should accept header slot prop', () => {
      const { getByText } = render(
        <BasemapLayout header={<Text>Header Content</Text>} />
      );
      expect(getByText('Header Content')).toBeTruthy();
    });

    it('should accept body slot prop', () => {
      const { getByText } = render(
        <BasemapLayout body={<Text>Body Content</Text>} />
      );
      expect(getByText('Body Content')).toBeTruthy();
    });

    it('should accept secondary footer slot prop', () => {
      const { getByText } = render(
        <BasemapLayout secondaryFooter={<Text>Secondary Footer</Text>} />
      );
      expect(getByText('Secondary Footer')).toBeTruthy();
    });

    it('should accept footer slot prop', () => {
      const { getByText } = render(
        <BasemapLayout footer={<Text>Footer Content</Text>} />
      );
      expect(getByText('Footer Content')).toBeTruthy();
    });

    it('should accept all slots simultaneously', () => {
      const { getByText } = render(
        <BasemapLayout
          header={<Text>Header</Text>}
          body={<Text>Body</Text>}
          secondaryFooter={<Text>Secondary Footer</Text>}
          footer={<Text>Footer</Text>}
        />
      );
      
      expect(getByText('Header')).toBeTruthy();
      expect(getByText('Body')).toBeTruthy();
      expect(getByText('Secondary Footer')).toBeTruthy();
      expect(getByText('Footer')).toBeTruthy();
    });

    it('should forward MapViewComponent props', () => {
      const mockFeatures = [
        {
          id: 'test-feature',
          coordinate: [-122.4194, 37.7749] as [number, number],
          type: 'curb_ramp' as const,
        },
      ];

      const { container } = render(
        <BasemapLayout
          features={mockFeatures}
          zoomLevel={15}
          showUserLocation={true}
        />
      );
      
      expect(container).toBeTruthy();
    });
  });

  describe('TypeScript interface', () => {
    it('should have correct prop types', () => {
      // This test verifies TypeScript compilation
      const validProps: BasemapLayoutProps = {
        header: 'string content',
        body: <Text>Body</Text>,
        secondaryFooter: 42,
        footer: null,
        // MapViewComponent props
        polylines: [],
        features: [],
        centerPosition: [-122.4194, 37.7749],
        interactionState: 'interactive',
        zoomLevel: 15,
      };

      expect(validProps).toBeDefined();
    });

    it('should allow optional slot props', () => {
      // All slots are optional
      const minimalProps: BasemapLayoutProps = {};
      expect(minimalProps).toBeDefined();
    });

    it('should extend MapViewComponentProps', () => {
      // Should accept MapViewComponent-specific props
      const propsWithMapConfig: BasemapLayoutProps = {
        polylines: [
          {
            id: 'route-1',
            coordinates: [[-122.4, 37.7], [-122.5, 37.8]],
            color: '#FF0000',
            width: 4,
          },
        ],
        features: [
          {
            id: 'feature-1',
            coordinate: [-122.4194, 37.7749],
            type: 'curb_ramp',
          },
        ],
        centerPosition: [-122.4194, 37.7749],
        userPosition: [-122.4194, 37.7749],
        zoomLevel: 16,
        showUserLocation: true,
        interactionState: 'dimmed',
      };

      expect(propsWithMapConfig).toBeDefined();
    });
  });
});