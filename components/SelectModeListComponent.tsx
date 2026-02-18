import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

const MODES = [
  'Wheelchair',
  'Skateboard',
  'Assisted Walking',
  'Walking',
  'Scooter',
] as const;

interface SelectModeListProps {
  selected: string[];
  onChange: (modes: string[]) => void;
}

export default function SelectModeListComponent({
  selected,
  onChange,
}: SelectModeListProps) {
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  const toggleMode = (mode: string) => {
    if (selected.includes(mode)) {
      onChange(selected.filter((m) => m !== mode));
    } else {
      onChange([...selected, mode]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {MODES.map((mode) => {
        const isSelected = selected.includes(mode);
        return (
          <TouchableOpacity
            key={mode}
            style={[
              styles.chip,
              { borderColor: isSelected ? tintColor : iconColor },
              isSelected && { backgroundColor: tintColor },
            ]}
            onPress={() => toggleMode(mode)}
            activeOpacity={0.7}
          >
            <ThemedText
              style={styles.chipText}
              lightColor={isSelected ? '#fff' : undefined}
              darkColor={isSelected ? '#000' : undefined}
            >
              {mode}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
});
