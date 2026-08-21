import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { processImportedData } from '../../../data/parser/xmlParser';
import { publicationRefOf, upgradeDetailElementsOf } from './upgradeDetailElements.js';

/**
 * Der Detailblock einer Aufwertung entsteht allein aus der Info-Projektion
 * ihres Slots (`capability.infoElements`) und dessen eigener Buchquelle
 * (`capability.source`). Die frueher hier haengende Namenssuche in den
 * geteilten Regeln des Systems ist ersatzlos entfallen (Issue 0173).
 */

const capabilityOf = (overrides = {}) => ({
  name: 'Schwert der Macht',
  infoElements: [],
  source: null,
  ...overrides,
});

const rule = (overrides = {}) => ({
  kind: 'rule', id: 'r-1', name: 'Schwert der Macht', source: null, text: 'Ein maechtiges Schwert.',
  ...overrides,
});

const profile = (overrides = {}) => ({
  kind: 'profile', id: 'p-1', name: 'Schwert der Macht', source: null,
  profileTypeName: 'Magic Item', characteristics: [],
  ...overrides,
});

describe('upgradeDetailElementsOf', () => {
  it('gibt es ohne Slot keinen Block — und mit leerer Projektion einen leeren', () => {
    expect(upgradeDetailElementsOf(null)).toBeNull();
    expect(upgradeDetailElementsOf(capabilityOf())).toEqual([]);
  });

  it('beschriftet den Regeltext des Slots selbst als „Beschreibung", einen fremden mit seinem Namen', () => {
    const elements = upgradeDetailElementsOf(capabilityOf({
      infoElements: [rule(), rule({ id: 'r-2', name: 'Zorn des Waldes', text: 'Geerbt.' })],
    }));

    expect(elements.map(e => [e.labelKey, e.labelParams, e.text])).toEqual([
      ['editor.details.description', undefined, 'Ein maechtiges Schwert.'],
      ['editor.details.descriptionNamed', { name: 'Zorn des Waldes' }, 'Geerbt.'],
    ]);
  });

  it('vergleicht die Namen nur bis auf Satzzeichen und Grossschreibung, nicht per Teilstring', () => {
    const named = (ruleName) => upgradeDetailElementsOf(capabilityOf({
      name: 'Zorn-Ruf!', infoElements: [rule({ name: ruleName })],
    }))[0];

    expect(named('zorn ruf').labelKey).toBe('editor.details.description');
    expect(named('Der grosse Zorn-Ruf').labelKey).toBe('editor.details.descriptionNamed');
  });

  it('trennt die Sonderregeln eines Aufwertungsprofils von seinen uebrigen Merkmalen', () => {
    const elements = upgradeDetailElementsOf(capabilityOf({
      infoElements: [profile({
        characteristics: [
          { name: 'Special Rules', value: 'Magische Attacken' },
          { name: 'Reichweite', value: 'Nahkampf' },
          { name: 'Staerke', value: '-' },
        ],
      })],
    }));

    expect(elements).toEqual([
      expect.objectContaining({ labelKey: 'editor.details.specialRules', text: 'Magische Attacken' }),
      expect.objectContaining({ labelKey: 'editor.details.profile', text: 'Reichweite: Nahkampf' }),
    ]);
  });

  it('ueberspringt ein Profil, dessen Profilart keine Aufwertung ist', () => {
    const elements = upgradeDetailElementsOf(capabilityOf({
      infoElements: [profile({
        profileTypeName: 'Model', characteristics: [{ name: 'BF', value: '3' }],
      })],
    }));

    expect(elements).toEqual([]);
  });

  it('haengt die Buchquelle an ihren Eintrag und wiederholt sie am Profil nicht', () => {
    const source = { publicationId: 'pub-1', publicationName: 'Armeebuch', page: '44' };
    const elements = upgradeDetailElementsOf(capabilityOf({
      infoElements: [
        rule({ source }),
        profile({ source, characteristics: [{ name: 'Reichweite', value: 'Nahkampf' }] }),
      ],
    }));

    expect(elements[0].source).toBe('[Armeebuch, S. 44]');
    expect(elements[1].source).toBeNull();
  });

  it('zeigt die eigene Quelle des Slots nur, wo kein Info-Element eine nennt', () => {
    const source = { publicationId: 'pub-1', publicationName: 'Armeebuch', page: '44' };
    const alone = upgradeDetailElementsOf(capabilityOf({ source }));
    expect(alone).toEqual([expect.objectContaining({ kind: 'source', source: '[Armeebuch, S. 44]' })]);

    const withRule = upgradeDetailElementsOf(capabilityOf({
      source, infoElements: [rule({ source: { publicationId: 'pub-2', publicationName: 'Regelbuch', page: '7' } })],
    }));
    expect(withRule.some(element => element.kind === 'source')).toBe(false);
  });
});

