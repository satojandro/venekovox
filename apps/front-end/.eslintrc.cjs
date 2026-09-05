const path = require("path");

// App-local lint config for apps/front-end.
//
// Why not `extends: ["../../.eslintrc.js"]` (like apps/subgraph)?
// The root config's typed plugin configs (`plugin:@typescript-eslint/recommended-type-checked`)
// fail to resolve through an app-level chain in this pnpm workspace (legacy eslintrc
// plugin resolution). Until the repo migrates app linting, this config stands alone:
// parse with the TS parser, enforce baseline core rules, leave formatting to prettier
// (lint-staged). tests/*.mjs run under `node --test` and are excluded here.
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: ["eslint:recommended"],
  parser: require.resolve("@typescript-eslint/parser", { paths: [path.resolve(__dirname, "../../")] }),
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2022,
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": "off",
  },
  ignorePatterns: ["tests/", "dist/", "node_modules/"],
};
