import type { Editor } from 'grapesjs';
import type { MJMLParsingOptions } from 'mjml-core';
import { ComponentPluginOptions } from './components';
import { MjmlParser } from './components/parser';

export interface CommandOptionsMjmlToHtml extends MJMLParsingOptions {
  mjml?: string;
}

export type CodeDockOptions = {
  /**
   * Open the docked code view on editor ready.
   * @default false
   */
  startOpen?: boolean;

  /**
   * Dock width in pixels. Persisted per browser once resized.
   * @default 480
   */
  width?: number;

  /**
   * Which side the dock sits on.
   * @default 'left'
   */
  side?: 'left' | 'right';

  /**
   * Custom `vs` base URL for the Monaco CDN loader
   * (e.g. pinned version or self-hosted mirror).
   * @default loader default CDN
   */
  cdnUrl?: string;

  /**
   * Tag-pair colorizer in the MJML tab: same tag name always gets the
   * same color, so matching open/close pairs are easy to spot.
   * Toggleable via the "Colors" toolbar button.
   * @default true
   */
  tagColorizer?: boolean;
};

export type EmlOptions = {
  /**
   * `From:` header of the downloaded .eml file.
   * @default 'sender@example.com'
   */
  from?: string;

  /**
   * `To:` header of the downloaded .eml file.
   * @default 'recipient@example.com'
   */
  to?: string;

  /**
   * `Subject:` header of the downloaded .eml file.
   * @default 'Email'
   */
  subject?: string;

  /**
   * Download filename.
   * @default 'template.eml'
   */
  filename?: string;
};

export type PluginOptions = {
  /**
   * Which blocks to add.
   * @default (all)
   */
  blocks?: string[];

  /**
   * Add custom block options, based on block id.
   * @default (blockId) => ({})
   * @example (blockId) => (blockId === 'mj-hero' ? { attributes: {...} } : {})
   */
  block?: (blockId: string) => {};

  /**
   * Code viewer theme.
   * @default 'hopscotch'
   */
  codeViewerTheme?: string;

  /**
   * Add custom MJML components
   *
   * @default []
   */
  customComponents?: ((editor: Editor, componentOptions: ComponentPluginOptions) => void)[];

  /**
   * Placeholder MJML template for the import modal
   * @default ''
   */
  importPlaceholder?: string;

  /**
   * Image placeholder source for mj-image block
   * @default ''
   */
  imagePlaceholderSrc?: string;

  /**
   * Custom MJML parser.
   * @default mjml-browser instance
   */
  mjmlParser?: MjmlParser;

  /**
   * Overwrite default export command
   * @default true
   */
  overwriteExport?: boolean;

  /**
   * String before the MJML in export code
   * @default ''
   */
  preMjml?: string;

  /**
   * String after the MJML in export code
   * @default ''
   */
  postMjml?: string;

  /**
   * Clean all previous blocks if true
   * @default true
   */
  resetBlocks?: boolean;

  /**
   * Reset the Style Manager and add new properties for MJML
   * @default true
   */
  resetStyleManager?: boolean;

  /**
   * Clean all previous devices and set a new one for mobile
   * @default true
   */
  resetDevices?: boolean;

  /**
   * Hide the default selector manager
   * @default true
   */
  hideSelector?: boolean;

  /**
   * Experimental: use XML parser instead of HTML.
   * This should allow importing void MJML elements (without closing tags) like <mj-image/>.
   * @default false
   * @experimental
   */
  useXmlParser?: boolean;

  /**
   * Column padding (this way it's easier to select columns)
   * @default '10px 0'
   */
  columnsPadding?: string;

  /**
   * I18n object containing languages, [more info](https://grapesjs.com/docs/modules/I18n.html#configuration).
   * @default {}
   */
  i18n?: Record<string, any>;

  /**
   * Custom fonts on exported HTML header, [more info](https://github.com/mjmlio/mjml#inside-nodejs).
   * @default {}
   * @example
   * {
   *   Montserrat: 'https://fonts.googleapis.com/css?family=Montserrat',
   *   'Open Sans': 'https://fonts.googleapis.com/css?family=Open+Sans'
   * }
   */
  fonts?: Record<string, any>;

  /**
   * Load custom preset theme.
   * @default true
   */
  useCustomTheme?: boolean;

  /**
   * Docked Monaco code view (MJML editable + HTML read-only).
   * @default { startOpen: false, side: 'left' }
   */
  codeDock?: CodeDockOptions;

  /**
   * Headers/filename used by the `mjml-export-eml` download command.
   * @default { from: 'sender@example.com', to: 'recipient@example.com', subject: 'Email', filename: 'template.eml' }
   */
  eml?: EmlOptions;

  /**
   * Resizable canvas viewport (drag grips + width input, persisted).
   * @default {}
   */
  canvasResize?: {
    min?: number;
    max?: number;
    storageKey?: string;
  };
};
