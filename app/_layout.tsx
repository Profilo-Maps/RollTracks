import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import MapboxGL from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Configure Mapbox access token from environment variable
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          {/* Main Stack - uses Basemap Layout */}
          <Stack.Screen name="(main)" />
          {/* Auth Stack - for profile access when authenticated */}
          <Stack.Screen name="(auth)" />
        </>
      ) : (
        <>
          {/* Auth Stack - for login/registration when not authenticated */}
          <Stack.Screen name="(auth)" />
        </>
      )}
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}
