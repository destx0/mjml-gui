const path = require('path');
const webpack = require('webpack');

/**
 * grapesjs-cli hook. Dev server only: bundle the local GrapesJS fork
 * (libs/grapesjs-core) together with the plugin, so `npm start` runs the
 * exact core the tests and the shipped editor use — never unpkg@latest.
 * Production builds are left untouched (the plugin only type-imports core).
 */
module.exports = ({ config }) => {
  if (config.mode === 'production') return config;

  const tsRule = config.module.rules.find((r) => String(r.test) === String(/\.tsx?$/));
  if (tsRule) tsRule.options = { ...tsRule.options, transpileOnly: true };

  return {
    ...config,
    entry: path.resolve(__dirname, 'dev/main.ts'),
    resolve: {
      ...config.resolve,
      alias: {
        ...(config.resolve.alias || {}),
        grapesjs$: path.resolve(__dirname, 'libs/grapesjs-core/src/index.ts'),
        // Same as upstream's build: Backbone probes for jQuery, core ships cash-dom.
        jquery: path.resolve(__dirname, 'libs/grapesjs-core/src/utils/cash-dom.ts'),
      },
    },
    plugins: [
      ...config.plugins,
      new webpack.DefinePlugin({ __GJS_VERSION__: JSON.stringify('0.21.2-fork') }),
    ],
  };
};
