const { withXcodeProject, withInfoPlist, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withIdentitySettings(config, props = {}) {
  const version = props.version || config.version;
  const buildNumber =
    props.buildNumber || config.ios?.buildNumber || config.runtimeVersion?.version || '1';
  const displayName = props.displayName || config.name;
  const category = props.category || config.ios?.infoPlist?.LSApplicationCategoryType;

  withInfoPlist(config, (config) => {
    if (displayName) {
      config.modResults.CFBundleDisplayName = displayName;
    }
    if (category) {
      config.modResults.LSApplicationCategoryType = category;
    }
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();

    Object.entries(configurations).forEach(([key, item]) => {
      if (typeof item !== 'object' || !item.buildSettings) return;
      if (version) {
        item.buildSettings.MARKETING_VERSION = version;
      }
      if (buildNumber) {
        item.buildSettings.CURRENT_PROJECT_VERSION = String(buildNumber);
      }
      if (displayName) {
        item.buildSettings.INFOPLIST_KEY_CFBundleDisplayName = displayName;
      }
      if (category) {
        item.buildSettings.INFOPLIST_KEY_LSApplicationCategoryType = category;
      }
      item.buildSettings.EXPO_PUBLIC_BUILD_ENV = 'production';
      item.buildSettings.NODE_ENV = 'production';
    });

    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const projectName = config.name || 'App';
      const schemePath = path.join(
        config.modRequest.projectRoot,
        'ios',
        `${projectName}.xcodeproj`,
        'xcshareddata',
        'xcschemes',
        `${projectName}.xcscheme`
      );

      try {
        if (fs.existsSync(schemePath)) {
          const xml = fs.readFileSync(schemePath, 'utf8');
          const updated = xml.replace(
            /(<LaunchAction[^>]*buildConfiguration\s*=\s*")Debug(")/,
            '$1Release$2'
          );
          if (updated !== xml) {
            fs.writeFileSync(schemePath, updated, 'utf8');
            console.log(`Updated scheme to use Release for Run at ${schemePath}`);
          }
        }
      } catch (e) {
        console.warn(`Could not update scheme at ${schemePath}: ${e.message}`);
      }

      return config;
    },
  ]);

  return config;
};