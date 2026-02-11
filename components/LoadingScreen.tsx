import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

/**
 * Loading Screen Component
 * Displays during app initialization with splash icon and loading indicator
 */
export function LoadingScreen() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <Image
        source={require('@/assets/images/splash-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator
        size="large"
        color={isDark ? '#ffffff' : '#0a7ea4'}
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  spinner: {
    marginTop: 20,
  },
});
