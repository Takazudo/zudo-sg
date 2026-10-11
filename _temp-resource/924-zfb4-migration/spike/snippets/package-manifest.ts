export const packageManifest = {
  "name": "zfb4-spike-routes",
  "version": "1.0.1",
  "type": "module",
  "exports": {
    ".": "./plugin.js",
    "./adapter": "./adapter.js",
    "./package.json": "./package.json"
  },
  "files": [
    "routes-src",
    "client",
    "plugin.js",
    "adapter.js"
  ],
  "dependencies": {
    "preact": "^10.29.1",
    "@takazudo/zdtp": "0.8.6"
  },
  "peerDependencies": {
    "@takazudo/zfb": "4.3.1",
    "@takazudo/zudo-doc": "6.0.0"
  }
};
