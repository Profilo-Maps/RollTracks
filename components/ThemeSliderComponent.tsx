import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type ThemeOption = 'light' | 'auto' | 'dark';

interface ThemeSliderComponentProps {
  value: ThemeOption;
  onChange: (value: ThemeOption) => void;
}

/**
 * ThemeSliderComponent
 * 
 * A 3-way slider for selecting theme preference: Light, Auto, or Dark.
 * Provides clear visual feedback with proper contrast in both light and dark modes.
 */
export function ThemeSliderComponent({ value, onChange }: ThemeSliderComponentProps) {
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const options: ThemeOption[] = ['light', 'auto', 'dark'];

  const getLabel = (option: ThemeOption): string => {
    switch (option) {
      case 'light':
        return 'Light';
      case 'auto':
        return 'Auto';
      case 'dark':
        return 'Dark';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: textColor + '20' }]}>
      {options.map((option) => {
        const isSelected = value === option;
        return (
          <Pressable
            key={option}
            style={[
              styles.option,
              isSelected && { backgroundColor: tintColor },
            ]}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <ThemedText
              style={[
                styles.optionText,
                isSelected && { color: backgroundColor, fontWeight: '600' },
              ]}
            >
              {getLabel(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    maxWidth: 160,
  },
  option: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 11,
  },
});
