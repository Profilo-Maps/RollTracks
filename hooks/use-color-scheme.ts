import { useTheme } from '@/contexts/ThemeContext';

/**
 * Returns the current color scheme (light or dark) based on user preference.
 * Falls back to device color scheme if preference is set to 'auto'.
 */
export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme;
}

