/**
 * Issue 81, Increment 1 — gegatterte Profilwert-Modifikatoren im Bericht des
 * Vampire-Count-Slots, an den echten `whfb6-definitive`-Katalogdaten
 * (Vampire Counts). Kriterien 2, 3 und 4 der Meldung: bei gewaehlter
 * Blood-Dragon-Blutlinie meldet der Slot WS um +2 veraendert und dieselbe
 * `modifierGroup` setzt Sv, Sv+ und A; ohne Blutlinie bleiben alle vier bei
 * ihrem Basiswert; ein nicht-numerischer `set`-Wert (z.B. eine Ruestungsrettung
 * `4+`/`5+`) erreicht den Bericht unveraendert in seiner Form.
 *
 * Beobachtungsstelle: der belegte Slot des Vampire Count
 * (`6822-0110-a7c9-cbb0`, `anchorKind: 'occupied'`, Pfad `0/0` im Standard-
 * Kontingent), sein `infoElements`-Eintrag mit `kind: 'profile'` und
 * `id: 'a106-4a05-36ea-cb01'` (der `infoLink`, der auf das geteilte Profil
 * `fabd-ef67-72f5-6b3f` zeigt), gelesen ueber die Charakteristik-NAMEN
 * ('WS', 'A', 'Sv', 'Sv+').
 *
 * Die Basiswerte werden nicht als Literale erwartet, sondern aus der rohen
 * Fixture-XML selbst abgeleitet (`evaluator.corpusLinkLocalChildren.test.js`
 * ist das Muster dafuer): eine einzige Funktion parst, liest die vier
 * Charakteristiken des Profils `fabd-ef67-72f5-6b3f` nach `typeId`, gibt
 * reine Werte zurueck und laesst kein DOM-Element ins Modul-Scope entkommen.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { AnchorKind, InfoElementKind } from '../../../domain/evaluator/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/domain/evaluator/__fixtures__/whfb6-definitive');
const GST_FILE = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const CAT_FILE = 'Vampire Counts (6th definitive edition).cat';

function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

// `<forceEntry name="Standard (VC-AB)">` der Vampire-Counts-`.cat`.
const VC_STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';
// `<selectionEntry type="unit" name="Vampire Count">`.
const VAMPIRE_COUNT_ID = '6822-0110-a7c9-cbb0';
// Der `infoLink`, der das geteilte Profil `fabd-ef67-72f5-6b3f` bezieht und die
// gegatterte `modifierGroup` traegt.
const PROFILE_LINK_ID = 'a106-4a05-36ea-cb01';
const PROFILE_ID = 'fabd-ef67-72f5-6b3f';

const BLOODLINES_ID = 'a56a-eb32-5a45-16fd';
const BLOOD_DRAGON_ID = '9fd9-e05c-ffcb-2c4d';
const STRIGOI_ID = 'ddfa-0d72-8557-6906';
const NECRARCH_ID = '5017-296d-edef-4562';

// typeId je Charakteristik des Profils `fabd-ef67-72f5-6b3f`.
const WS_TYPE_ID = 'f95b-da01-0578-3bdc';
const A_TYPE_ID = '6b9f-c8fe-8998-27e3';
const SV_TYPE_ID = 'f1be-e66c-d5e1-673c';
const SV_PLUS_TYPE_ID = 'd4a9-0ed4-d041-e54b';

/**
 * Die Basis-Charakteristikwerte des geteilten Profils `fabd-ef67-72f5-6b3f`,
 * abgeleitet aus der rohen Fixture-XML — nicht aus einem Engine-Modul ausser
 * der Fassade. Baut Index und Ableitung in einer Funktion; nur die reinen
 * Werte ueberleben, kein DOM-Element.
 */
function deriveBaseCharacteristics() {
  const parser = new DOMParser();
  const document = parser.parseFromString(fixture(CAT_FILE), 'text/xml');
  const profile = [...document.getElementsByTagNameNS('*', 'profile')].find(
    (element) => element.getAttribute('id') === PROFILE_ID,
  );
  const characteristics = [...profile.getElementsByTagNameNS('*', 'characteristic')];
  const valueOf = (typeId) => {
    const element = characteristics.find((c) => c.getAttribute('typeId') === typeId);
    return element.textContent;
  };
  return Object.freeze({
    WS: valueOf(WS_TYPE_ID),
    A: valueOf(A_TYPE_ID),
    Sv: valueOf(SV_TYPE_ID),
    'Sv+': valueOf(SV_PLUS_TYPE_ID),
  });
}

const BASE = deriveBaseCharacteristics();

let cachedDataset = null;
function preparedVampireCounts() {
  cachedDataset ??= prepareDataset({
    gameSystem: fixture(GST_FILE),
    catalogues: [fixture(CAT_FILE)],
  });
  return cachedDataset;
}

