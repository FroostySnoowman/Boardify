const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

const srcPath = path.resolve(__dirname, "src");

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    "@": srcPath,
  },
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName.startsWith("@/")) {
      const resolvedPath = moduleName.replace("@/", srcPath + "/");
      return context.resolveRequest(context, resolvedPath, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });