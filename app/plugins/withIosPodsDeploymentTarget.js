const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'EXPO_ALIGN_PODS_IOS_DEPLOYMENT_TARGET';

module.exports = function withIosPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return config;
      }
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) {
        return config;
      }

      const patch = `
    # ${MARKER}: every pod target must match ios.deploymentTarget (Swift / ExpoModulesCore).
    __expo_ios_dep_target = podfile_properties['ios.deploymentTarget']
    __expo_ios_dep_target = '16.4' if __expo_ios_dep_target.nil? || __expo_ios_dep_target.to_s.strip.empty?
    installer.target_installation_results.pod_target_installation_results.each do |_, result|
      result.native_target.build_configurations.each do |cfg|
        cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = __expo_ios_dep_target
      end
    end`;

      const anchor =
        '      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end';
      if (!contents.includes(anchor)) {
        console.warn(
          `[${MARKER}] Podfile layout changed; skipping Podfile patch. Re-check iOS deployment target for Expo pods.`
        );
        return config;
      }

      contents = contents.replace(
        anchor,
        `      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )${patch}\n  end`
      );
      fs.writeFileSync(podfilePath, contents, 'utf8');
      return config;
    },
  ]);
};
