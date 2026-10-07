// Custom trait types shared by components:
// - `mj-trait-group`: a non-editable heading (icon + label) used to split long
//   trait lists into sections. It never reads/writes an attribute.
// - `mj-image-picker`: URL input + thumbnail + "Browse" button that opens the
//   Asset Manager and writes the chosen image back to the attribute.
import type { Editor } from 'grapesjs';
import { RequiredPluginOptions } from '.';
import { uiIcon, UiIconName } from './icons';

export const traitGroup = 'mj-trait-group';
export const traitImagePicker = 'mj-image-picker';

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
  .gjs-field-${traitGroup}, .gjs-field-${traitImagePicker} {
    background: none !important; border: 0 !important; box-shadow: none !important; padding: 0 !important;
  }
  .mj-trait-group {
    display: flex; align-items: center; gap: 8px; width: 100%;
    font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    opacity: .85;
  }
  .mj-trait-group svg { width: 16px; height: 16px; flex: none; }
  .mj-image-picker { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .mj-image-picker__row { display: flex; gap: 6px; align-items: center; }
  .mj-image-picker__thumb {
    width: 34px; height: 34px; flex: none; border-radius: 4px; cursor: pointer;
    background: rgba(0,0,0,.25) center / contain no-repeat;
    border: 1px solid rgba(255,255,255,.12);
  }
  .mj-image-picker input {
    flex: 1; min-width: 0; box-sizing: border-box; padding: 5px 6px;
    background: rgba(0,0,0,.2); border: 1px solid rgba(255,255,255,.08);
    border-radius: 3px; color: inherit; font: inherit;
  }
  .mj-image-picker button {
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    padding: 5px 8px; border-radius: 3px; cursor: pointer; font: inherit; font-size: 11px;
    color: inherit; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
  }
  .mj-image-picker button:hover { background: rgba(255,255,255,.16); }
  .mj-image-picker button svg { width: 14px; height: 14px; }
`;

/** Open the Asset Manager for images and call `onPick` with the chosen URL. */
export const pickImage = (editor: Editor, onPick: (src: string) => void) => {
  editor.runCommand('open-assets', {
    types: ['image'],
    select(asset: any, complete: boolean) {
      onPick(asset.getSrc ? asset.getSrc() : asset.get('src'));
      complete && editor.Modal.close();
    },
  });
};

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

  TraitManager.addType(traitImagePicker, {
    createInput({ trait }: any) {
      const el = document.createElement('div');
      el.className = 'mj-image-picker';
      el.innerHTML = `
        <div class="mj-image-picker__row">
          <div class="mj-image-picker__thumb" title="Browse images"></div>
          <input type="text" placeholder="${trait.get('placeholder') || 'https://…'}"/>
        </div>
        <div class="mj-image-picker__row">
          <button type="button" data-browse>${uiIcon('image')}<span>Browse…</span></button>
        </div>`;
      const browse = () =>
        pickImage(editor, (src) => {
          const input = el.querySelector('input')!;
          input.value = src;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      el.querySelector('[data-browse]')!.addEventListener('click', browse);
      el.querySelector('.mj-image-picker__thumb')!.addEventListener('click', browse);
      return el;
    },
    onEvent({ elInput, component, trait }: any) {
      const value = elInput.querySelector('input').value.trim();
      component.addAttributes({ [trait.get('name')]: value });
    },
    onUpdate({ elInput, component, trait }: any) {
      const value = component.getAttributes()[trait.get('name')] || '';
      const input = elInput.querySelector('input');
      if (input.value !== value) input.value = value;
      const thumb = elInput.querySelector('.mj-image-picker__thumb');
      // cid:/merge-tag sources can't be previewed; show the empty frame.
      thumb.style.backgroundImage = /^(https?:|data:|\/)/.test(value) ? `url("${value.replace(/"/g, '%22')}")` : '';
    },
  } as any);
};
