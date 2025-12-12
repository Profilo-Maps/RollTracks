import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';

interface BoldnessInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BoldnessInfoModal: React.FC<BoldnessInfoModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>What is Boldness?</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll}>
            <Text style={styles.contentText}>
              Boldness is a rating from 1 to 10 that measures how adventurous or challenging your trip was.
            </Text>
            
            <Text style={styles.sectionTitle}>Rating Guide:</Text>
            
            <View style={styles.ratingItem}>
              <Text style={styles.ratingNumber}>1-3:</Text>
              <Text style={styles.ratingDescription}>
                Easy, familiar routes with minimal challenges
              </Text>
            </View>

            <View style={styles.ratingItem}>
              <Text style={styles.ratingNumber}>4-6:</Text>
              <Text style={styles.ratingDescription}>
                Moderate difficulty with some new terrain or obstacles
              </Text>
            </View>

            <View style={styles.ratingItem}>
              <Text style={styles.ratingNumber}>7-9:</Text>
              <Text style={styles.ratingDescription}>
                Challenging routes with significant obstacles or unfamiliar areas
              </Text>
            </View>

            <View style={styles.ratingItem}>
              <Text style={styles.ratingNumber}>10:</Text>
              <Text style={styles.ratingDescription}>
                Extremely adventurous, pushing your limits
              </Text>
            </View>

            <Text style={styles.footerText}>
              Rate your trip based on how bold or adventurous it felt to you personally.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.okButton}
            onPress={onClose}
            accessibilityLabel="OK"
            accessibilityRole="button"
          >
            <Text style={styles.okButtonText}>Got it!</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  contentScroll: {
    padding: 20,
  },
  contentText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 12,
  },
  ratingItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    width: 50,
  },
  ratingDescription: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    lineHeight: 22,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 20,
  },
  okButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