describe('upgradeDetailElementsOf am eingefrorenen Korpus', () => {
  const FIXTURE_DIR = path.resolve(__dirname, '../../../domain/evaluator/__fixtures__/whfb6-definitive');
  const GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
  const CAT = 'Vampire Counts (6th definitive edition).cat';

  /**
   * Vier Aufwertungen dieses Armeebuchs haengen ihre Beschreibung an eine
   * gleichnamige, von keinem `infoLink` erreichte Regel. Sie sind der Fall, den
   * AC4 unveraendert verlangt.
   */
  let parsed = null;
  /** Der Korpus wird einmal je Datei geparst — der Parse dominiert die Laufzeit. */
  const loadVampireCounts = () => {
    parsed ??= processImportedData(
      [{ name: GST, content: fs.readFileSync(path.join(FIXTURE_DIR, GST), 'utf8') }],
      [{ name: CAT, content: fs.readFileSync(path.join(FIXTURE_DIR, CAT), 'utf8') }],
    ).system;
    return parsed;
  };

  it('zeigt die Beschreibung der vier unverlinkten Regeln des Vampirfuersten-Buchs', () => {
    const system = loadVampireCounts();
    const catalogueId = system.catalogues[0].id;

    const textOf = (name) => upgradeDetailElementsOf(
      { name, infoElements: [], source: null }, system, catalogueId,
    )[0];

    expect(textOf('Frostblade')).toMatchObject({
      labelKey: 'editor.details.description',
      text: expect.stringContaining('FROSTBLADE 100 points'),
      // Die Regel haengt an keinem Traeger dieses Slots und nennt fuer ihn
      // deshalb auch keine Buchquelle.
      source: null,
    });
    for (const name of ['Bloodlines', 'Special Characters', 'Experimental rules']) {
      expect(textOf(name)?.text, name).toEqual(expect.any(String));
    }
  });

  it('greift nicht, wo der Slot einen eigenen Regeltext traegt — und nicht ohne Rahmen', () => {
    const system = loadVampireCounts();

    const withOwnRule = upgradeDetailElementsOf(
      capabilityOf({ name: 'Frostblade', infoElements: [rule({ name: 'Frostblade', text: 'Eigener Text.' })] }),
      system, system.catalogues[0].id,
    );
    expect(withOwnRule.map(e => e.text)).toEqual(['Eigener Text.']);

    expect(upgradeDetailElementsOf(capabilityOf({ name: 'Frostblade' }))).toEqual([]);
  });
});

describe('publicationRefOf', () => {
  it('schreibt Buch und Seite so, wie die Oberflaeche sie seit je zeigt', () => {
    expect(publicationRefOf({ publicationName: 'Armeebuch', page: '44' })).toBe('[Armeebuch, S. 44]');
    expect(publicationRefOf({ publicationName: 'Armeebuch', page: null })).toBe('[Armeebuch]');
    expect(publicationRefOf({ publicationName: null, page: '44' })).toBe('[S. 44]');
    expect(publicationRefOf({ publicationName: null, page: null })).toBeNull();
    expect(publicationRefOf(null)).toBeNull();
  });
});
