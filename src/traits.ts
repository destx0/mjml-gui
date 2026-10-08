// Custom trait type `mj-trait-group`: a non-editable heading (icon + label)
// used to split long trait lists into sections. It never reads/writes an
// attribute.
import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { uiIcon, UiIconName } from './icons';

export const traitGroup = 'mj-trait-group';

let groupSeq = 0;

/** Trait definition for a section heading. */
export const groupTrait = (label: string, iconName: UiIconName) => ({
  type: traitGroup,
  name: `__group-${++groupSeq}`,
  label,
  icon: iconName,
  changeProp: true,
});

const css = `
  .gjs-trt-trait--${traitGroup} {
    padding: 14px 10px 4px;
    border-top: 1px solid rgba(255,255,255,.06);
  }
  .gjs-trt-trait--${traitGroup}:first-child { border-top: 0; padding-top: 6px; }
  /* Custom inputs draw their own chrome: drop the core input box. */
  .gjs-field-${traitGroup} {
    background: none !important; border: 0 !important; box-shadow: none !important; padding: 0 !important;
  }
  .mj-trait-group {
    display: flex; align-items: center; gap: 8px; width: 100%;
    font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    opacity: .85;
  }
  .mj-trait-group svg { width: 16px; height: 16px; flex: none; }
`;

export default (editor: Editor, _opts: RequiredPluginOptions) => {
  const { TraitManager } = editor;

  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  TraitManager.addType(traitGroup, {
    noLabel: true,
    createInput({ trait }: any) {
      const el = document.createElement('div');
      el.className = 'mj-trait-group';
      el.innerHTML = `${uiIcon(trait.get('icon'))}<span>${trait.get('label') || ''}</span>`;
      return el;
    },
    // Display only: never sync with the component.
    onEvent() {},
    onUpdate() {},
  } as any);

};
