module.exports = {
  moduleFileExtensions: ["js", "ts"],
  verbose: true,
  modulePaths: ["<rootDir>/src"],
  moduleNameMapper: {
    "^grapesjs$": "<rootDir>/libs/grapesjs-core/src/index.ts",
  },
  testMatch: ["<rootDir>/tests/specs/**/*.(t|j)s"],
  setupFiles: ["<rootDir>/tests/setup.js"],
};
