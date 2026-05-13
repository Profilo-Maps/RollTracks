const { withGradleProperties } = require('@expo/config-plugins');

const ARCHITECTURES = 'arm64-v8a,x86_64';

/**
 * Expo config plugin: withDropLegacyArchs
 *
 * Restricts Android builds to 64-bit architectures only (arm64-v8a, x86_64) by
 * overriding `reactNativeArchitectures` in `android/gradle.properties`.
 *
 * Spec context: 16 KB page-size compatibility (Android 15). Google's 16 KB
 * requirement applies only to 64-bit devices; 32-bit devices (<2% of active
 * Android in 2026) use 4 KB pages and are unaffected. Dropping armeabi-v7a
 * and x86 ~halves Android build time, shrinks the APK ~40%, and removes a
 * source of false-positive alignment warnings in the verify script.
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withDropLegacyArchs(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (existing) {
      existing.value = ARCHITECTURES;
    } else {
      cfg.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: ARCHITECTURES,
      });
    }
    return cfg;
  });
}

module.exports = withDropLegacyArchs;
