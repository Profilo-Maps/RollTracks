import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';

interface BoldnessSelectorProps {
  value: number | null;
  onChange: (boldness: number) => void;
  label?: string;
  onInfoPress?: () => void;
}

export const BoldnessSelector: React.FC<BoldnessSelectorProps> = ({
  value,
  onChange,
  label = 'Boldness',
  onInfoPress,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const boldnessOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const handleSelect = (boldness: number) => {
    onChange(boldness);
    setModalVisible(false);
  };

  const getDisplayText = () => {
    return value !== null ? value.toString() : 'Select boldness';
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label} accessibilityLabel={label}>
          {label}
        </Text>
        {onInfoPress && (
          <TouchableOpacity
            onPress={onInfoPress}
            style={styles.infoButton}
            accessibilityLabel="Boldness information"
            accessibilityHint="Tap to learn about boldness rating"
            accessibilityRole="button"
          >
            <Text style={styles.infoIcon}>ⓘ</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={`${label}: ${getDisplayText()}`}
        accessibilityHint="Tap to select boldness rating from 1 to 10"
        accessibilityRole="button"
      >
        <Text style={[styles.selectorText, value === null && styles.placeholder]}>
          {getDisplayText()}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Boldness (1-10)</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList}>
              {boldnessOptions.map((boldness) => {
                const isSelected = value === boldness;
                return (
                  <TouchableOpacity
                    key={boldness}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(boldness)}
                    accessibilityLabel={`Boldness ${boldness}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {boldness}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoButton: {
    marginLeft: 8,
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 18,
    color: '#007AFF',
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholder: {
    color: '#999',
  },
  arrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  optionsList: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 44,
  },
  optionSelected: {
    backgroundColor: '#f0f8ff',
  },
  optionText: {
    fontSize: 18,
    color: '#333',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
