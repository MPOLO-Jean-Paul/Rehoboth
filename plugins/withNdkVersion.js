const { withAppBuildGradle } = require('@expo/config-plugins');

const withNdkVersion = (config, ndkVersion) => {
  return withAppBuildGradle(config, (config) => {
    // Add or replace the ndkVersion line in the android block
    if (config.modResults.contents.includes('ndkVersion')) {
      config.modResults.contents = config.modResults.contents.replace(
        /ndkVersion\s*=\s*".*"/,
        `ndkVersion = "${ndkVersion}"`
      );
    } else {
      config.modResults.contents = config.modResults.contents.replace(
        'android {',
        `android {\n    ndkVersion = "${ndkVersion}"`
      );
    }
    return config;
  });
};

module.exports = withNdkVersion;
