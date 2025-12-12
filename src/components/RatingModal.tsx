import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { RatingModalProps } from '../types';

export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  initialRating,
  onSubmit,
  onCancel,
}) => {
  const [rating, setRating] = useState(initialRating || 5);

  // Update rating when initialRating changes
  useEffect(() => {
    if (initialRating !== undefined) {
      setRating(initialRating);
    }
  }, [initialRating]);

  const handleSubmit = () => {
    onSubmit(Math.round(rating));
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Accessibility Rating</Text>
          
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingValue}>{Math.round(rating)}</Text>
            <Text style={styles.ratingLabel}>out of 10</Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={rating}
            onValueChange={setRating}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#E5E5EA"
            thumbTintColor="#007AFF"
            accessibilityLabel="Accessibility rating slider"
            accessibilityHint="Slide to select a rating from 1 to 10"
            accessibilityValue={{
              min: 1,
              max: 10,
              now: Math.round(rating),
              text: `${Math.round(rating)} out of 10`,
            }}
          />

          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabel}>1 - Poor</Text>
            <Text style={styles.scaleLabel}>10 - Excellent</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              accessibilityLabel="Cancel rating"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              accessibilityLabel="Submit rating"
              accessibilityRole="button"
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#007AFF',
  },
  ratingLabel: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 8,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  scaleLabel: {
    fontSize: 12,
    color: '#666666',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
