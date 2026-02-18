/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#4A5568', // Darker gray for better contrast (was #687076)
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    error: '#e53935',
    link: '#0a7ea4',
    buttonPrimary: '#007AFF',
    buttonDanger: '#FF3B30',
    buttonText: '#FFFFFF',
    // Text color for buttons with tint background
    tintButtonText: '#FFFFFF',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#C3C8CC',
    tabIconDefault: '#C3C8CC',
    tabIconSelected: tintColorDark,
    error: '#FF6B6B',
    link: '#5BC0EB',
    buttonPrimary: '#007AFF',
    buttonDanger: '#FF3B30',
    buttonText: '#FFFFFF',
    // Text color for buttons with tint background (black for white tint in dark mode)
    tintButtonText: '#000000',
  },
};

/**
 * Helper function to get the correct text color for buttons with tint background.
 * In dark mode, tint is white, so we need black text for contrast.
 * In light mode, tint is a color, so we use white text.
 * 
 * @param colorScheme - The current color scheme ('light' or 'dark')
 * @returns The appropriate text color for tint-background buttons
 */
export function getTintButtonTextColor(colorScheme: 'light' | 'dark'): string {
  return Colors[colorScheme].tintButtonText;
}

export const Fonts = Platform.select({
  ios: {
    regular: 'Inter_600SemiBold', // Upgraded from 400 to 600 for industrial chic
    medium: 'Inter_700Bold', // Upgraded from 500 to 700
    semiBold: 'Inter_800ExtraBold', // Upgraded from 600 to 800
    bold: 'Inter_900Black', // Upgraded from 700 to 900
    extraBold: 'Inter_800ExtraBold',
    black: 'Inter_900Black',
    mono: 'ui-monospace',
  },
  android: {
    regular: 'Inter_600SemiBold', // Upgraded from 400 to 600 for industrial chic
    medium: 'Inter_700Bold', // Upgraded from 500 to 700
    semiBold: 'Inter_800ExtraBold', // Upgraded from 600 to 800
    bold: 'Inter_900Black', // Upgraded from 700 to 900
    extraBold: 'Inter_800ExtraBold',
    black: 'Inter_900Black',
    mono: 'monospace',
  },
  default: {
    regular: 'Inter_600SemiBold', // Upgraded from 400 to 600 for industrial chic
    medium: 'Inter_700Bold', // Upgraded from 500 to 700
    semiBold: 'Inter_800ExtraBold', // Upgraded from 600 to 800
    bold: 'Inter_900Black', // Upgraded from 700 to 900
    extraBold: 'Inter_800ExtraBold',
    black: 'Inter_900Black',
    mono: 'monospace',
  },
  web: {
    regular: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    medium: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    semiBold: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    bold: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    extraBold: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    black: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/**
 * Font Weight Mapping for Industrial Chic Style
 * 
 * For web platform, use these numeric font-weight values with Inter font:
 * - regular: 600 (SemiBold)
 * - medium: 700 (Bold)
 * - semiBold: 800 (ExtraBold)
 * - bold: 900 (Black)
 * - extraBold: 800 (ExtraBold)
 * - black: 900 (Black)
 * 
 * This creates a modern, industrial chic aesthetic with heavier, more impactful typography.
 */
