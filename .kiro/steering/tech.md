# Technology Stack

## Framework & Platform

- **React Native** (0.81.5) with **Expo** (~54.0.33)
- **Expo Router** (~6.0.23) for file-based routing
- **TypeScript** (~5.9.2) with strict mode enabled
- React 19.1.0

## Key Libraries

### Navigation & UI
- `@react-navigation/native` - Navigation framework
- `@react-navigation/bottom-tabs` - Bottom tab navigation
- `expo-router` - File-based routing
- `react-native-reanimated` - Animations
- `react-native-gesture-handler` - Gesture handling

### Maps & Location
- `@rnmapbox/maps` - MapBox integration for map tiles and rendering
- Native GPS via Expo APIs

### Backend & Storage
- `@supabase/supabase-js` - Backend database and auth
- `@react-native-async-storage/async-storage` - Local storage

### Other
- `expo-haptics` - Haptic feedback
- `@expo/vector-icons` - Icon library

## Build System

Expo managed workflow with new architecture enabled

## Common Commands

```bash
# Development
npm start              # Start Expo dev server
npm run android        # Run on Android emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in web browser

# Code Quality
npm run lint           # Run ESLint

# Testing
npm test               # Run all tests with Jest
npm run test:a11y      # Run accessibility tests only

# Project Management
npm run reset-project  # Reset to blank project
```

## Testing Setup

- **Jest** (30.2.0) with `ts-jest` for TypeScript support
- Test environment: Node
- Tests located in `__tests__/` directory
- Mocks in `__mocks__/` directory
- Path alias: `@/*` maps to project root
- Accessibility testing with `accessibility-checker` (4.0.11)

## TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` for root imports
- Expo TypeScript base configuration
- Typed routes enabled (experimental)

## Expo Features

- React Compiler enabled (experimental)
- Edge-to-edge display on Android
- Automatic UI style (light/dark mode)
- Splash screen with adaptive theming
