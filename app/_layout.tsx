import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataRangerProvider } from '@/contexts/DataRangerContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
} from '@expo-google-fonts/inter';

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
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <DataRangerProvider>
              <ThemedNavigator />
            </DataRangerProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
  const { isLoading, isAuthenticated, hasNetworkError, retryConnection } = useAuth();

  // Log state changes for debugging
  useEffect(() => {
    console.log('[RootNavigator] State:', { isLoading, isAuthenticated, hasNetworkError });
  }, [isLoading, isAuthenticated, hasNetworkError]);

  // Hide native splash screen once loading is complete
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Show loading screen while checking auth state
  if (isLoading) {
    console.log('[RootNavigator] Rendering LoadingScreen');
    return (
      <>
        <LoadingScreen />
        <StatusBar style="auto" translucent backgroundColor="transparent" />
      </>
    );
  }

  // Show network error screen if connection failed
  if (hasNetworkError) {
    console.log('[RootNavigator] Rendering NetworkErrorScreen');
    return (
      <>
        <NetworkErrorScreen onRetry={retryConnection} />
        <StatusBar style="auto" translucent backgroundColor="transparent" />
      </>
    );
  }

  console.log('[RootNavigator] Rendering Stack navigator');
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
