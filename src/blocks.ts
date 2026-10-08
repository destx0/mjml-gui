import type { Editor, BlockProperties } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { blockCategories, blockIconCss, blockIcons, categoryOrder } from './blockIcons';

export default (editor: Editor, opts: RequiredPluginOptions) => {
  const { Blocks } = editor;
  const imagePlaceholderSrc = opts.imagePlaceholderSrc || 'https://placehold.co/350x250/78c5d6/fff/png';

  opts.resetBlocks && Blocks.getAll().reset();

  const t = (key: string) => editor.I18n.t(key) as string | undefined;
  // A non-empty `grapesjs-mjml.category` translation keeps the legacy
  // single-category list; otherwise blocks are grouped by kind.
  const legacyCategory = t('grapesjs-mjml.category');
  const categoryOf = (id: string) => {
    if (legacyCategory) return legacyCategory;
    const key = blockCategories[id];
    if (!key) return '';
    const label = t(`grapesjs-mjml.categories.${key}`);
    return { id: key, label: label || key, open: key !== 'advanced' };
  };

  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = blockIconCss;
    document.head.appendChild(style);
  }

  // Blocks are collected and added at the end, grouped by category: the
  // block panel creates category sections in the order blocks are added.
  const pending: [string, BlockProperties][] = [];
  const addBlock = (id: string, def: BlockProperties) => {
    opts.blocks.indexOf(id)! >= 0 && pending.push([id, {
      select: true,
      category: categoryOf(id) as any,
      media: blockIcons[id],
      ...def,
      ...opts.block(id),
    }]);
  };

  // @ts-ignore
  const getI18nLabel = (label: string) => editor.I18n.t(`grapesjs-mjml.components.names.${label}`)

  addBlock('mj-1-column', {
    label: getI18nLabel('oneColumn'),
    content: `<mj-section>
        <mj-column><mj-text>Content 1</mj-text></mj-column>
      </mj-section>`,
  });

  addBlock('mj-2-columns', {
    label: getI18nLabel('twoColumn'),
    content: `<mj-section>
      <mj-column><mj-text>Content 1</mj-text></mj-column>
      <mj-column><mj-text>Content 2</mj-text></mj-column>
    </mj-section>`,
  });

  addBlock('mj-3-columns', {
    label: getI18nLabel('threeColumn'),
    content: `<mj-section>
        <mj-column><mj-text>Content 1</mj-text></mj-column>
        <mj-column><mj-text>Content 2</mj-text></mj-column>
        <mj-column><mj-text>Content 3</mj-text></mj-column>
      </mj-section>`,
  });

  addBlock('mj-text', {
    label: getI18nLabel('text'),
    content: '<mj-text>Insert text here</mj-text>',
    activate: true,
  });

  addBlock('mj-button', {
    label: getI18nLabel('button'),
    content: '<mj-button>Button</mj-button>',
  });

  addBlock('mj-image', {
    label: getI18nLabel('image'),
    content: `<mj-image src="${imagePlaceholderSrc}"/>`,
    activate: true,
  });

  addBlock('mj-divider', {
    label: getI18nLabel('divider'),
    content: '<mj-divider/>',
  });

  addBlock('mj-social-group', {
    label: getI18nLabel('socialGroup'),
    content: `<mj-social font-size="12px" icon-size="24px" border-radius="12px" mode="horizontal">
        <mj-social-element name="facebook"></mj-social-element>
        <mj-social-element name="google"></mj-social-element>
        <mj-social-element name="twitter"></mj-social-element>
      </mj-social>`,
  });

  addBlock('mj-social-element', {
    label: getI18nLabel('socialElement'),
    content: '<mj-social-element name="facebook" />',
  });

  addBlock('mj-spacer', {
    label: getI18nLabel('spacer'),
    content: '<mj-spacer/>',
  });

  addBlock('mj-navbar', {
    label: getI18nLabel('navBar'),
    content: `<mj-navbar>
      <mj-navbar-link>Getting started</mj-navbar-link>
      <mj-navbar-link>Try it live</mj-navbar-link>
      <mj-navbar-link>Templates</mj-navbar-link>
      <mj-navbar-link>Components</mj-navbar-link>
    </mj-navbar>`,
  });

  addBlock('mj-navbar-link', {
    label: getI18nLabel('navLink'),
    content: `<mj-navbar-link>Link</mj-navbar-link>`,
  });

  addBlock('mj-hero', {
    label: getI18nLabel('hero'),
    content: `<mj-hero mode="fixed-height" height="469px" background-width="600px" background-height="469px" background-url="https://cloud.githubusercontent.com/assets/1830348/15354890/1442159a-1cf0-11e6-92b1-b861dadf1750.jpg" background-color="#2a3448" padding="100px 0px">
      <mj-text padding="20px" color="#ffffff" font-family="Helvetica" align="center" font-size="45px" line-height="45px" font-weight="900">
        GO TO SPACE
      </mj-text>
      <mj-button href="https://mjml.io/" align="center">
        ORDER YOUR TICKET NOW
      </mj-button>
    </mj-hero>`,
  });

  addBlock('mj-wrapper', {
    label: getI18nLabel('wrapper'),
    content: `<mj-wrapper border="1px solid #000000" padding="50px 30px">
      <mj-section border-top="1px solid #aaaaaa" border-left="1px solid #aaaaaa" border-right="1px solid #aaaaaa" padding="20px">
        <mj-column>
          <mj-image padding="0" src="${imagePlaceholderSrc}" />
        </mj-column>
      </mj-section>
      <mj-section border-left="1px solid #aaaaaa" border-right="1px solid #aaaaaa" padding="20px" border-bottom="1px solid #aaaaaa">
        <mj-column border="1px solid #dddddd">
          <mj-text padding="20px"> First line of text </mj-text>
          <mj-divider border-width="1px" border-style="dashed" border-color="lightgrey" padding="0 20px" />
          <mj-text padding="20px"> Second line of text </mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>`,
  });

  addBlock('mj-group', {
    label: getI18nLabel('group'),
    content: `<mj-section>
      <mj-group>
        <mj-column><mj-text>Content 1</mj-text></mj-column>
        <mj-column><mj-text>Content 2</mj-text></mj-column>
      </mj-group>
    </mj-section>`,
  });

  addBlock('mj-table', {
    label: getI18nLabel('table'),
    content: `<mj-table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-right: 12px; vertical-align: middle;" width="52">
          <img src="https://placehold.co/80x80/png" width="40" height="40" style="display: block; width: 40px; height: 40px; border-radius: 50%;" />
        </td>
        <td style="vertical-align: middle;">
          <div style="font-size: 14px; font-weight: bold;">Title</div>
          <div style="font-size: 13px; color: #6b7280;">Text next to the logo</div>
        </td>
      </tr>
    </mj-table>`,
  });

  // Icon cards: plain sections made of real, individually editable parts
  // (see components/IconCard.ts for the card-level layout settings).
  const cardIcon = 'https://placehold.co/120x120/3b82f6/ffffff/png?text=Icon';
  const cardSide = (position: 'left' | 'right') => {
    const icon = `<mj-column width="12.67%" ${position === 'left' ? 'padding-right' : 'padding-left'}="16px" vertical-align="middle">
          <mj-image src="${cardIcon}" width="60px" padding="0" border-radius="50%" alt=""></mj-image>
        </mj-column>`;
    const content = `<mj-column width="87.33%" vertical-align="middle">
          <mj-text padding="0" font-size="18px" font-weight="bold" line-height="26px" color="#1f2d3d">Card title</mj-text>
          <mj-text padding="4px 0 0 0" font-size="15px" line-height="22px" color="#5b6b7b">A short description goes here.</mj-text>
        </mj-column>`;
    return `<mj-section css-class="icon-card" padding="12px 0">
      <mj-group>
        ${position === 'left' ? icon + content : content + icon}
      </mj-group>
    </mj-section>`;
  };

  addBlock('mj-icon-card', {
    label: getI18nLabel('iconCard'),
    content: cardSide('left'),
  });

  addBlock('mj-icon-card-right', {
    label: getI18nLabel('iconCardRight'),
    content: cardSide('right'),
  });

  addBlock('mj-icon-card-top', {
    label: getI18nLabel('iconCardTop'),
    content: `<mj-section css-class="icon-card" padding="24px 16px" background-color="#f3f6fb" border-radius="12px">
      <mj-column>
        <mj-image src="${cardIcon}" width="64px" padding="0 0 16px 0" border-radius="50%" align="center" alt=""></mj-image>
        <mj-text align="center" padding="0" font-size="20px" font-weight="bold" line-height="26px" color="#1f2d3d">Feature title</mj-text>
        <mj-text align="center" padding="8px 0 0 0" font-size="15px" line-height="22px" color="#5b6b7b">Describe the feature in a sentence or two.</mj-text>
      </mj-column>
    </mj-section>`,
  });

  addBlock('mj-accordion', {
    label: getI18nLabel('accordion'),
    content: `<mj-accordion>
      <mj-accordion-element>
        <mj-accordion-title>Why use an accordion?</mj-accordion-title>
        <mj-accordion-text>Because emails are boring without it.</mj-accordion-text>
      </mj-accordion-element>
    </mj-accordion>`,
  });

  addBlock('mj-carousel', {
    label: getI18nLabel('carousel'),
    content: `<mj-carousel>
      <mj-carousel-image src="${imagePlaceholderSrc}" />
      <mj-carousel-image src="${imagePlaceholderSrc}" />
    </mj-carousel>`,
  });

  addBlock('mj-raw', {
    label: getI18nLabel('raw'),
    content: `<mj-raw>
      <div class="container">
        <img class="item" src="https://source.unsplash.com/random/200x141" alt="Example image">
        <img class="item" src="https://source.unsplash.com/random/200x142" alt="Example image">
        <img class="item" src="https://source.unsplash.com/random/200x143" alt="Example image">
        <img class="item" src="https://source.unsplash.com/random/200x144" alt="Example image">
        <img class="item" src="https://source.unsplash.com/random/200x145" alt="Example image">
        <img class="item" src="https://source.unsplash.com/random/200x146" alt="Example image">
      </div>
    </mj-raw>`,
  });

  const rank = (id: string) => {
    const index = categoryOrder.indexOf(blockCategories[id]);
    return index < 0 ? categoryOrder.length : index;
  };
  pending
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (legacyCategory ? 0 : rank(a.entry[0]) - rank(b.entry[0])) || a.index - b.index)
    .forEach(({ entry: [id, def] }) => Blocks.add(id, def));
};
