import {
  TAG_COLOR_PALETTE,
  colorForTag,
  colorIndexForTag,
  enableTagColorizer,
  matchTagPairs,
  parseTagTokens,
  pairForToken,
  tokenIndexAtOffset,
} from '../../src/codeEditor/tagColorizer';

describe('tagColorizer pure helpers', () => {
  test('same tag name always maps to the same color (case-insensitive)', () => {
    expect(colorIndexForTag('mj-section')).toBe(colorIndexForTag('mj-section'));
    expect(colorIndexForTag('MJ-SECTION')).toBe(colorIndexForTag('mj-section'));
    expect(colorForTag('mj-text')).toBe(colorForTag('mj-text'));
  });

  test('different tag names spread across the palette', () => {
    const indices = new Set(['mjml', 'mj-body', 'mj-section', 'mj-column', 'mj-text', 'mj-image', 'mj-button'].map((t) => colorIndexForTag(t)));
    expect(indices.size).toBeGreaterThan(1);
    expect(Math.max.apply(null, Array.from(indices))).toBeLessThan(TAG_COLOR_PALETTE.length);
  });

  test('parseTagTokens finds open + close names with stable offsets', () => {
    const src = '<mj-section><mj-text>Hi</mj-text></mj-section>';
    const tokens = parseTagTokens(src);
    expect(tokens.map((t) => `${t.isClose ? '/' : ''}${t.tagName}`)).toEqual([
      'mj-section',
      'mj-text',
      '/mj-text',
      '/mj-section',
    ]);
    // Offsets slice back to the tag name.
    tokens.forEach((t) => {
      expect(src.slice(t.startOffset, t.endOffset)).toBe(t.tagName);
    });
  });

  test('comments are ignored and self-closing tags never pair', () => {
    const src = '<!-- <mj-text>not a tag</mj-text> --><mj-section><mj-image src="a.png"/></mj-section>';
    const tokens = parseTagTokens(src);
    expect(tokens.map((t) => t.tagName)).toEqual(['mj-section', 'mj-image', 'mj-section']);
    const pairs = matchTagPairs(tokens);
    expect(pairs).toHaveLength(1);
    expect(tokens[pairs[0].openIndex].tagName).toBe('mj-section');
  });

  test('matchTagPairs pairs nested same-name tags and locates active pair', () => {
    const src = '<mjml><mj-body><mj-section><mj-column><mj-text>A</mj-text></mj-column></mj-section></mj-body></mjml>';
    const tokens = parseTagTokens(src);
    const pairs = matchTagPairs(tokens);
    // 5 open/close pairs (mj-image-style voids excluded here).
    expect(pairs).toHaveLength(5);
    const openIdx = tokens.findIndex((t) => t.tagName === 'mj-text' && !t.isClose);
    const atOpen = tokenIndexAtOffset(tokens, tokens[openIdx].startOffset);
    const pair = pairForToken(pairs, atOpen);
    expect(pair).toBeTruthy();
    expect(tokens[pair!.openIndex].tagName).toBe('mj-text');
    expect(tokens[pair!.closeIndex].tagName).toBe('mj-text');
  });
});

describe('enableTagColorizer (fake Monaco)', () => {
  function fakeMonacoModel(text: string) {
    const lines = text.split('\n');
    const offsetAt = (pos: any) => {
      let off = 0;
      for (let i = 0; i < pos.lineNumber - 1; i += 1) off += lines[i].length + 1;
      return off + pos.column - 1;
    };
    const positionAt = (off: number) => {
      let rest = off;
      for (let i = 0; i < lines.length; i += 1) {
        if (rest <= lines[i].length) return { lineNumber: i + 1, column: rest + 1 };
        rest -= lines[i].length + 1;
      }
      return { lineNumber: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
    };
    return {
      getValue: () => text,
      getPositionAt: positionAt,
      getOffsetAt: offsetAt,
    };
  }

  test('decorates each tag name and disposes cleanly', () => {
    const text = '<mj-section><mj-text>Hi</mj-text></mj-section>';
    const calls: any[] = [];
    const fakeMonaco: any = {
      Range: class {
        constructor(public sl: number, public sc: number, public el: number, public ec: number) {}
      },
      editor: { TrackedRangeStickiness: { NeverGrowsWhenTypingAtEdges: 1 } },
    };
    const editor: any = {
      getModel: () => fakeMonacoModel(text),
      getPosition: () => ({ lineNumber: 1, column: 1 }),
      deltaDecorations: jest.fn((old: string[], next: any[]) => {
        calls.push(next);
        return next.map((_, i) => `id-${calls.length}-${i}`);
      }),
      onDidChangeModelContent: jest.fn(() => ({ dispose: jest.fn() })),
      onDidChangeCursorPosition: jest.fn(() => ({ dispose: jest.fn() })),
    };
    const dispose = enableTagColorizer(fakeMonaco, editor);
    // First deltaDecorations call = per-tag colors (4 tag names).
    expect(editor.deltaDecorations).toHaveBeenCalled();
    expect(calls[0]).toHaveLength(4);
    expect(calls[0][0].options.inlineClassName).toMatch(/^mjml-tag-color-\d+$/);
    // Same tag name => same class for the open/close pair.
    const textClasses = calls[0].filter((d: any) => true).map((d: any) => d.options.inlineClassName);
    expect(textClasses.length).toBe(4);
    const callsBeforeDispose = (editor.deltaDecorations as jest.Mock).mock.calls.length;
    dispose();
    expect((editor.deltaDecorations as jest.Mock).mock.calls.length).toBeGreaterThan(callsBeforeDispose);
  });

  test('no-ops without a model (fallback textareas)', () => {
    const dispose = enableTagColorizer({}, { getModel: () => null, deltaDecorations: jest.fn() });
    expect(() => dispose()).not.toThrow();
  });
});