/** Ein Vampire Count im Standard-Kontingent, wahlweise mit einer Blutlinie. */
function evaluateVampireCount({ bloodlineId } = {}) {
  const children = [{ defId: VAMPIRE_COUNT_ID, count: 1, children: [] }];
  if (bloodlineId) {
    children.push({
      defId: BLOODLINES_ID,
      count: 1,
      children: [{ defId: bloodlineId, count: 1, children: [] }],
    });
  }
  return evaluateDataset(preparedVampireCounts(), {
    forces: [{ defId: VC_STANDARD_FORCE_ID, count: 1, children }],
  });
}

/** Der belegte Slot des Vampire Count im Standard-Kontingent (Pfad `0/0`). */
function vampireCountSlot(report) {
  const capability = report.capabilities.get('0/0');
  expect(capability?.defId, 'Slot 0/0 ist nicht der Vampire Count').toBe(VAMPIRE_COUNT_ID);
  expect(capability?.anchorKind, 'Slot 0/0 ist kein belegter Slot').toBe(AnchorKind.OCCUPIED);
  return capability;
}

/** Der Profil-Eintrag des gemeldeten `infoLink`s in `infoElements` des Slots. */
function profileEntryOf(capability) {
  const entry = capability.infoElements.find(
    (element) => element.kind === InfoElementKind.PROFILE && element.id === PROFILE_LINK_ID,
  );
  expect(entry, `infoElements traegt keinen Eintrag ${PROFILE_LINK_ID}`).toBeDefined();
  return entry;
}

/** Der effektive Wert einer Charakteristik im Profil-Eintrag, ueber ihren Namen. */
function characteristicValue(entry, name) {
  const characteristic = entry.characteristics.find((c) => c.name === name);
  expect(characteristic, `Charakteristik ${name} fehlt im Profil-Eintrag`).toBeDefined();
  return characteristic.value;
}

describe('Echte Katalogdaten: gegatterte Profilwert-Modifikatoren am Vampire Count (Issue 81)', () => {
  it('KONTROLLE: ohne Blutlinie meldet der Slot alle vier Basiswerte unveraendert (Kriterium 3)', () => {
    const report = evaluateVampireCount();
    const entry = profileEntryOf(vampireCountSlot(report));

    expect(characteristicValue(entry, 'WS')).toBe(BASE.WS);
    expect(characteristicValue(entry, 'A')).toBe(BASE.A);
    expect(characteristicValue(entry, 'Sv')).toBe(BASE.Sv);
    expect(characteristicValue(entry, 'Sv+')).toBe(BASE['Sv+']);
  });

  it('meldet mit der Blood-Dragon-Blutlinie WS als Basiswert + 2 und Sv als "4+"; Sv+ und A bleiben Basiswert (Kriterium 2, 4)', () => {
    const report = evaluateVampireCount({ bloodlineId: BLOOD_DRAGON_ID });
    const entry = profileEntryOf(vampireCountSlot(report));

    const ws = characteristicValue(entry, 'WS');
    expect(Number(ws)).toBe(Number(BASE.WS) + 2);
    expect(characteristicValue(entry, 'Sv')).toBe('4+');
    expect(characteristicValue(entry, 'Sv+')).toBe(BASE['Sv+']);
    expect(characteristicValue(entry, 'A')).toBe(BASE.A);
  });

  it('meldet mit der Strigoi-Blutlinie Sv+ als "5+" und A als Basiswert + 1; WS und Sv bleiben Basiswert (Kriterium 4)', () => {
    const report = evaluateVampireCount({ bloodlineId: STRIGOI_ID });
    const entry = profileEntryOf(vampireCountSlot(report));

    expect(characteristicValue(entry, 'Sv+')).toBe('5+');
    const a = characteristicValue(entry, 'A');
    expect(Number(a)).toBe(Number(BASE.A) + 1);
    expect(characteristicValue(entry, 'WS')).toBe(BASE.WS);
    expect(characteristicValue(entry, 'Sv')).toBe(BASE.Sv);
  });

  it('meldet mit der Necrarch-Blutlinie WS als Basiswert - 2; A, Sv und Sv+ bleiben Basiswert (Kriterium 2, Vorzeichen-Randfall)', () => {
    const report = evaluateVampireCount({ bloodlineId: NECRARCH_ID });
    const entry = profileEntryOf(vampireCountSlot(report));

    const ws = characteristicValue(entry, 'WS');
    expect(Number(ws)).toBe(Number(BASE.WS) - 2);
    expect(characteristicValue(entry, 'A')).toBe(BASE.A);
    expect(characteristicValue(entry, 'Sv')).toBe(BASE.Sv);
    expect(characteristicValue(entry, 'Sv+')).toBe(BASE['Sv+']);
  });

  it('haelt den effektiven Namen des Profil-Eintrags von dem der Einheit getrennt (Randfall Exklusivitaet)', () => {
    const report = evaluateVampireCount({ bloodlineId: BLOOD_DRAGON_ID });
    const capability = vampireCountSlot(report);
    const entry = profileEntryOf(capability);

    expect(entry.name).toBe('Vampire Count');
    // Der `append`-Modifikator verbindet mit `join` einer NBSP (U+00A0), so
    // wie sie im Katalogattribut steht — kein Tippfehler dieser Erwartung.
    expect(capability.name).toBe('Vampire Count of Clan Blood Dragon');
  });
});
