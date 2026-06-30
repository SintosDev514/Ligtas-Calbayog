module.exports = function (api) {
  api.cache(false);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": ".",
            "@shared": "./../../shared",
          },
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
