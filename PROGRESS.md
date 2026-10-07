# Autonomous run — progress & decisions

Scope (agreed 2026-10-07): make `mj-icon-text` fully editable from the UI, and a
consistent SVG icon set for the editor UI (block thumbnails, categories).

## Done
- [x] `mj-icon-text`: grouped traits with section icons, Asset Manager image
      picker, inline canvas editing, layout/typography/card/link options,
      MJML round-trip via a meta comment.

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
- Demo `index.html` now seeds the Asset Manager with a few placeholder images.

## Known / pre-existing
- `npm run lint` fails on every `.ts` file (ESLint has no TypeScript parser
  configured). Not changed.
