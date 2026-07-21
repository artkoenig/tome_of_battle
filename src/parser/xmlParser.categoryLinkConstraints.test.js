import { describe, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseGameSystemXML } from './xmlParser.js';

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

// Kategorielimits eines Kontingents und die Modifier, die sie verschieben, hängen im
// .gst an den categoryLinks. Übergeht der Parser sie, kennt der Solver anschließend
// weder das Limit noch dessen Anhebung.
describe('parseGameSystemXML — Constraints und Modifier an categoryLinks', () => {
  const CONSTRAINT_ID = 'max-hq';
  const CATEGORY_LINK_ID = 'cl-hq';

  const gameSystemXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="sys-123" name="Test System" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <forceEntries>
    <forceEntry id="force-patrol" name="Patrol">
      <categoryLinks>
        <categoryLink id="${CATEGORY_LINK_ID}" name="HQ" targetId="cat-hq" primary="false">
          <constraints>
            <constraint id="${CONSTRAINT_ID}" type="max" value="2" field="selections" scope="parent" shared="true"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${CONSTRAINT_ID}" value="3">
              <conditions>
                <condition field="limit::pts" value="2000" type="greaterThan"/>
              </conditions>
            </modifier>
          </modifiers>
        </categoryLink>
      </categoryLinks>
    </forceEntry>
  </forceEntries>
</gameSystem>
`;

  const parseCategoryLink = () =>
    parseGameSystemXML(gameSystemXml).forceEntries[0].categoryLinks[0];

  test('übernimmt das Constraint des categoryLinks samt ID', () => {
    const constraints = parseCategoryLink().constraints;

    expect(constraints).toHaveLength(1);
    expect(constraints[0].id).toBe(CONSTRAINT_ID);
    expect(constraints[0].type).toBe('max');
  });

  test('übernimmt den Modifier, der auf dieses Constraint zielt', () => {
    const modifiers = parseCategoryLink().modifiers;

    expect(modifiers).toHaveLength(1);
    expect(modifiers[0].field).toBe(CONSTRAINT_ID);
    expect(modifiers[0].type).toBe('set');
  });
});
