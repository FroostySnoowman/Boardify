const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withIosPodsDeploymentTarget(config, props = {}) {
  const deploymentTarget = props.deploymentTarget || '16.4';
  const marker = 'IOS_PODS_DEPLOYMENT_TARGET_FIX';

  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      const source = fs.readFileSync(podfilePath, 'utf8');
      if (source.includes(marker)) return config;

      const block = `

# ${marker} - keep all pod targets aligned with ExpoModulesCore minimum.
post_install do |installer|
  react_native_post_install(
    installer,
    config[:reactNativePath],
    :mac_catalyst_enabled => false,
    :ccache_enabled => podfile_properties['apple.ccacheEnabled'] == 'true',
  )

  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_configuration|
      build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
    end
  end
end
`;

      const updated = source.replace(
        /post_install do \|installer\|[\s\S]*?end\n/m,
        block + '\n'
      );

      fs.writeFileSync(podfilePath, updated, 'utf8');
      return config;
    },
  ]);
};
