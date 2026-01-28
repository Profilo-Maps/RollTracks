import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { TourStep } from '../types/tour.types';
import { HighlightCutout } from './HighlightCutout';

/**
 * Props for the TourOverlay component
 */
export interface TourOverlayProps {
  /** Current tour step to display */
  step: TourStep;
  /** Zero-based index of current step */
  currentStep: number;
  /** Total number of steps in the tour */
  totalSteps: number;
  /** Handler for next button press */
  onNext: () => void;
  /** Handler for previous button press */
  onPrevious: () => void;
  /** Handler for dismiss button press */
  onDismiss: () => void;
  /** Handler for finish button press (last step) */
  onComplete: () => void;
}

/**
 * TourOverlay Component
 * 
 * Displays the tutorial tour overlay with backdrop, progress indicator,
 * navigation controls, and step content. Provides an accessible interface
 * for users to navigate through the onboarding tour.
 * 
 * Features:
 * - Semi-transparent backdrop
 * - Progress indicator showing current step / total steps
 * - Dismiss button to exit tour
 * - Back/Next navigation buttons
 * - Finish button on last step
 * - Step title and description
 * - Accessibility labels on all interactive elements
 */
export const TourOverlay: React.FC<TourOverlayProps> = ({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onDismiss,
  onComplete,
}) => {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Get position style based on step position
  const getPositionStyle = () => {
    switch (step.position) {
      case 'top':
        return styles.contentCardTop;
      case 'bottom':
        return styles.contentCardBottom;
      case 'center':
      default:
        return styles.contentCardCenter;
    }
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Semi-transparent backdrop */}
        <View style={styles.backdrop} />
        
        {/* Highlight cutout for target element */}
        <HighlightCutout elementId={step.highlightElement} />
        
        {/* Tour content card */}
        <View style={[styles.contentCard, getPositionStyle()]}>
          {/* Progress indicator and dismiss button */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText} accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}`}>
              {currentStep + 1} of {totalSteps}
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              accessibilityLabel="Dismiss tour"
              accessibilityRole="button"
              accessibilityHint="Closes the tutorial tour"
              style={styles.dismissButton}
            >
              <Text style={styles.dismissIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* Step content */}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          
          {/* Navigation controls */}
          <View style={styles.navigationContainer}>
            {!isFirstStep ? (
              <TouchableOpacity
                onPress={onPrevious}
                style={styles.navButton}
                accessibilityLabel="Previous step"
                accessibilityRole="button"
                accessibilityHint="Go back to the previous tour step"
              >
                <Text style={styles.navButtonIcon}>←</Text>
                <Text style={styles.navButtonText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.navButtonPlaceholder} />
            )}
            
            <View style={styles.spacer} />
            
            {isLastStep ? (
              <TouchableOpacity
                onPress={onComplete}
                style={[styles.navButton, styles.primaryButton]}
                accessibilityLabel="Finish tour"
                accessibilityRole="button"
                accessibilityHint="Complete the tutorial tour"
              >
                <Text style={styles.primaryButtonText}>Finish</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onNext}
                style={[styles.navButton, styles.primaryButton]}
                accessibilityLabel="Next step"
                accessibilityRole="button"
                accessibilityHint="Continue to the next tour step"
              >
                <Text style={styles.primaryButtonText}>Next</Text>
                <Text style={styles.primaryButtonIcon}>→</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1,
  },
  contentCardTop: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
  },
  contentCardBottom: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
  contentCardCenter: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    transform: [{ translateY: -150 }], // Approximate half of card height
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  dismissButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissIcon: {
    fontSize: 24,
    color: '#666666',
    fontWeight: '300',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    marginBottom: 24,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spacer: {
    flex: 1,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    minHeight: 44,
    gap: 8,
  },
  navButtonPlaceholder: {
    width: 80,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  navButtonIcon: {
    fontSize: 18,
    color: '#000000',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  primaryButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
