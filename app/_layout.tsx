import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NativeAdapter } from '@/adapters/NativeAdapter';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Keep the native splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Configure Mapbox access token - requires development build
// Initialize Mapbox if native module is available
try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MapboxGL = require('@rnmapbox/maps').default;
    if (MapboxGL?.setAccessToken) {
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (token) {
        MapboxGL.setAccessToken(token);
        console.log('✅ Mapbox initialized successfully');
      } else {
        console.warn('⚠️  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN not found in environment');
      }
    }
  }
} catch {
  console.warn('⚠️  Mapbox native module not available.');
  console.warn('📱 To use maps, create a development build:');
  console.warn('   npx expo prebuild');
  console.warn('   npx expo run:android (or run:ios)');
}

/**
 * Root Layout
 * Handles navigation between Auth stack and Main (Basemap) stack.
 * User Auth Context to control which stack is shown based on authentication state.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedNavigator() {
  const { colorScheme } = useTheme();

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootNavigator />
    </NavigationThemeProvider>
  );
}

function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  // Request GPS permissions when app loads and user is authenticated
  useEffect(() => {
    const requestGPSPermissions = async () => {
      // Only request permissions if user is authenticated
      // This prevents permission prompts on the login screen
      if (!isAuthenticated) {
        return;
      }

      try {
        console.log('[RootLayout] Requesting GPS permissions...');
        await NativeAdapter.requestPermissions();
        console.log('[RootLayout] GPS permissions granted');
      } catch (error) {
        console.warn('[RootLayout] GPS permissions denied or unavailable:', error);
        // Don't throw error - user can still use the app
        // They'll be prompted again when trying to start a trip
      }
    };

    requestGPSPermissions();
  }, [isAuthenticated]);

  // Hide native splash screen once loading is complete
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <>
        <LoadingScreen />
        <StatusBar style="auto" translucent backgroundColor="transparent" />
      </>
    );
  }

  // Define all screens unconditionally - routing logic handled by index.tsx
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" translucent backgroundColor="transparent" />
    </>
  );
}
