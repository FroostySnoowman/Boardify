const { withGradleProperties, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEYSTORE_PROPERTIES_FILENAME = 'keystore.properties';

/** Resolve storeFile the same way Gradle does for the app module (`android/app`). */
function resolveAndroidStoreFile(projectRoot, storeFile) {
  if (!storeFile || typeof storeFile !== 'string') {
    return null;
  }
  const trimmed = storeFile.trim();
  if (!trimmed) {
    return null;
  }
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return path.resolve(projectRoot, 'android', 'app', trimmed);
}

function readKeystoreProperties(projectRoot) {
  const filePath = path.join(projectRoot, KEYSTORE_PROPERTIES_FILENAME);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const props = {};
  content.split('\n').forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const eq = t.indexOf('=');
      if (eq > 0) {
        const key = t.slice(0, eq).trim();
        const value = t.slice(eq + 1).trim();
        props[key] = value;
      }
    }
  });
  if (!props.storeFile || !props.storePassword || !props.keyAlias || !props.keyPassword) {
    return null;
  }
  const resolved = resolveAndroidStoreFile(projectRoot, props.storeFile);
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }
  return props;
}

function stripUploadSigningFromGradleProperties(platformProjectRoot) {
  const gp = path.join(platformProjectRoot, 'gradle.properties');
  if (!fs.existsSync(gp)) {
    return;
  }
  const text = fs.readFileSync(gp, 'utf8');
  const next = text
    .split('\n')
    .filter((line) => !/^\s*MYAPP_UPLOAD_/.test(line))
    .join('\n');
  if (next !== text) {
    fs.writeFileSync(gp, next, 'utf8');
  }
}

function withAndroidSigning(config) {
  const projectRoot = config.modRequest?.projectRoot ?? path.join(__dirname, '..');
  const keystore = readKeystoreProperties(projectRoot);

  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      if (!keystore) {
        stripUploadSigningFromGradleProperties(cfg.modRequest.platformProjectRoot);
      }
      return cfg;
    },
  ]);

  if (!keystore) {
    config = withAppBuildGradle(config, (c) => {
      if (c.modResults.language !== 'groovy') {
        return c;
      }
      let contents = c.modResults.contents;
      // Expo/RN template defaults release to debug signing; our upload block uses signingConfigs.release.
      // If there is no valid keystore, keep release builds signable with the debug key (local/EAS without local secrets).
      if (contents.includes('// see https://reactnative.dev/docs/signed-apk-android.')) {
        contents = contents.replace(
          /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\r?\n)\s*signingConfig signingConfigs\.release/,
          '$1            signingConfig signingConfigs.debug'
        );
      }
      c.modResults.contents = contents;
      return c;
    });
    return config;
  }

  config = withGradleProperties(config, (c) => {
    c.modResults.push(
      { type: 'property', key: 'MYAPP_UPLOAD_STORE_FILE', value: keystore.storeFile },
      { type: 'property', key: 'MYAPP_UPLOAD_STORE_PASSWORD', value: keystore.storePassword },
      { type: 'property', key: 'MYAPP_UPLOAD_KEY_ALIAS', value: keystore.keyAlias },
      { type: 'property', key: 'MYAPP_UPLOAD_KEY_PASSWORD', value: keystore.keyPassword }
    );
    return c;
  });

  config = withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') {
      return c;
    }
    let contents = c.modResults.contents;

    const releaseSigningBlock = `release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
        `;

    if (contents.includes('MYAPP_UPLOAD_STORE_FILE')) {
      return c;
    }

    contents = contents.replace(
      /signingConfigs\s*\{\s*\n\s*debug\s*\{/,
      `signingConfigs {\n        ${releaseSigningBlock}debug {`
    );

    contents = contents.replace(
      /release\s*\{\s*\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
      (match) =>
        match.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release')
    );

    c.modResults.contents = contents;
    return c;
  });

  return config;
}

module.exports = withAndroidSigning;
