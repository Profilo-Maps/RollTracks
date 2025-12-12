const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Exclude Node.js built-in modules that aren't available in React Native
    resolveRequest: (context, moduleName, platform) => {
      // List of Node.js modules to exclude
      const nodeModules = ['fs', 'path', 'os', 'crypto', 'stream', 'http', 'https', 'net', 'tls', 'zlib'];
      
      if (nodeModules.includes(moduleName)) {
        // Return a mock module that throws an error if used
        return {
          type: 'empty',
        };
      }
      
      // Use default resolution for everything else
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
