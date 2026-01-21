import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TourOverlay } from '../TourOverlay';
import { TourStep } from '../../types/tour.types';
import { Text, TouchableOpacity } from 'react-native';

describe('TourOverlay Component', () => {
  const mockStep: TourStep = {
    id: 'test_step',
    screen: 'Home',
    title: 'Welcome to the App',
    description: 'This is a test description for the tour step.',
    position: 'center',
  };

  const defaultProps = {
    step: mockStep,
    currentStep: 0,
    totalSteps: 5,
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onDismiss: jest.fn(),
    onComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to find text in component tree
  const findTextInTree = (tree: any, text: string): boolean => {
    if (!tree) return false;
    
    // Check if this is a Text component with matching children
    if (tree.type === 'Text') {
      if (Array.isArray(tree.children)) {
        const textContent = tree.children.join('');
        if (textContent.includes(text)) return true;
      } else if (typeof tree.children === 'string' && tree.children.includes(text)) {
        return true;
      }
    }
    
    // Recursively check children
    if (Array.isArray(tree.children)) {
      return tree.children.some((child: any) => findTextInTree(child, text));
    } else if (tree.children) {
      return findTextInTree(tree.children, text);
    }
    
    return false;
  };

  // Helper function to find element by accessibility label
  const findByAccessibilityLabel = (tree: any, label: string): any => {
    if (!tree) return null;
    if (tree.props && tree.props.accessibilityLabel === label) {
      return tree;
    }
    if (tree.children) {
      for (const child of tree.children) {
        const found = findByAccessibilityLabel(child, label);
        if (found) return found;
      }
    }
    return null;
  };

  describe('Basic Rendering', () => {
    it('should render the tour overlay with step content', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} />);
      });
      
      const root = tree.toJSON();
      expect(findTextInTree(root, 'Welcome to the App')).toBe(true);
      expect(findTextInTree(root, 'This is a test description for the tour step.')).toBe(true);
    });

    it('should display progress indicator with current step and total steps', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} />);
      });
      
      const root = tree.toJSON();
      expect(findTextInTree(root, '1 of 5')).toBe(true);
    });

    it('should render dismiss button', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} />);
      });
      
      const root = tree.toJSON();
      const dismissButton = findByAccessibilityLabel(root, 'Dismiss tour');
      expect(dismissButton).toBeTruthy();
    });
  });

  describe('Navigation Controls - First Step', () => {
    it('should not show back button on first step', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={0} />);
      });
      
      const root = tree.toJSON();
      const backButton = findByAccessibilityLabel(root, 'Previous step');
      expect(backButton).toBeNull();
    });

    it('should show next button on first step', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={0} />);
      });
      
      const root = tree.toJSON();
      const nextButton = findByAccessibilityLabel(root, 'Next step');
      expect(nextButton).toBeTruthy();
    });

    it('should call onNext when next button is pressed on first step', () => {
      let component: any;
      act(() => {
        component = renderer.create(<TourOverlay {...defaultProps} currentStep={0} />);
      });
      
      const root = component.root;
      const nextButton = root.findAll((node: any) => 
        node.props && node.props.accessibilityLabel === 'Next step'
      )[0];
      
      act(() => {
        nextButton.props.onPress();
      });
      
      expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation Controls - Middle Step', () => {
    it('should show both back and next buttons on middle step', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={2} />);
      });
      
      const root = tree.toJSON();
      const backButton = findByAccessibilityLabel(root, 'Previous step');
      const nextButton = findByAccessibilityLabel(root, 'Next step');
      
      expect(backButton).toBeTruthy();
      expect(nextButton).toBeTruthy();
    });

    it('should call onPrevious when back button is pressed', () => {
      let component: any;
      act(() => {
        component = renderer.create(<TourOverlay {...defaultProps} currentStep={2} />);
      });
      
      const root = component.root;
      const backButton = root.findAll((node: any) => 
        node.props && node.props.accessibilityLabel === 'Previous step'
      )[0];
      
      act(() => {
        backButton.props.onPress();
      });
      
      expect(defaultProps.onPrevious).toHaveBeenCalledTimes(1);
    });

    it('should call onNext when next button is pressed on middle step', () => {
      let component: any;
      act(() => {
        component = renderer.create(<TourOverlay {...defaultProps} currentStep={2} />);
      });
      
      const root = component.root;
      const nextButton = root.findAll((node: any) => 
        node.props && node.props.accessibilityLabel === 'Next step'
      )[0];
      
      act(() => {
        nextButton.props.onPress();
      });
      
      expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation Controls - Last Step', () => {
    it('should show back button on last step', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={4} totalSteps={5} />);
      });
      
      const root = tree.toJSON();
      const backButton = findByAccessibilityLabel(root, 'Previous step');
      expect(backButton).toBeTruthy();
    });

    it('should show finish button instead of next button on last step', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={4} totalSteps={5} />);
      });
      
      const root = tree.toJSON();
      const finishButton = findByAccessibilityLabel(root, 'Finish tour');
      const nextButton = findByAccessibilityLabel(root, 'Next step');
      
      expect(finishButton).toBeTruthy();
      expect(nextButton).toBeNull();
    });

    it('should call onComplete when finish button is pressed', () => {
      let component: any;
      act(() => {
        component = renderer.create(<TourOverlay {...defaultProps} currentStep={4} totalSteps={5} />);
      });
      
      const root = component.root;
      const finishButton = root.findAll((node: any) => 
        node.props && node.props.accessibilityLabel === 'Finish tour'
      )[0];
      
      act(() => {
        finishButton.props.onPress();
      });
      
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dismiss Functionality', () => {
    it('should call onDismiss when dismiss button is pressed', () => {
      let component: any;
      act(() => {
        component = renderer.create(<TourOverlay {...defaultProps} />);
      });
      
      const root = component.root;
      const dismissButton = root.findAll((node: any) => 
        node.props && node.props.accessibilityLabel === 'Dismiss tour'
      )[0];
      
      act(() => {
        dismissButton.props.onPress();
      });
      
      expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility labels on all interactive elements', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={2} />);
      });
      
      const root = tree.toJSON();
      expect(findByAccessibilityLabel(root, 'Dismiss tour')).toBeTruthy();
      expect(findByAccessibilityLabel(root, 'Previous step')).toBeTruthy();
      expect(findByAccessibilityLabel(root, 'Next step')).toBeTruthy();
    });

    it('should have accessibility label on finish button', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={4} totalSteps={5} />);
      });
      
      const root = tree.toJSON();
      expect(findByAccessibilityLabel(root, 'Finish tour')).toBeTruthy();
    });

    it('should have accessibility role on buttons', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={2} />);
      });
      
      const root = tree.toJSON();
      const dismissButton = findByAccessibilityLabel(root, 'Dismiss tour');
      const backButton = findByAccessibilityLabel(root, 'Previous step');
      const nextButton = findByAccessibilityLabel(root, 'Next step');
      
      expect(dismissButton.props.accessibilityRole).toBe('button');
      expect(backButton.props.accessibilityRole).toBe('button');
      expect(nextButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Step Positioning', () => {
    it('should apply top position style when step position is top', () => {
      const topStep: TourStep = { ...mockStep, position: 'top' };
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} step={topStep} />);
      });
      
      const root = tree.toJSON();
      expect(findTextInTree(root, 'Welcome to the App')).toBe(true);
    });

    it('should apply bottom position style when step position is bottom', () => {
      const bottomStep: TourStep = { ...mockStep, position: 'bottom' };
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} step={bottomStep} />);
      });
      
      const root = tree.toJSON();
      expect(findTextInTree(root, 'Welcome to the App')).toBe(true);
    });

    it('should apply center position style when step position is center', () => {
      const centerStep: TourStep = { ...mockStep, position: 'center' };
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} step={centerStep} />);
      });
      
      const root = tree.toJSON();
      expect(findTextInTree(root, 'Welcome to the App')).toBe(true);
    });
  });

  describe('Progress Indicator', () => {
    it('should display correct progress for different steps', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<TourOverlay {...defaultProps} currentStep={0} totalSteps={5} />);
      });
      
      let root = tree.toJSON();
      expect(findTextInTree(root, '1 of 5')).toBe(true);
      
      act(() => {
        tree.update(<TourOverlay {...defaultProps} currentStep={2} totalSteps={5} />);
      });
      root = tree.toJSON();
      expect(findTextInTree(root, '3 of 5')).toBe(true);
      
      act(() => {
        tree.update(<TourOverlay {...defaultProps} currentStep={4} totalSteps={5} />);
      });
      root = tree.toJSON();
      expect(findTextInTree(root, '5 of 5')).toBe(true);
    });
  });
});
