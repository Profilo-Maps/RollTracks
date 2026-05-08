const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const proximitySharedPath = path.resolve(__dirname, '../Proximity/editor/shared');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /specs\/.*/,
  /docs\/.*/,
  /Output\/.*/,
  /cache\/.*/,
];

// Allow Metro to resolve @proximity/shared from outside the project root
config.watchFolders = [proximitySharedPath];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
