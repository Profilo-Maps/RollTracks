const { withProjectBuildGradle } = require('@expo/config-plugins');

const ARGON2KT_VERSION = '1.6.0';

// Sentinel comment used for idempotency — matched regardless of which version
// is currently pinned, so re-running prebuild after bumping ARGON2KT_VERSION
// (without --clean) still results in exactly one injected block.
const SENTINEL = '// --- withArgon2KtOverride (Expo config plugin) ---';

// Assumes the project-level android/build.gradle is Groovy (the default for
// Expo SDK 54 prebuild). If a future Expo SDK ships a KTS root build.gradle,
// the injected syntax (single-quoted strings, no parens) would need updating.
const GRADLE_BLOCK = `
${SENTINEL}
// Forces com.lambdapioneer.argon2kt:argon2kt to ${ARGON2KT_VERSION} for 16 KB page-size
// support on Android 15 devices (Pixel 9 Pro, etc.). Do not remove.
allprojects {
  configurations.all {
    resolutionStrategy {
      force 'com.lambdapioneer.argon2kt:argon2kt:${ARGON2KT_VERSION}'
    }
  }
}
`;

/**
 * Expo config plugin: withArgon2KtOverride
 *
 * Injects a Gradle `resolutionStrategy.force` block into the project-level
 * `android/build.gradle` that pins `com.lambdapioneer.argon2kt:argon2kt` to
 * version 1.6.0. The transitive dependency pulled in by
 * `@sphereon/react-native-argon2` (1.3.0) ships prebuilt `.so` files aligned
 * to 4 KB pages, which Android 15 devices with 16 KB memory pages reject at
 * load time. Version 1.6.0 (2024-09-06) added 16 KB page-size support with
 * no API changes.
 *
 * Spec context: Android 15 / 16 KB page-size compatibility.
 *
 * Idempotent across both re-runs and version bumps: the sentinel comment is
 * version-independent, so prebuild without `--clean` will not duplicate the
 * block even after `ARGON2KT_VERSION` is updated.
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withArgon2KtOverride(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents || '';

    if (contents.includes(SENTINEL)) {
      return cfg;
    }

    const separator = contents.endsWith('\n') ? '' : '\n';
    cfg.modResults.contents = contents + separator + GRADLE_BLOCK;

    return cfg;
  });
}

module.exports = withArgon2KtOverride;
