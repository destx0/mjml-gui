/**
 * Dev-server entry (see webpack.config.js). Exposes the local GrapesJS
 * fork as `window.grapesjs` and registers the plugin under its usual id,
 * so index.html can keep `plugins: ['grapesjs-mjml']`.
 */
import grapesjs from 'grapesjs';
import plugin from '../src';

(window as any).grapesjs = grapesjs;
grapesjs.plugins.add('grapesjs-mjml', plugin);
