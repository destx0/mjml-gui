# GrapesJS core (local fork)

Source of truth for the editor framework. Inline source — not an npm dependency.
`grapesjs` is resolved to `libs/grapesjs-core/src/index.ts` via `tsconfig paths`
and Jest `moduleNameMapper`. There is no separate build step for this folder.

- Upstream: https://github.com/GrapesJS/grapesjs
- Forked from: npm `grapesjs@0.21.2` (exact copy of `src/`, `locale/`)
- Date forked: 2026-10-06
- License: BSD-3-Clause (see `LICENSE`, copyright Artur Arseniev)

## Layout

- `src/` — editable TypeScript source. Modify here (eg. `src/navigator/view/ItemView.ts` for Layers rows, `src/dom_components/model/Component.ts` for toolbar/copyable rules).
- `locale/` — editor locales, imported directly by the app when needed.
- `README.upstream.md` — original upstream README, kept for reference.
- `package.json` — original upstream manifest, kept for reference only (its
  runtime deps are hoisted as root devDependencies; this folder is not installed).
- No `dist/` — intentionally deleted. Nothing here is prebuilt; root `npm test`
  and type-checking compile `src/` on the fly.

## Freeze policy

Pinned for email backwards-compatibility (2-3 years). Do not upgrade unless the editor chrome breaks in a new browser. Exported MJML/HTML is static and unaffected by this freeze.

## Workflows

- Modify: edit files under `libs/grapesjs-core/src/` and run root `npm test`.
  No build step — tests and types compile `src/` directly.
- Verify: root `npm test` must stay green. Plugin `src/` only uses
  `import type ... from 'grapesjs'`, so the plugin bundle does not embed core.
- Upstream sync (if ever needed): diff against npm `grapesjs@0.21.2`, never blind-overwrite local Layers/component changes.
