const { withProjectBuildGradle } = require('@expo/config-plugins');

function withAsyncStorageMavenRepo(config) {
  return withProjectBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') {
      return c;
    }
    let contents = c.modResults.contents;
    const marker = '@react-native-async-storage/async-storage/android/local_repo';
    if (contents.includes(marker)) {
      return c;
    }

    const jitpack = "maven { url 'https://www.jitpack.io' }";
    const block = `${jitpack}
    maven { url "$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo" }`;

    if (contents.includes(jitpack)) {
      contents = contents.replace(jitpack, block);
      c.modResults.contents = contents;
      return c;
    }

    return c;
  });
}

module.exports = withAsyncStorageMavenRepo;
