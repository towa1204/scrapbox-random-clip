module.exports = {
  env: {
    commonjs: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'airbnb-base', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  rules: {},
};
