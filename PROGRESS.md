# Autonomous runs — progress & decisions

Scope (agreed 2026-10-07): make `mj-icon-text` fully editable from the UI, and a
consistent SVG icon set for the editor UI (block thumbnails, categories).

## Done
- [x] `mj-icon-text`: grouped traits with section icons, Asset Manager image
      picker, inline canvas editing, layout/typography/card/link options,
      MJML round-trip via a meta comment.
- [x] Editor UI icons: a consistent two-tone 48px SVG thumbnail set for every
      block (`src/blockIcons.ts`), blocks grouped into categories (Layout,
      Content, Cards, Navigation & social, Interactive, Advanced), and two card
      presets: *Icon text (right)* and *Feature card* (icon on top, tinted
      rounded card).

## Decisions (review these)
- **Round-trip format**: export is `<!-- mj-icon-text {json} -->` followed by
  the standard `<mj-section>`. The comment also ends up in compiled HTML
  (MJML keeps comments). Alternative would be a `css-class` marker, but that
  leaks into HTML classes and can't carry the settings.
- **No empty-string attribute values** on `mj-icon-text`: the core mirrors
  attributes into an inline style string that drops empty values, and that
  mismatch made `addAttributes` re-apply stale values (edits silently lost).
  The component drops empty values in `setAttributes` (absent == empty).
- **Icon position "top"**: image is `display:inline-block` with fixed px width
  so `align` on the cell centers it (Outlook-safe; no `margin:auto`).
- **Shape** select offers Square / Rounded (8px) / Circle (50%); any other value
  can still be set via code.
- **Font list**: web-safe stacks only (Arial, Helvetica, Verdana, Tahoma,
  Trebuchet, Georgia, Times, Courier).
- **Inline editing is plain text** (no bold/links inside), because the values
  live in attributes. Whitespace is collapsed; Enter commits.
- **Categories**: blocks are added sorted by category because the block panel
  ignores category `order` and creates sections in insertion order. A
  non-empty `grapesjs-mjml.category` translation still forces the old single
  flat list (back-compat). *Advanced* (Raw) starts collapsed.
- **Presets are blocks, not new components**: *Icon text (right)* and
  *Feature card* drop an `mj-icon-text` with preset attributes, so everything
  stays editable with the same settings.
- Only `en` has labels for the new categories/presets; other locales fall back
  to English.
- Demo `index.html` now seeds the Asset Manager with a few placeholder images.

## Known / pre-existing
- `npm run lint` fails on every `.ts` file (ESLint has no TypeScript parser
  configured). Not changed.


---

# Run 2 (2026-10-08): composable icon card + top bar

Agreed: replace the opaque `mj-icon-text` with a card made of real components
(title/description are `mj-text`, icon is `mj-image`, more can be dropped in),
remove `mj-icon-text` entirely, then redesign the top bar device switcher and
make it the only device switch.

## Done
- [x] `mj-icon-card` (section with `css-class="icon-card"`): card layout traits
      (icon left/right/top, size, gap, align, stack on mobile) that restructure
      the real children; blocks *Icon card*, *Icon card (right)*, *Feature card*.
- [x] `mj-icon-text` removed (component, blocks, tests, locale keys, demo).

## Decisions (review these)
- **Percent column widths**, computed from body width − wrapper/card padding.
  px widths become `width:Npx !important` above MJML's breakpoint and overflow
  between 480px and 600px (that's also why the demo's px-width group footer
  rendered stacked). Consequence: in a side-by-side card the icon scales with
  the screen (60px at 600px wide, ~40px at 480px) unless you add a per-device
  image width override.
- **Layout is derived, not stored**: the icon column is the narrowest column;
  "top" = a single column whose first child is an `mj-image`. Hand-written
  MJML with the marker class is recognised.
- The marker `icon-card` class appears in the HTML (harmless; MJML can't carry
  custom attributes).
- **Core fix — `padding` shorthand vs default longhands**: components merged
  their type's default `padding-*` longhands into the attributes, and since
  MJML lets longhands win, `<mj-image padding="0">` previewed with 25px sides
  (and mj-text was indented). Defaults are no longer merged when the source
  sets `padding`. Affects every MJML component's canvas preview (export was
  already right).
- **Core fix — stale `style` on `addAttributes`**: `addAttributes` merges in a
  `style` string serialized from the previous values and the core parsed it
  back, reverting the update in some flows. MJML components now drop the
  `style` key in `setAttributes` (generalises run 1's local fix).
- Removed the now-unused `mj-image-picker` trait (mj-image already opens the
  Asset Manager on double-click) and unused UI icons.
