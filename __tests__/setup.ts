// Minimal setup for accessibility tests
// No React Native dependencies needed for contrast checking

// Mock react-native-reanimated (if needed by other tests)
jest.mock('react-native-reanimated', () => {
  return {
    default: {
      call: () => {},
    },
  };
});

// Mock expo-router (if needed by other tests)
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: 'Link',
  Stack: 'Stack',
  Tabs: 'Tabs',
}));

// Mock @rnmapbox/maps (if needed by other tests)
jest.mock('@rnmapbox/maps', () => ({
  MapView: 'MapView',
  Camera: 'Camera',
  ShapeSource: 'ShapeSource',
  LineLayer: 'LineLayer',
  SymbolLayer: 'SymbolLayer',
  setAccessToken: jest.fn(),
}));
