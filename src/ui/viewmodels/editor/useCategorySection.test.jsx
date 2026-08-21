import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useCategorySection } from './useCategorySection';
import { createRosterProviderWrapper, createEmptyRosterReport } from '../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests der Kategorie-Sektion (Issue 0164).
 *
 * Im Mittelpunkt steht die **Sichtbarkeitsregel**, die bis dahin zwischen zwei
 * `return null` im Render lag: beide Antworten stehen am Kontingent-Slot des
 * Berichts — `isHidden` am Kategorie-Anker, und ob irgendein Einheiten-Slot
 * diese Kategorie als effektive Primärkategorie führt. Steht etwas in der
 * Kategorie, erscheint sie in beiden Fällen.
 */

const CATEGORY = 'cat-core';
const CATEGORY_LINK = { id: 'cl-core', targetId: CATEGORY, name: 'Kern (Verweis)' };
const SYSTEM = { categoryEntries: [{ id: CATEGORY, name: 'Kern' }] };

const anchor = (over = {}) => ({
  anchorKind: 'categoryAnchor',
  isIndependentSubUnit: false,
  primaryCategoryId: null,
  defId: CATEGORY,
  targetDefId: null,
  name: 'Kern',
  isHidden: false,
  current: 0,
  effectiveMin: null,
  effectiveMax: null,
  ...over,
});

const unitSlot = (over = {}) => ({
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  defId: 'e-knight',
  name: 'Ritter',
  isHidden: false,
  primaryCategoryId: CATEGORY,
  ...over,
});

const renderSection = ({ capabilities = new Map(), selections = [], violations = [] } = {}) =>
  renderHook(
    () => useCategorySection({
      force: { id: 'f1', selections },
      forcePath: '0',
      categoryLink: CATEGORY_LINK,
    }),
    {
      wrapper: createRosterProviderWrapper({
        report: createEmptyRosterReport({ capabilities, violations }),
        roster: { forces: [{ id: 'f1', selections }] },
        system: SYSTEM,
      }),
    }
  );

describe('useCategorySection — Sichtbarkeit', () => {
  it('sichtbarer Anker mit einem Einheiten-Slot: die Sektion erscheint', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor()], ['0/1', unitSlot()]]),
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.categoryName).toBe('Kern');
  });

  it('versteckter Anker, nichts ausgewählt: keine Sektion', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor({ isHidden: true })], ['0/1', unitSlot()]]),
    });

    expect(result.current.isVisible).toBe(false);
  });

  it('versteckter Anker, aber eine Auswahl darin: die Sektion erscheint doch', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor({ isHidden: true })], ['0/1', unitSlot()]]),
      selections: [{ id: 'sel-1', category: CATEGORY }],
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.selections.map(s => s.id)).toEqual(['sel-1']);
  });

  it('kein Einheiten-Slot führt die Kategorie und nichts ausgewählt: ein reines Regel-Schlagwort', () => {
    const { result } = renderSection({
      capabilities: new Map([
        ['0/0', anchor()],
        ['0/1', unitSlot({ primaryCategoryId: 'cat-characters' })],
      ]),
    });

    expect(result.current.isVisible).toBe(false);
  });

  it('kein Einheiten-Slot, aber eine Auswahl darin: die Sektion erscheint', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor()]]),
      selections: [{ id: 'sel-1', category: CATEGORY }],
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('gar kein Anker im Bericht: nicht versteckt, aber auch kein Slot — keine Sektion', () => {
    const { result } = renderSection({ capabilities: new Map() });

    expect(result.current.isVisible).toBe(false);
  });
});

describe('useCategorySection — Zähl-Chip und Art der Gruppe', () => {
  it('liest Stand und wirksame Grenzen vom Kategorie-Anker', () => {
    const { result } = renderSection({
      capabilities: new Map([
        ['0/0', anchor({ current: 2, effectiveMin: 1, effectiveMax: 3 })],
        ['0/1', unitSlot()],
      ]),
    });

    expect(result.current.badge).toEqual({ count: 2, min: 1, max: 3, hasErrors: false });
  });

  it('meldet einen Fehler am Chip, wenn eine blockierende Verletzung an diesem Anker hängt', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor()], ['0/1', unitSlot()]]),
      violations: [{
        severity: 'error',
        anchor: { anchorKind: 'categoryAnchor', defId: CATEGORY },
      }],
    });

    expect(result.current.badge.hasErrors).toBe(true);
  });

  it('ein Hinweis (warning) am selben Anker färbt den Chip nicht', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor()], ['0/1', unitSlot()]]),
      violations: [{
        severity: 'warning',
        anchor: { anchorKind: 'categoryAnchor', defId: CATEGORY },
      }],
    });

    expect(result.current.badge.hasErrors).toBe(false);
  });

  it('eine Kategorie, deren Angebot durchweg Listenregeln sind, ist eine Ankreuzliste', () => {
    const { result } = renderSection({
      capabilities: new Map([
        ['0/0', anchor()],
        ['0/1', unitSlot({ defId: 'e-rule', name: 'Regel', isListRule: true })],
      ]),
    });

    expect(result.current.isListRuleGroup).toBe(true);
  });

  it('eine Kategorie mit gewöhnlichen Einheiten ist keine Ankreuzliste', () => {
    const { result } = renderSection({
      capabilities: new Map([['0/0', anchor()], ['0/1', unitSlot()]]),
    });

    expect(result.current.isListRuleGroup).toBe(false);
  });
});
