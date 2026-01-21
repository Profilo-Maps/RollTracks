/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, useColorScheme, Text, View, ActivityIndicator, TouchableOpacity, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/contexts/AuthContext';
import { ModeProvider } from './src/contexts/ModeContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { ServicesProvider } from './src/contexts/ServicesContext';
import { 
  LoginScreen,
  RegisterScreen,
  ProfileScreen, 
  StartTripScreen,
  ActiveTripScreen,
  TripSummaryScreen,
  TripHistoryScreen,
  HomeScreen
} from './src/screens';
import { migrateData, needsMigration } from './src/utils/migration';
import { TripService } from './src/services/TripService';
import { HybridStorageAdapter } from './src/storage/HybridStorageAdapter';
import { SyncService } from './src/services/SyncService';
import { SyncStatusIndicator } from './src/components/SyncStatusIndicator';
import { logEnvironmentValidation } from './src/utils/envValidation';
import { useAuth } from './src/contexts/AuthContext';
import { useToast } from './src/contexts/ToastContext';
import { syncEvents } from './src/utils/syncEvents';
import { SyncDebugger } from './src/utils/debugSync';

// Add global debug functions for development
if (__DEV__) {
  (globalThis as any).debugSync = {
    getQueue: SyncDebugger.getQueueItems,
    clearQueue: SyncDebugger.clearQueue,
    removeFailedItems: SyncDebugger.removeFailedItems,
  };
  console.log('Debug functions available: globalThis.debugSync.getQueue(), globalThis.debugSync.clearQueue(), globalThis.debugSync.removeFailedItems()');
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Profile button component for header
const ProfileButton = ({ navigation }: any) => (
  <TouchableOpacity
    onPress={() => navigation.navigate('Profile')}
    style={styles.profileButton}
    accessibilityLabel="Open profile"
    accessibilityRole="button"
    accessibilityHint="Tap to view and edit your profile"
  >
    <Text style={styles.profileButtonText}>👤</Text>
  </TouchableOpacity>
);

// Custom tab bar component
const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  // Filter to only show visible tabs
  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    return typeof options.tabBarButton !== 'function';
  });

  return (
    <View style={styles.tabBarContainer}>
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || route.name;
        const routeIndex = state.routes.indexOf(route);
        const isFocused = state.index === routeIndex;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={[
              styles.tabButton,
              isFocused && styles.tabButtonActive,
            ]}
          >
            {options.tabBarIcon && options.tabBarIcon({ 
              color: isFocused ? '#007AFF' : '#8E8E93',
              focused: isFocused 
            })}
            <Text style={[
              styles.tabLabel,
              isFocused && styles.tabLabelActive,
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Auth Stack for login/register screens
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator for authenticated users
function MainTabs({ syncService }: { syncService: SyncService | null }) {
  const { showSuccess, showError } = useToast();

  // Listen for sync events
  useEffect(() => {
    const unsubscribe = syncEvents.subscribe((type: string, message: string) => {
      if (type === 'success') {
        showSuccess(message);
      } else {
        showError(message);
      }
    });

    return unsubscribe;
  }, [showSuccess, showError]);

  return (
    <Tab.Navigator
      initialRouteName="StartTrip"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#f8f8f8',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        // Show sync status and profile button
        headerRight: () => {
          const routeName = route.name;
          if (routeName === 'Profile' || routeName === 'ActiveTrip' || routeName === 'TripSummary') {
            return null;
          }
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SyncStatusIndicator syncService={syncService} />
              <ProfileButton navigation={navigation} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen 
        name="StartTrip" 
        component={StartTripScreen}
        options={{
          tabBarLabel: 'Record',
          tabBarIcon: () => <Text style={{ fontSize: 18, color: '#FF0000' }}>●</Text>,
          headerTitle: 'Start Trip',
        }}
      />
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏠</Text>,
          headerTitle: 'Home',
        }}
      />
      <Tab.Screen 
        name="History" 
        component={TripHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📋</Text>,
          headerTitle: 'Trip History',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerTitle: 'My Profile',
        }}
      />
      <Tab.Screen 
        name="ActiveTrip" 
        component={ActiveTripScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: false,
        }}
      />
      <Tab.Screen 
        name="TripSummary" 
        component={TripSummaryScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

// Root navigator that switches between Auth and Main based on authentication state
function RootNavigator({ syncService }: { syncService: SyncService | null }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return user ? <MainTabs syncService={syncService} /> : <AuthStack />;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isReady, setIsReady] = useState(false);
  const navigationRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);
  const syncService = useRef<SyncService | null>(null);
  const storageAdapter = useRef<HybridStorageAdapter | null>(null);
  const tripService = useRef<TripService | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Validate environment
        logEnvironmentValidation();

        // Check if migration is needed
        const shouldMigrate = await needsMigration();
        if (shouldMigrate) {
          console.log('Migrating data from old format...');
          await migrateData();
        }

        // Initialize SyncService (will work in offline mode if Supabase not configured)
        try {
          syncService.current = new SyncService();
          await syncService.current.initialize();
          console.log('SyncService initialized');
        } catch (syncError) {
          console.log('SyncService initialization failed, continuing in offline mode:', syncError);
        }

        // Initialize storage adapter and trip service
        if (syncService.current) {
          storageAdapter.current = new HybridStorageAdapter(syncService.current);
        }
        if (storageAdapter.current) {
          tripService.current = new TripService(storageAdapter.current);
        }

        setIsReady(true);
        
        // Check for active trip and navigate to it
        const activeTrip = tripService.current ? await tripService.current.getActiveTrip() : null;
        if (activeTrip && navigationRef.current) {
          console.log('Active trip found on app start, navigating to ActiveTrip screen');
          setTimeout(() => {
            navigationRef.current?.navigate('ActiveTrip', { tripId: activeTrip.id });
          }, 100);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsReady(true);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      if (syncService.current) {
        syncService.current.destroy();
      }
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // App is going to background
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        console.log('App going to background');
      }
      
      // App is coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App coming to foreground');
        try {
          const activeTrip = tripService.current ? await tripService.current.getActiveTrip() : null;
          if (activeTrip && navigationRef.current) {
            console.log('Active trip found, navigating to ActiveTrip screen');
            navigationRef.current?.navigate('ActiveTrip', { tripId: activeTrip.id });
          }

          // Trigger sync when app comes to foreground
          if (syncService.current) {
            console.log('Triggering sync on foreground');
            syncService.current.syncNow().catch(error => {
              console.error('Foreground sync failed:', error);
            });
          }
        } catch (error) {
          console.error('Error checking active trip on foreground:', error);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Show loading screen while initializing
  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ServicesProvider>
          <ModeProvider>
            <ToastProvider>
              <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
              <NavigationContainer ref={navigationRef}>
                <RootNavigator syncService={syncService.current} />
              </NavigationContainer>
            </ToastProvider>
          </ModeProvider>
        </ServicesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  profileButton: {
    marginRight: 16,
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: {
    fontSize: 24,
  },
  tabBarContainer: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 4,
    marginVertical: 8,
    borderRadius: 8,
    minHeight: 44,
  },
  tabButtonActive: {
    backgroundColor: '#e8f4f8',
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#007AFF',
  },
});

export default App;
