/**
 * Eigene, minimale Fixture der Reinraum-Engine, modelliert an realen
 * WHFB6-/„Definitive Edition"-Faellen (ADR-0030: die Engine traegt ein **eigenes**
 * Datenmodell und **eigene** Fixtures — nichts aus `src/solver/__fixtures__/` wird
 * uebernommen). Vorbild ist der Ogre-Kingdoms-Katalog: die Pflichteinheit
 * „Ogerbullen" (Bulls) mit einer armeeweiten `min`-Grenze, ein Prozent-/Kosten-
 * Kernanteil und ein auf eine Kategorie gegateter, bedingter Modifikator.
 *
 * Das Vokabular ist das **engine-eigene**, vereinfachte (`op`/`targetKind`/`childId`
 * statt der Battlescribe-Attribute `type`/`field`), das `src/evaluator/catalogReader.js`
 * liest — nicht das rohe Battlescribe-XML. Struktur und Faelle sind an den realen
 * Daten orientiert (`src/solver/__fixtures__/whfb6/Ogre Kingdoms.cat`,
 * `docs/battlescribe-data-format.md`), die Ids und Werte sind bewusst klein und
 * lesbar gehalten.
 */

// ── Definitions-Ids ──────────────────────────────────────────────────────────
export const STANDARD_FORCE_ID = 'force-standard';
export const BULLS_ID = 'entry-bulls';
export const IRONGUTS_ID = 'entry-ironguts';
export const TYRANT_ID = 'entry-tyrant';

// ── Kategorie-Ids (Core/Special/Characters, wie im WHFB6-Grundsystem) ─────────
export const CORE_CATEGORY_ID = 'cat-core';
export const SPECIAL_CATEGORY_ID = 'cat-special';
export const CHARACTERS_CATEGORY_ID = 'cat-characters';

// ── Kostenart (Punkte, per Id benannt — nie per Name, ADR-0003) ───────────────
export const POINTS_COST_TYPE_ID = 'cost-pts';

// ── Grenz-Ids ─────────────────────────────────────────────────────────────────
export const BULLS_MANDATORY_MIN_ID = 'min-bulls-mandatory';
export const IRONGUTS_MAX_ID = 'max-ironguts';
export const TYRANT_MAX_ID = 'max-tyrant';
export const CORE_PERCENT_MIN_ID = 'min-core-percent';

// ── Basis-Werte ───────────────────────────────────────────────────────────────
export const BULLS_POINTS = 35;
export const IRONGUTS_POINTS = 44;
export const TYRANT_POINTS = 200;

/** Pflicht: mindestens ein „Ogerbullen"-Trupp in der ganzen Armee. */
export const BULLS_MIN = 1;
/** Basis-Obergrenze fuer Ironguts-Truppen, ohne Charakter in der Armee. */
export const IRONGUTS_BASE_MAX = 2;
/** Angehobene Obergrenze fuer Ironguts, sobald ein Charakter in der Armee steht. */
export const IRONGUTS_RAISED_MAX = 4;
/** Ein Tyrant je Armee. */
export const TYRANT_MAX = 1;
/** Kern-Mindestanteil an den Armeepunkten (Prozent). */
export const CORE_MIN_PERCENT = 25;

/**
 * Der Katalog. Enthaelt bewusst eine Mischung der Grenz-Arten:
 * - **min (Selektion):** Bulls sind armeeweit Pflicht (`scope="roster"`),
 * - **max (Selektion):** je ein Tyrant, hoechstens zwei Ironguts (bedingt vier),
 * - **min (Prozent/Kosten):** die Kategorie Core traegt mindestens 25 % der Punkte,
 * - **bedingter Modifikator + `instanceOf`:** steht ein Charakter (Kategorie
 *   Characters) in der Armee, hebt ein Modifikator die Ironguts-Obergrenze auf vier.
 */
export const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-ogre-kingdoms" name="Ogre Kingdoms (Definitive Edition, minimal)">
  <categoryEntries>
    <categoryEntry id="${CORE_CATEGORY_ID}" name="Core">
      <constraints>
        <constraint id="${CORE_PERCENT_MIN_ID}" type="min" value="${CORE_MIN_PERCENT}"
                    percentValue="true" field="${POINTS_COST_TYPE_ID}" scope="roster"/>
      </constraints>
    </categoryEntry>
    <categoryEntry id="${SPECIAL_CATEGORY_ID}" name="Special"/>
    <categoryEntry id="${CHARACTERS_CATEGORY_ID}" name="Characters"/>
  </categoryEntries>
  <forceEntries>
    <forceEntry id="${STANDARD_FORCE_ID}" name="Standard"/>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${BULLS_ID}" name="Bulls" type="unit">
      <costs>
        <cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="${BULLS_POINTS}"/>
      </costs>
      <categoryLinks>
        <categoryLink targetId="${CORE_CATEGORY_ID}"/>
      </categoryLinks>
      <constraints>
        <constraint id="${BULLS_MANDATORY_MIN_ID}" type="min" value="${BULLS_MIN}"
                    field="selections" scope="roster"/>
      </constraints>
    </selectionEntry>
    <selectionEntry id="${IRONGUTS_ID}" name="Ironguts" type="unit">
      <costs>
        <cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="${IRONGUTS_POINTS}"/>
      </costs>
      <categoryLinks>
        <categoryLink targetId="${SPECIAL_CATEGORY_ID}"/>
      </categoryLinks>
      <constraints>
        <constraint id="${IRONGUTS_MAX_ID}" type="max" value="${IRONGUTS_BASE_MAX}"
                    field="selections" scope="roster"/>
      </constraints>
      <modifiers>
        <modifier operation="set" targetKind="limit" targetId="${IRONGUTS_MAX_ID}"
                  value="${IRONGUTS_RAISED_MAX}">
          <conditions>
            <condition op="instanceOf" field="selections" scope="roster"
                       childId="${CHARACTERS_CATEGORY_ID}" value="1"/>
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
    <selectionEntry id="${TYRANT_ID}" name="Tyrant" type="unit">
      <costs>
        <cost name="pts" typeId="${POINTS_COST_TYPE_ID}" value="${TYRANT_POINTS}"/>
      </costs>
      <categoryLinks>
        <categoryLink targetId="${CHARACTERS_CATEGORY_ID}"/>
      </categoryLinks>
      <constraints>
        <constraint id="${TYRANT_MAX_ID}" type="max" value="${TYRANT_MAX}"
                    field="selections" scope="roster"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

/** Eine Auswahl-Instanz gegebener Anzahl ohne Kinder. */
function selection(defId, count) {
  return { defId, count, children: [] };
}

/**
 * Baut ein Roster als **ein** „Standard"-Kontingent, das die gegebenen Einheiten
 * traegt — die reale Form einer WHFB6-Armee (Einheiten liegen in einem
 * Detachment, nicht lose an der Wurzel). Eine Anzahl 0 laesst die Einheit weg.
 *
 * @param {{ bulls?: number, ironguts?: number, tyrants?: number }} counts
 * @returns {{ forces: object[] }}
 */
export function buildRoster({ bulls = 0, ironguts = 0, tyrants = 0 } = {}) {
  const units = [];
  if (bulls > 0) units.push(selection(BULLS_ID, bulls));
  if (ironguts > 0) units.push(selection(IRONGUTS_ID, ironguts));
  if (tyrants > 0) units.push(selection(TYRANT_ID, tyrants));
  return { forces: [{ defId: STANDARD_FORCE_ID, count: 1, children: units }] };
}
