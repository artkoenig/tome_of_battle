// Issue 0203: the mobile top bars of the roster builder and of play mode must
// reserve the top safe-area inset, or the iPhone status bar covers their back
// buttons in the installed PWA. Headless browsers report the inset as 0, so a
// Puppeteer check cannot see the defect; this test reads the stylesheets instead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const MOBILE_MEDIA = /@media\s*\(\s*max-width:\s*900px\s*\)/;

/** @returns {string[]} the style layer files in cascade order, as `src/index.css` imports them */
function stylesheetsInCascadeOrder() {
  const index = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
  return [...index.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => join(ROOT, 'src', m[1]));
}

/**
 * Returns the body of the block whose `{` sits at `open`.
 * @param {string} css
 * @param {number} open
 */
function blockBody(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unbalanced braces');
}

/**
 * Every declaration of `selector` (exact, sole selector) inside a mobile media block, across all
 * stylesheets in cascade order.
 * @param {string} selector
 * @returns {{ property: string, value: string }[]}
 */
function mobileDeclarations(selector) {
  /** @type {{ property: string, value: string }[]} */
  const declarations = [];
  for (const file of stylesheetsInCascadeOrder()) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const media of css.matchAll(new RegExp(MOBILE_MEDIA.source, 'g'))) {
      const body = blockBody(css, css.indexOf('{', media.index));
      for (const rule of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (rule[1].trim() !== selector) continue;
        for (const decl of rule[2].split(';')) {
          const colon = decl.indexOf(':');
          if (colon < 0) continue;
          declarations.push({
            property: decl.slice(0, colon).trim(),
            value: decl.slice(colon + 1).replace(/!important/, '').trim(),
          });
        }
      }
    }
  }
  return declarations;
}

describe('safe-area-top-bars', () => {
  it.each(['.builder-top-bar', '.play-header'])(
    '%s pads its top edge by its spacing plus env(safe-area-inset-top) on mobile',
    (selector) => {
      const padding = mobileDeclarations(selector).filter(
        (d) => d.property === 'padding' || d.property === 'padding-top',
      );
      expect(padding.length, `${selector} has no mobile padding rule`).toBeGreaterThan(0);

      // The declaration that wins the cascade must carry the inset.
      const winner = padding[padding.length - 1];
      expect(winner.property).toBe('padding-top');
      const match = winner.value.match(/^calc\(\s*(\d+px)\s*\+\s*env\(safe-area-inset-top,\s*0px\)\s*\)$/);
      expect(match, `${selector} padding-top is "${winner.value}"`).not.toBeNull();

      // Where the inset is 0, the bar keeps the spacing its shorthand gives it.
      const shorthand = padding.filter((d) => d.property === 'padding').pop();
      expect(shorthand, `${selector} lost its padding shorthand`).toBeDefined();
      expect(match?.[1]).toBe(shorthand?.value.split(/\s+/)[0]);
    },
  );
});
