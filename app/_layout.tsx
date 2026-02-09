import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Configure Mapbox access token - requires development build
// Initialize Mapbox if native module is available
try {
  if (Platform.OS !== 'web') {
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
} catch (error) {
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
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootNavigator />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Render appropriate stack based on authentication state
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          {/* Main Stack - default when authenticated */}
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          {/* Auth Stack - for profile access */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </>
      ) : (
        <>
          {/* Auth Stack - for login/registration when not authenticated */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          {/* Hide main stack when not authenticated */}
        </>
      )}
    </Stack>
  );
}
