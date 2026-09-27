const path = require("path");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Rewrites react-native imports under src/ and app/ so that components
      // update their styles natively on a theme change, without re-rendering.
      // `autoProcessPaths` is matched as a substring of each file's path, so
      // it must be absolute: a bare "app" also matches files inside
      // node_modules (Unistyles' own among them) and breaks the web build.
      [
        "react-native-unistyles/plugin",
        {
          root: "src",
          autoProcessPaths: [path.join(__dirname, "app") + path.sep],
        },
      ],
    ],
  };
};
