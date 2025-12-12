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
import { Mode } from '../types';

interface ModeSelectorProps {
  selectedModes: Mode[];
  onSelectionChange: (modes: Mode[]) => void;
  label?: string;
  multiSelect?: boolean;
  availableModes?: Mode[];
}

const MODE_LABELS: Record<Mode, string> = {
  wheelchair: 'Wheelchair',
  assisted_walking: 'Assisted Walking',
  skateboard: 'Skateboard',
  scooter: 'Scooter',
  walking: 'Walking',
};

const ALL_MODES: Mode[] = ['wheelchair', 'assisted_walking', 'skateboard', 'scooter', 'walking'];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedModes,
  onSelectionChange,
  label = 'Select Mode(s)',
  multiSelect = true,
  availableModes,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  
  // Use availableModes if provided, otherwise use all modes
  const modesToDisplay = availableModes || ALL_MODES;

  const toggleMode = (mode: Mode) => {
    if (multiSelect) {
      if (selectedModes.includes(mode)) {
        // Remove mode
        const newModes = selectedModes.filter(m => m !== mode);
        onSelectionChange(newModes);
      } else {
        // Add mode
        onSelectionChange([...selectedModes, mode]);
      }
    } else {
      // Single select
      onSelectionChange([mode]);
      setModalVisible(false);
    }
  };

  const getDisplayText = () => {
    if (selectedModes.length === 0) {
      return 'None selected';
    }
    if (selectedModes.length === 1) {
      return MODE_LABELS[selectedModes[0]];
    }
    return `${selectedModes.length} modes selected`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityLabel={label}>
        {label}
      </Text>
      
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={`${label}: ${getDisplayText()}`}
        accessibilityHint="Tap to select transportation modes"
        accessibilityRole="button"
      >
        <Text style={styles.selectorText}>{getDisplayText()}</Text>
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
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList}>
              {modesToDisplay.map((mode) => {
                const isSelected = selectedModes.includes(mode);
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => toggleMode(mode)}
                    accessibilityLabel={MODE_LABELS[mode]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={styles.checkbox}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {MODE_LABELS[mode]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {multiSelect && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Done"
                accessibilityRole="button"
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
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
    maxHeight: '80%',
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
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 44,
  },
  optionSelected: {
    backgroundColor: '#f0f8ff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
