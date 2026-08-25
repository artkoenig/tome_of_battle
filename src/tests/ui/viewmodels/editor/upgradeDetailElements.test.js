import { describe, it, expect } from 'vitest';
import { publicationRefOf, upgradeDetailElementsOf } from '../../../../ui/viewmodels/editor/upgradeDetailElements.js';

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

describe('upgradeDetailElementsOf ohne Rahmen', () => {
  it('sucht keine gleichnamige Regel mehr — ein Slot ohne Regelelement hat keinen Detailtext', () => {
    // Den Rueckfall auf die gleichnamige Regel des eigenen Katalogs traegt seit
    // Issue 0173 der Bericht: er steht als `kind: 'rule'` schon in
    // `infoElements` (`contexts/ruleengine/engine/infoProjection.namedRuleFallback.test.js`).
    // Die Oberflaeche greift dafuer nicht mehr in den Katalog.
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
