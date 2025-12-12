This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# RollTracks Features

## Supabase Cloud Integration

RollTracks includes optional cloud synchronization using Supabase for multi-device access and data backup.

### Quick Setup

1. **Create Supabase Project**
   - Sign up at https://supabase.com
   - Create a new project
   - Get your Project URL and anon key from Settings → API

2. **Configure Environment**
   ```bash
   # Create .env file in project root
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Apply Database Migrations**
   - Go to Supabase Dashboard → SQL Editor
   - Run each migration file from `supabase/migrations/` in order
   - See [docs/SupabaseSetup.md](docs/SupabaseSetup.md) for detailed instructions

4. **Install Dependencies**
   ```bash
   npm install
   ```

### Features

- **Offline-First**: App works fully offline, syncs when online
- **Authentication**: Display name + password (no email required)
- **Privacy**: Display names excluded from research data exports
- **Row-Level Security**: Users can only access their own data
- **Background Sync**: Automatic sync when network available
- **File Uploads**: Photos and GPS tracks stored securely
- **Multi-Device**: Login from multiple devices with same account

### Offline Mode

If Supabase is not configured, the app runs in offline-only mode:
- All data stored locally on device
- No cloud sync or multi-device support
- Full functionality for single-device use

For complete setup instructions, see [docs/SupabaseSetup.md](docs/SupabaseSetup.md)

## Map Visualization

RollTracks includes real-time map visualization during active trips using Leaflet.js with offline tile support.

### Map Tiles Setup

The app bundles offline map tiles as Android assets. Before building:

1. Ensure tiles exist at: `C:\MobilityTripTracker1\MapData\sf_tiles\`
2. Run: `npm run copy-tiles`
3. Build: `npm run android`

The tiles will be automatically included in the APK. No manual device setup required!

### Map Features

- **Offline Support**: Works without internet connection using local tiles
- **Real-time Tracking**: Shows current GPS location with accuracy circle
- **Route Visualization**: Draws traveled route as a blue polyline
- **Interactive**: Pan, zoom, and re-center on current location
- **Performance Optimized**: GPS throttling, polyline simplification, and tile caching
- **Pause/Resume**: Route drawing stops when trip is paused

### Component Documentation

For detailed MapView component documentation, see [docs/MapView.md](docs/MapView.md)

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
