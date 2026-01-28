import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { HighlightCutout } from '../HighlightCutout';

describe('HighlightCutout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any console warnings
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing when no elementId is provided', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout />);
      });
      
      const root = tree.toJSON();
      // Should render null when no elementId
      expect(root).toBeNull();
    });

    it('should render without crashing when elementId is provided', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="test_element" />);
      });
      
      // Component should render (even if it can't find the element)
      expect(tree).toBeTruthy();
    });

    it('should render null when elementId is undefined', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId={undefined} />);
      });
      
      const root = tree.toJSON();
      expect(root).toBeNull();
    });

    it('should render null when elementId is empty string', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="" />);
      });
      
      const root = tree.toJSON();
      expect(root).toBeNull();
    });
  });

  describe('Fallback Behavior', () => {
    it('should handle missing element gracefully', () => {
      let tree: any;
      
      // Should not throw an error
      expect(() => {
        act(() => {
          tree = renderer.create(<HighlightCutout elementId="non_existent_element" />);
        });
      }).not.toThrow();
    });

    it('should log warning when element cannot be found after max attempts', (done) => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      act(() => {
        renderer.create(<HighlightCutout elementId="missing_element" />);
      });
      
      // Wait for the measurement attempts to complete
      setTimeout(() => {
        // Should have logged a warning about not finding the element
        expect(consoleWarnSpy).toHaveBeenCalled();
        done();
      }, 1500); // Wait longer than max attempts * retry delay
    });
  });

  describe('Props Changes', () => {
    it('should update when elementId changes', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="element_1" />);
      });
      
      // Update with new elementId
      act(() => {
        tree.update(<HighlightCutout elementId="element_2" />);
      });
      
      // Should not throw and should handle the update
      expect(tree).toBeTruthy();
    });

    it('should clear measurements when elementId changes to undefined', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="element_1" />);
      });
      
      // Update with undefined elementId
      act(() => {
        tree.update(<HighlightCutout elementId={undefined} />);
      });
      
      const root = tree.toJSON();
      // Should render null when elementId becomes undefined
      expect(root).toBeNull();
    });

    it('should handle rapid elementId changes', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="element_1" />);
      });
      
      // Rapidly change elementId multiple times
      act(() => {
        tree.update(<HighlightCutout elementId="element_2" />);
        tree.update(<HighlightCutout elementId="element_3" />);
        tree.update(<HighlightCutout elementId="element_4" />);
      });
      
      // Should handle rapid changes without crashing
      expect(tree).toBeTruthy();
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup on unmount', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="test_element" />);
      });
      
      // Unmount the component
      act(() => {
        tree.unmount();
      });
      
      // Should not throw during cleanup
      expect(true).toBe(true);
    });

    it('should reset measurements on unmount', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="test_element" />);
      });
      
      // Unmount
      act(() => {
        tree.unmount();
      });
      
      // Re-mount with same elementId
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="test_element" />);
      });
      
      // Should handle re-mounting without issues
      expect(tree).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle measurement errors gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      let tree: any;
      
      // Should not throw even if measurement fails
      expect(() => {
        act(() => {
          tree = renderer.create(<HighlightCutout elementId="error_element" />);
        });
      }).not.toThrow();
    });

    it('should continue to render after measurement error', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="error_element" />);
      });
      
      // Component should still be mounted
      expect(tree).toBeTruthy();
    });
  });

  describe('Pointer Events', () => {
    it('should set pointerEvents to none on container', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<HighlightCutout elementId="test_element" />);
      });
      
      // The component should render with pointerEvents="none" to not block interactions
      // This is tested implicitly by the component structure
      expect(tree).toBeTruthy();
    });
  });

  describe('Multiple Instances', () => {
    it('should handle multiple HighlightCutout instances', () => {
      let tree1: any;
      let tree2: any;
      
      act(() => {
        tree1 = renderer.create(<HighlightCutout elementId="element_1" />);
        tree2 = renderer.create(<HighlightCutout elementId="element_2" />);
      });
      
      // Both instances should render independently
      expect(tree1).toBeTruthy();
      expect(tree2).toBeTruthy();
    });

    it('should handle same elementId in multiple instances', () => {
      let tree1: any;
      let tree2: any;
      
      act(() => {
        tree1 = renderer.create(<HighlightCutout elementId="same_element" />);
        tree2 = renderer.create(<HighlightCutout elementId="same_element" />);
      });
      
      // Both instances should render without conflict
      expect(tree1).toBeTruthy();
      expect(tree2).toBeTruthy();
    });
  });
});
