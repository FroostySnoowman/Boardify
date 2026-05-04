const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '// @expo-config withAndroidKotlinGradleClasspath';

function applyTransform(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  let out = contents;

  if (!out.includes('kotlinGradlePluginVersion')) {
    out = out.replace(
      /buildscript\s*\{/,
      `buildscript {\n  ext {\n    kotlinGradlePluginVersion = (project.findProperty('android.kotlinVersion') ?: '2.1.20').toString()\n  }\n`
    );
  }

  out = out.replace(
    /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\s*\)/g,
    'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinGradlePluginVersion")'
  );

  return `${MARKER}\n\n${out}`;
}

module.exports = function withAndroidKotlinGradleClasspath(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    cfg.modResults.contents = applyTransform(cfg.modResults.contents);
    return cfg;
  });
};
