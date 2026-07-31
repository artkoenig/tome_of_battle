/**
 * Issue 0135 — „Auffüllen" hilft der Liste auf den eingestellten Punktwert,
 * statt offene Pflichten (und Kategorien!) aufzuzählen.
 * Test-first: die neue Implementierung existiert noch nicht.
 *
 * Intention (Akzeptanzkriterien der Issue, wörtlich):
 * 1. Ohne Punktgrenze (keine Limit-Kostenart oder Punktwert 0) erscheint das
 *    Panel nicht.
 * 2. Lücke < 50 Punkte — auch 0 und Überschreitung — kein Panel.
 * 3. Lücke ≥ 50 Punkte: Panel erscheint und nennt die verbleibende Summe in
 *    der Limit-Kostenart.
 * 4. Vorgeschlagen wird nur, was der Bericht als wählbar führt: eine Einheit
 *    unmittelbar unter dem Kontingent oder eine Option an einer bestehenden
 *    Auswahl. Ein Kategorie-Slot erscheint nie.
 * 5. Kein Vorschlag ist versteckt (`isHidden`) oder ausgeschöpft (`isBlocked`).
 * 6. Jeder Vorschlag kostet > 0 und höchstens die verbleibende Summe der
 *    Limit-Kostenart, zeigt seine Kosten und nennt — an einer bestehenden
 *    Einheit — die Einheit, zu der er gehört.
 * 7. Eine offene Pflicht als solche erzeugt keinen Vorschlag mehr.
 * 8. Der „+"-Knopf fügt genau den benannten Katalogeintrag hinzu — nie eine
 *    Auswahl aus einer Kategorie-ID.
 * 9. Vorschläge nach Kosten absteigend; mehr als acht → acht sichtbar, Rest
 *    aufklappbar.
 *
 * ── Prop-Vertrag (entschieden, Issue 0135) ──────────────────────────────────
 * `capabilities` (bereits auf DIESES Kontingent verengt), `forcePath`,
 * `remainingPoints` (eingestellter Punktwert minus aktuelle Summe der
 * Limit-Kostenart; `null` = keine Punktgrenze), `costLimitTypeId`,
 * `costTypeLabel`, `pathBySelectionId`, `addUnit`, `system`, `activeCatalogue`,
 * `subSelectionOperations`.
 *
 * ── Falsifizierbarkeit ──────────────────────────────────────────────────────
 * Alle Erwartungen stehen an Observablen: gerendertem Text und den Wirkungen
 * eines Klicks. Die Vorbedingungen (Ankerart, Kosten, isHidden/isBlocked)
 * stammen aus der ECHTEN Fassade (`prepareDataset`/`evaluate` über
 * `toEvaluatorRoster`) und werden je Test zusätzlich als Guard geprüft — kein
 * handgeschriebener Fähigkeitsdatensatz, der die Engine nachbauen könnte.
 *
 * ── Zwei nachentschiedene Kanten (Rückfrage beantwortet) ────────────────────
 * (a) Ein BELEGTER Slot mit verbleibendem Spielraum (`headroom > 0` oder
 *     `headroom === null`) IST ein Vorschlag — „wählbar" heißt `offerAnchor`
 *     ODER `occupied` mit Spielraum; es gelten dieselben Filter (nicht
 *     versteckt, nicht ausgeschöpft, Kosten > 0 und ≤ Restsumme).
 *     Fall: „Speertraeger" (max 3, belegt 1, 40 Pkt).
 * (b) Ein Pflicht-Phantom erscheint NIE, auch mit Kosten im Budget:
 *     Kriterium 4 ist die schärfere Regel, Kriterium 7 sein Sonderfall.
 *     Fall: „Pflichtritter" (min 1, 70 Pkt, unbelegt).
 *
 * ── Kriterium 10 (nachgereicht): Herkunft ───────────────────────────────────
 * Vorgeschlagen wird nur, was aus dem Armeebuch DIESES Kontingents, dem
 * Spielsystem oder einem Bibliothekskatalog stammt — dieselbe Regel, die der
 * Aushebe-Dialog schon anwendet (`foreignCatalogueIdsOf` in
 * `CategoryUnitAdder.jsx`): fremd ist jeder Nicht-Bibliotheks-Katalog des
 * Systems außer dem eigenen; unbekannte Herkunft (`sourceId: null`) wird
 * angeboten. Prop-Ergänzung: `forceCatalogueId`, ersatzweise
 * `activeCatalogue.id`. Dafür gibt es einen EIGENEN Datensatz (`ORIGIN_*`,
 * `.gst` + vier `.cat`), damit die übrigen Fälle unberührt bleiben.
 *
 * ── Ausnahme OHNE Kriterium: Kontingent ohne Slots im Bericht ───────────────
 * Dass das Panel bei `forcePath === null` gar nicht erscheint, folgt **nicht**
 * aus dem Kriterienkatalog, sondern ist eine **Triage-Entscheidung**:
 * Kriterium 3 verlangt das Panel ab 50 Punkten Lücke ausnahmslos, und für ein
 * Kontingent, dessen Definition der Katalog nicht mehr kennt, könnte es dort
 * ebenso gut mit einer dritten, wahrheitsgemäßen Meldung erscheinen
 * („für dieses Kontingent weiß der Bericht nichts"). Entschieden wurde
 * Schweigen, weil die Sektion für ein solches Kontingent ohnehin schon die
 * Meldung „gibt es im Katalog nicht mehr" trägt und dort nichts aushebbar ist.
 * Die beiden Fälle stehen deshalb in einem **eigenen** describe-Block — unter
 * Kriterium 3 gelesen, behaupteten sie eine Ausnahme im Kriterium selbst.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import AutoFillSuggestions from './AutoFillSuggestions';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

// `lucide-react` wird hier bewusst NICHT gemockt: welche Symbole die neue
// Implementierung nutzt, ist ihre Sache — eine Attrappe mit fester Icon-Liste
// bräche an einem neuen Icon und erzeugte einen Testfehler statt eines Befunds.

// ── Synthetischer Datensatz (rawXmls-Muster wie CategoryUnitAdder.evaluator) ──

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const PTS = 'cost-pts';
const MAGIC = 'cost-magic';
const CAT_TROOPS = 'cat-troops';
/** Die Kategorie mit MIN-Grenze — der gemeldete „General"-Fall (Issue 0135). */
const CAT_GENERAL = 'cat-general';
const FORCE_PATH = '0';

const CHARIOT_ID = 'entry-chariot';   // belegt, max 1 → ausgeschöpft
const BLADES_ID = 'entry-blades';     // Option am belegten Streitwagen, 25
const KNIGHT_ID = 'entry-knight';     // 100
const ARCHER_ID = 'entry-archer';     // 50
const MERC_ID = 'entry-merc';         // 300 — genau die Restsumme
const DRAGON_ID = 'entry-dragon';     // 301 — ein Punkt zu teuer
const BANNER_ID = 'entry-banner';     // 0 Punkte
const GHOST_ID = 'entry-ghost';       // hidden
const LOCKED_ID = 'entry-locked';     // max 0 → isBlocked
const DUTY_ID = 'entry-duty';         // min 1, 0 Punkte → Pflicht-Phantom
const WAND_ID = 'entry-wand';         // 0 Pkt, aber 30 in einer anderen Kostenart
const SMITH_ID = 'entry-smith';       // 60 Pkt (und 400 in einer anderen Kostenart)
const SPEAR_ID = 'entry-spear';       // max 3, belegt 1 → Restspielraum 2, 40 Pkt
const DUTY_KNIGHT_ID = 'entry-duty-knight'; // min 1, 70 Pkt → Pflicht-Phantom mit Kosten

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
  <costTypes>
    <costType id="${PTS}" name="Pkt" defaultCostLimit="-1"/>
    <costType id="${MAGIC}" name="Magie" defaultCostLimit="-1"/>
  </costTypes>
  <categoryEntries>
    <categoryEntry id="${CAT_TROOPS}" name="Truppen"/>
    <categoryEntry id="${CAT_GENERAL}" name="General">
      <constraints>
        <constraint type="min" value="1" field="selections" scope="force" shared="true" id="limit-general-min" includeChildSelections="false"/>
      </constraints>
    </categoryEntry>
  </categoryEntries>
</gameSystem>`;

/** Eine Wurzel-Einheit des Katalogs (Kandidat auf Armee-Ebene). */
const unitXml = (id, name, points, constraints = '', attrs = '') => `
      <selectionEntry id="${id}" name="${name}" type="unit" ${attrs}>
        ${constraints}
        <categoryLinks><categoryLink id="cl-${id}" name="Truppen" targetId="${CAT_TROOPS}" primary="true"/></categoryLinks>
        <costs><cost name="Pkt" typeId="${PTS}" value="${points}"/></costs>
      </selectionEntry>`;

const maxConstraint = (id, value) =>
  `<constraints><constraint type="max" value="${value}" field="selections" scope="force" shared="true" id="${id}" includeChildSelections="false"/></constraints>`;
const minConstraint = (id, value) =>
  `<constraints><constraint type="min" value="${value}" field="selections" scope="force" shared="true" id="${id}" includeChildSelections="false"/></constraints>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
  <forceEntries>
    <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
      <categoryLinks><categoryLink id="fcl-troops" name="Truppen" targetId="${CAT_TROOPS}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
      <selectionEntry id="${CHARIOT_ID}" name="Streitwagen" type="unit">
        ${maxConstraint('limit-chariot-max', 1)}
        <categoryLinks><categoryLink id="cl-chariot" name="Truppen" targetId="${CAT_TROOPS}" primary="true"/></categoryLinks>
        <costs><cost name="Pkt" typeId="${PTS}" value="200"/></costs>
        <selectionEntries>
          <selectionEntry id="${BLADES_ID}" name="Sichelklingen" type="upgrade">
            <costs><cost name="Pkt" typeId="${PTS}" value="25"/></costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    ${unitXml(KNIGHT_ID, 'Ritter', 100)}
    ${unitXml(ARCHER_ID, 'Bogenschuetze', 50)}
    ${unitXml(MERC_ID, 'Soeldner', 300)}
    ${unitXml(DRAGON_ID, 'Drache', 301)}
    ${unitXml(BANNER_ID, 'Freie Standarte', 0)}
    ${unitXml(GHOST_ID, 'Geist', 40, '', 'hidden="true"')}
    ${unitXml(LOCKED_ID, 'Verbannter', 40, maxConstraint('limit-locked-max', 0))}
    ${unitXml(DUTY_ID, 'Pflichtwache', 0, minConstraint('limit-duty-min', 1))}
    ${unitXml(DUTY_KNIGHT_ID, 'Pflichtritter', 70, minConstraint('limit-duty-knight-min', 1))}
    ${unitXml(SPEAR_ID, 'Speertraeger', 40, maxConstraint('limit-spear-max', 3))}
      <selectionEntry id="${WAND_ID}" name="Zauberstab" type="unit">
        <categoryLinks><categoryLink id="cl-wand" name="Truppen" targetId="${CAT_TROOPS}" primary="true"/></categoryLinks>
        <costs>
          <cost name="Pkt" typeId="${PTS}" value="0"/>
          <cost name="Magie" typeId="${MAGIC}" value="30"/>
        </costs>
      </selectionEntry>
      <selectionEntry id="${SMITH_ID}" name="Runenschmied" type="unit">
        <categoryLinks><categoryLink id="cl-smith" name="Truppen" targetId="${CAT_TROOPS}" primary="true"/></categoryLinks>
        <costs>
          <cost name="Pkt" typeId="${PTS}" value="60"/>
          <cost name="Magie" typeId="${MAGIC}" value="400"/>
        </costs>
      </selectionEntry>
  </selectionEntries>
</catalogue>`;

/** Neun gleichartige Kandidaten (90, 80, … 10 Punkte) für den Deckel-Fall. */
const NINE = [
  ['Alpha', 90], ['Beta', 80], ['Gamma', 70], ['Delta', 60], ['Epsilon', 50],
  ['Zeta', 40], ['Eta', 30], ['Theta', 20], ['Iota', 10],
];
const NINE_FORCE_DEF_ID = 'force-nine';
const NINE_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-nine" name="Nine Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
  <forceEntries>
    <forceEntry id="${NINE_FORCE_DEF_ID}" name="Nine Force">
      <categoryLinks><categoryLink id="ncl-troops" name="Truppen" targetId="${CAT_TROOPS}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
    ${NINE.map(([name, points]) => unitXml(`entry-${name.toLowerCase()}`, name, points)).join('')}
  </selectionEntries>
</catalogue>`;

// ── Eigener Datensatz: Lücke ≥ 50, aber nichts passt hinein ─────────────────
// Ein Kontingent, dessen einzige wählbare Einheit 500 Pkt kostet. Bei 300
// Restpunkten bleibt kein Vorschlag übrig — das Panel erscheint trotzdem.

const COSTLY_FORCE_DEF_ID = 'force-costly';

const COSTLY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-costly" name="Costly Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
  <forceEntries>
    <forceEntry id="${COSTLY_FORCE_DEF_ID}" name="Costly Force">
      <categoryLinks><categoryLink id="ccl-troops" name="Truppen" targetId="${CAT_TROOPS}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>${unitXml('entry-giant', 'Kriegsriese', 500)}</selectionEntries>
</catalogue>`;

/** App-Roster des „nichts passt"-Datensatzes: leeres Kontingent, 300 Punkte. */
function costlyRoster() {
  return {
    id: 'roster-costly',
    name: 'Costly Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-costly',
    costLimit: 300,
    costLimitType: PTS,
    forces: [{ id: 'force-uuid-costly', forceEntryId: COSTLY_FORCE_DEF_ID, catalogueId: 'cat-costly', selections: [] }],
  };
}

// ── Eigener Datensatz für Kriterium 10 (Herkunft) ───────────────────────────
// `.gst` + vier `.cat`: eigenes Armeebuch, fremdes Armeebuch, Bibliothek und
// ein Katalog ohne Wurzel-Id (→ `sourceId: null`, unbekannte Herkunft).

const ORIGIN_GS_ID = 'gs-origin';
const ORIGIN_FORCE_DEF_ID = 'force-origin';
const ORIGIN_CATEGORY_ID = 'cat-origin-troops';
const OWN_CATALOGUE_ID = 'cat-own';
const FOREIGN_CATALOGUE_ID = 'cat-foreign';
const LIBRARY_CATALOGUE_ID = 'cat-lib';

const originUnitXml = (id, name, points) => `
      <selectionEntry id="${id}" name="${name}" type="unit">
        <categoryLinks><categoryLink id="ocl-${id}" name="Truppen" targetId="${ORIGIN_CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="Pkt" typeId="${PTS}" value="${points}"/></costs>
      </selectionEntry>`;

const ORIGIN_GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${ORIGIN_GS_ID}" name="Origin System">
  <costTypes><costType id="${PTS}" name="Pkt" defaultCostLimit="-1"/></costTypes>
  <categoryEntries><categoryEntry id="${ORIGIN_CATEGORY_ID}" name="Truppen"/></categoryEntries>
  <forceEntries>
    <forceEntry id="${ORIGIN_FORCE_DEF_ID}" name="Origin Force">
      <categoryLinks><categoryLink id="ocl-troops" name="Truppen" targetId="${ORIGIN_CATEGORY_ID}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>${originUnitXml('entry-gst-banner', 'Grosses Banner', 35)}</selectionEntries>
</gameSystem>`;

const OWN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="${OWN_CATALOGUE_ID}" name="Ogre Kingdoms" gameSystemId="${ORIGIN_GS_ID}">
  <selectionEntries>${originUnitXml('entry-own', 'Schlachtmeister', 100)}</selectionEntries>
</catalogue>`;

const FOREIGN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="${FOREIGN_CATALOGUE_ID}" name="Vampire Counts" gameSystemId="${ORIGIN_GS_ID}">
  <selectionEntries>${originUnitXml('entry-foreign', 'Vampirfuerst', 100)}</selectionEntries>
</catalogue>`;

const LIBRARY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="${LIBRARY_CATALOGUE_ID}" name="Bibliothek" gameSystemId="${ORIGIN_GS_ID}" library="true">
  <selectionEntries>${originUnitXml('entry-lib', 'Soeldnerhauptmann', 45)}</selectionEntries>
</catalogue>`;

/** Ein Katalog ohne Wurzel-Id: seine Slots tragen `sourceId: null`. */
const UNKNOWN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue name="Ohne Id" gameSystemId="${ORIGIN_GS_ID}">
  <selectionEntries>${originUnitXml('entry-noid', 'Namenlose Wache', 30)}</selectionEntries>
</catalogue>`;

/**
 * Das App-System-Objekt des Herkunfts-Datensatzes. Für die Herkunftsregel zählt
 * `catalogues` (Bibliothek ja/nein); der Katalog ohne Id steht bewusst mit
 * `id: null` darin — er darf dadurch nicht als fremd gelten.
 */
function originSystem() {
  return {
    id: ORIGIN_GS_ID,
    name: 'Origin System',
    catalogues: [
      { id: OWN_CATALOGUE_ID, name: 'Ogre Kingdoms', isLibrary: false },
      { id: FOREIGN_CATALOGUE_ID, name: 'Vampire Counts', isLibrary: false },
      { id: LIBRARY_CATALOGUE_ID, name: 'Bibliothek', isLibrary: true },
      { id: null, name: 'Ohne Id', isLibrary: false },
    ],
    rawXmls: {
      gst: [{ name: 'origin.gst', content: ORIGIN_GAME_SYSTEM_XML }],
      cat: [
        { name: 'own.cat', content: OWN_CATALOGUE_XML },
        { name: 'foreign.cat', content: FOREIGN_CATALOGUE_XML },
        { name: 'library.cat', content: LIBRARY_CATALOGUE_XML },
        { name: 'noid.cat', content: UNKNOWN_CATALOGUE_XML },
      ],
    },
  };
}

/** App-Roster des Herkunfts-Datensatzes: ein leeres Kontingent, 300 Punkte. */
function originRoster() {
  return {
    id: 'roster-origin',
    name: 'Origin Roster',
    systemId: ORIGIN_GS_ID,
    catalogueId: OWN_CATALOGUE_ID,
    costLimit: 300,
    costLimitType: PTS,
    forces: [{ id: 'force-uuid-origin', forceEntryId: ORIGIN_FORCE_DEF_ID, catalogueId: OWN_CATALOGUE_ID, selections: [] }],
  };
}

/** App-System-Objekt mit den rohen XMLs (Shape aus `src/db/systemImport.js`). */
function appSystem(catalogueXml = CATALOGUE_XML) {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: catalogueXml }],
    },
  };
}

/**
 * App-Roster: Streitwagen ×1 (200 Pkt, max 1 → ausgeschöpft) und Speertraeger
 * ×1 (40 Pkt, max 3 → Restspielraum 2) bei 540 Pkt Grenze → 300 Restpunkte.
 */
function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 540,
    costLimitType: PTS,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          { id: 'sel-chariot', name: 'Streitwagen', entryLinkId: null, selectionEntryId: CHARIOT_ID, number: 1, category: null, selections: [] },
          { id: 'sel-spear', name: 'Speertraeger', entryLinkId: null, selectionEntryId: SPEAR_ID, number: 1, category: null, selections: [] },
        ],
      },
    ],
  };
}

/** App-Roster ohne Auswahlen für den Neun-Kandidaten-Datensatz. */
function nineRoster() {
  return {
    id: 'roster-nine',
    name: 'Nine Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-nine',
    costLimit: 300,
    costLimitType: PTS,
    forces: [{ id: 'force-uuid-9', forceEntryId: NINE_FORCE_DEF_ID, catalogueId: 'cat-nine', selections: [] }],
  };
}

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluationOf(catalogueXml, roster) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueXml] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId, report };
}

let mainEvaluationCache = null;
/** Der Hauptdatensatz (Streitwagen belegt, 300 Restpunkte). */
function mainEvaluation() {
  mainEvaluationCache ??= evaluationOf(CATALOGUE_XML, appRoster());
  return mainEvaluationCache;
}

let nineEvaluationCache = null;
function nineEvaluation() {
  nineEvaluationCache ??= evaluationOf(NINE_CATALOGUE_XML, nineRoster());
  return nineEvaluationCache;
}

let costlyEvaluationCache = null;
/** Der „nichts passt"-Datensatz (einzige Einheit 500 Pkt). */
function costlyEvaluation() {
  costlyEvaluationCache ??= evaluationOf(COSTLY_CATALOGUE_XML, costlyRoster());
  return costlyEvaluationCache;
}

let originEvaluationCache = null;
/** Der Herkunfts-Datensatz (eigenes/fremdes/Bibliothek/ohne Id). */
function originEvaluation() {
  if (originEvaluationCache === null) {
    const prepared = prepareDataset({
      gameSystem: ORIGIN_GAME_SYSTEM_XML,
      catalogues: [OWN_CATALOGUE_XML, FOREIGN_CATALOGUE_XML, LIBRARY_CATALOGUE_XML, UNKNOWN_CATALOGUE_XML],
    });
    const { evalRoster, pathBySelectionId } = toEvaluatorRoster(originRoster());
    const report = evaluate(prepared, evalRoster);
    originEvaluationCache = { capabilities: report.capabilities, pathBySelectionId };
  }
  return originEvaluationCache;
}

/** Capability eines Slots dieses Kontingents per Definitions-Id. */
function capabilityOf(capabilities, defId) {
  for (const capability of capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

// ── Observablen-Helfer: nur gerenderter Text und Klick-Wirkungen ──────────────

/** Das tiefste Element unter `root`, dessen Text `text` enthält (oder null). */
function deepestWith(root, text) {
  const matches = [...root.querySelectorAll('*')].filter(el => el.textContent.includes(text));
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** False, wenn das Element (oder ein Vorfahr) eingeklappt/ausgeblendet ist. */
function isRevealed(element) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    if (node.tagName === 'DETAILS' && !node.open) return false;
    if (node.style && node.style.display === 'none') return false;
  }
  return true;
}

/** True, wenn `name` im Panel sichtbar steht. */
function isShown(container, name) {
  const element = deepestWith(container, name);
  return element !== null && isRevealed(element);
}

/** Die sichtbaren Namen aus `names`, in Reihenfolge des gerenderten Textes. */
function shownInOrder(container, names) {
  return names
    .filter(name => isShown(container, name))
    .sort((a, b) => container.textContent.indexOf(a) - container.textContent.indexOf(b));
}

/**
 * Die Zeile eines Vorschlags: der größte Vorfahr seines Namens, der keinen
 * anderen Vorschlagsnamen enthält. Ohne Wissen über Klassennamen — genau das,
 * was ein Nutzer als „diese eine Zeile" sieht.
 */
function rowOf(container, name, otherNames) {
  let row = deepestWith(container, name);
  expect(row, `kein gerenderter Text „${name}"`).not.toBeNull();
  while (row.parentElement && row.parentElement !== container
      && container.contains(row.parentElement)
      && !otherNames.some(other => row.parentElement.textContent.includes(other))) {
    row = row.parentElement;
  }
  return row;
}

/** True, wenn das Argument die Definition identifiziert (Form bleibt offen). */
function identifiesDefinition(arg, defId) {
  return arg === defId || arg?.id === defId || arg?.defId === defId;
}

/** Alle Aufrufe der Unter-Auswahl-Operationen als flache Liste. */
function operationCalls(operations) {
  return Object.entries(operations).flatMap(([name, fn]) =>
    fn.mock.calls.map(args => ({ name, args })));
}

/**
 * Alle Hinzufüge-Wirkungen eines Klicks, egal über welche der beiden
 * bestehenden Mechaniken sie lief.
 */
function addEffects(addUnit, operations) {
  return [
    ...addUnit.mock.calls.map(args => ({ via: 'addUnit', args })),
    ...operationCalls(operations).map(call => ({ via: call.name, args: call.args })),
  ];
}

const MAIN_PROPS = {
  forcePath: FORCE_PATH,
  remainingPoints: 300,
  costLimitTypeId: PTS,
  costTypeLabel: 'Pkt',
  activeCatalogue: { id: 'cat-main' },
};

function renderPanel(overrides = {}) {
  const { capabilities, pathBySelectionId } = mainEvaluation();
  const addUnit = vi.fn();
  const subSelectionOperations = createSubSelectionOperationsMock();
  const view = render(
    <AutoFillSuggestions
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={appSystem()}
      addUnit={addUnit}
      subSelectionOperations={subSelectionOperations}
      {...MAIN_PROPS}
      {...overrides}
    />
  );
  return { ...view, addUnit, subSelectionOperations };
}

function renderNinePanel(remainingPoints) {
  const { capabilities, pathBySelectionId } = nineEvaluation();
  const addUnit = vi.fn();
  const subSelectionOperations = createSubSelectionOperationsMock();
  const view = render(
    <AutoFillSuggestions
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      forcePath={FORCE_PATH}
      remainingPoints={remainingPoints}
      costLimitTypeId={PTS}
      costTypeLabel="Pkt"
      system={appSystem(NINE_CATALOGUE_XML)}
      activeCatalogue={{ id: 'cat-nine' }}
      addUnit={addUnit}
      subSelectionOperations={subSelectionOperations}
    />
  );
  return { ...view, addUnit, subSelectionOperations };
}

/**
 * Rendert das Panel des Herkunfts-Datensatzes. `activeCatalogue` ist roster-weit
 * (so führt `RosterEditor` es), `forceCatalogueId` das Armeebuch DIESES
 * Kontingents; wird es weggelassen, greift die Rückfallregel.
 */
function renderOriginPanel({ forceCatalogueId, activeCatalogueId = OWN_CATALOGUE_ID } = {}) {
  const { capabilities, pathBySelectionId } = originEvaluation();
  const addUnit = vi.fn();
  const subSelectionOperations = createSubSelectionOperationsMock();
  const props = {
    capabilities,
    pathBySelectionId,
    forcePath: FORCE_PATH,
    remainingPoints: 300,
    costLimitTypeId: PTS,
    costTypeLabel: 'Pkt',
    system: originSystem(),
    activeCatalogue: { id: activeCatalogueId },
    addUnit,
    subSelectionOperations,
  };
  if (forceCatalogueId !== undefined) props.forceCatalogueId = forceCatalogueId;
  const view = render(<AutoFillSuggestions {...props} />);
  return { ...view, addUnit, subSelectionOperations };
}

/** Alle Namen des Herkunfts-Datensatzes, teuerste zuerst. */
const ORIGIN_NAMES = ['Schlachtmeister', 'Vampirfuerst', 'Soeldnerhauptmann', 'Grosses Banner', 'Namenlose Wache'];

/** Die im Hauptdatensatz bei 300 Restpunkten erwarteten Vorschläge. */
const MAIN_SUGGESTIONS = ['Soeldner', 'Ritter', 'Runenschmied', 'Bogenschuetze', 'Speertraeger', 'Sichelklingen'];
const others = (name) => MAIN_SUGGESTIONS.filter(other => other !== name);

describe('AutoFillSuggestions: Restpunkt-Vorschläge statt Pflicht-Aufzählung (Issue 0135)', () => {

  describe('Kriterium 1: ohne Punktgrenze kein Panel', () => {
    it('keine Limit-Kostenart: das Panel erscheint nicht', () => {
      const { container } = renderPanel({ remainingPoints: null, costLimitTypeId: null });

      expect(container.textContent).toBe('');
    });

    it('Punktwert 0 (also keine Grenze): das Panel erscheint nicht', () => {
      // Vertrag: `remainingPoints` ist auch bei Punktwert 0 `null`.
      const { container } = renderPanel({ remainingPoints: null, costLimitTypeId: PTS });

      expect(container.textContent).toBe('');
    });
  });

  describe('Kriterium 2: Lücke unter 50 Punkten → kein Panel', () => {
    it('Lücke 49 (ein Punkt unter der Schwelle): kein Panel', () => {
      const { container } = renderPanel({ remainingPoints: 49 });

      expect(container.textContent).toBe('');
    });

    it('Lücke 0 (Liste genau ausgereizt): kein Panel', () => {
      const { container } = renderPanel({ remainingPoints: 0 });

      expect(container.textContent).toBe('');
    });

    it('Überschreitung (Lücke −120): kein Panel', () => {
      const { container } = renderPanel({ remainingPoints: -120 });

      expect(container.textContent).toBe('');
    });
  });

  describe('Kriterium 3: ab 50 Punkten Lücke erscheint das Panel', () => {
    it('Lücke genau 50: das Panel erscheint mit einem Vorschlag im Budget', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, ARCHER_ID)).toMatchObject({ anchorKind: 'offerAnchor', costs: { [PTS]: 50 } });

      const { container } = renderPanel({ remainingPoints: 50 });

      expect(isShown(container, 'Bogenschuetze')).toBe(true);
      // … und nichts, was nicht mehr hineinpasst.
      expect(isShown(container, 'Ritter')).toBe(false);
    });

    it('das Panel nennt die verbleibende Summe in der Limit-Kostenart', () => {
      const { container } = renderPanel({ remainingPoints: 137 });

      expect(container.textContent).toMatch(/137[^\d]{0,6}Pkt|Pkt[^\d]{0,6}137/);
    });

    it('Lücke ≥ 50, aber nichts passt hinein: das Panel erscheint trotzdem — mit Restsumme und Hinweis statt Vorschlägen', () => {
      const { capabilities } = costlyEvaluation();
      // Vorbedingung: die einzige wählbare Einheit ist zu teuer; die offene
      // Pflicht („General") ist nach Kriterium 4 ohnehin kein Vorschlag.
      expect(capabilityOf(capabilities, 'entry-giant')).toMatchObject({
        name: 'Kriegsriese', anchorKind: 'offerAnchor', isHidden: false, isBlocked: false,
        costs: { [PTS]: 500 },
      });

      const { container } = render(
        <AutoFillSuggestions
          capabilities={capabilities}
          pathBySelectionId={new Map()}
          forcePath={FORCE_PATH}
          remainingPoints={300}
          costLimitTypeId={PTS}
          costTypeLabel="Pkt"
          system={appSystem(COSTLY_CATALOGUE_XML)}
          activeCatalogue={{ id: 'cat-costly' }}
          forceCatalogueId="cat-costly"
          addUnit={vi.fn()}
          subSelectionOperations={createSubSelectionOperationsMock()}
        />
      );

      // Das Panel steht da und nennt die Restsumme …
      expect(container.textContent).not.toBe('');
      expect(container.textContent).toMatch(/300[^\d]{0,6}Pkt|Pkt[^\d]{0,6}300/);
      // … mit einem Hinweis statt einer Liste (`editor.autofill.nothingFits`).
      expect(container.textContent).toMatch(/Nichts passt/);
      // … und ohne jeden Vorschlag und ohne „+"-Knopf.
      expect(isShown(container, 'Kriegsriese')).toBe(false);
      expect(isShown(container, 'General')).toBe(false);
      expect(container.querySelectorAll('button')).toHaveLength(0);
    });
  });

  describe('Kontingent ohne Slots im Bericht: das Panel schweigt (bewusste Ausnahme zu Kriterium 3, Issue 0135)', () => {
    it('ohne Pfad für dieses Kontingent (der Bericht führt keine Slots) erscheint das Panel gar nicht', () => {
      // Der dokumentierte Fall eines Kontingents, dessen Definition der Katalog
      // nicht mehr kennt: `ForceEditorSection` reicht dann eine leere Slot-Map
      // und `forcePath: null` herein. „Nichts passt" wäre hier eine Behauptung
      // über etwas, worüber der Bericht nichts weiß.
      const empty = renderPanel({ forcePath: null, capabilities: new Map(), remainingPoints: 300 });
      expect(empty.container.textContent).toBe('');
      empty.unmount();

      const none = renderPanel({ forcePath: null, capabilities: null, remainingPoints: 300 });
      expect(none.container.textContent).toBe('');
    });

    it('ohne Pfad bleibt das Panel auch dann aus, wenn die Slot-Map Kandidaten enthielte', () => {
      // Positiver Gegenbeweis: mit Pfad zeigt derselbe Bericht Vorschläge.
      const withPath = renderPanel({ remainingPoints: 300 });
      expect(isShown(withPath.container, 'Ritter')).toBe(true);
      withPath.unmount();

      const { container } = renderPanel({ forcePath: null, remainingPoints: 300 });

      expect(container.textContent).toBe('');
    });
  });

  describe('Kriterium 4: nur Wählbares — nie ein Kategorie-Slot', () => {
    it('eine Einheit unter dem Kontingent und eine Option an einer bestehenden Auswahl werden vorgeschlagen', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, KNIGHT_ID)).toMatchObject({
        anchorKind: 'offerAnchor', frame: { path: FORCE_PATH, defId: FORCE_DEF_ID },
      });
      expect(capabilityOf(capabilities, BLADES_ID)).toMatchObject({
        anchorKind: 'offerAnchor', frame: { path: '0/0', defId: CHARIOT_ID },
      });

      const { container } = renderPanel();

      expect(isShown(container, 'Ritter')).toBe(true);
      expect(isShown(container, 'Sichelklingen')).toBe(true);
    });

    it('ein belegter Slot mit Restspielraum (Speertraeger, max 3, belegt 1) ist ein Vorschlag wie jeder andere', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, SPEAR_ID)).toMatchObject({
        anchorKind: 'occupied', effectiveMax: 3, current: 1, headroom: 2,
        isBlocked: false, isHidden: false, costs: { [PTS]: 40 },
        frame: { path: FORCE_PATH, defId: FORCE_DEF_ID },
      });

      const { container } = renderPanel();

      expect(isShown(container, 'Speertraeger')).toBe(true);
      const spearRow = rowOf(container, 'Speertraeger', others('Speertraeger'));
      expect(spearRow.textContent).toMatch(/40/);
      expect(spearRow.textContent).toContain('Pkt');
    });

    it('kein Kategorie-Slot erscheint: weder „General" (Pflicht-Phantom einer Kategorie) noch „Truppen" (Kategorie-Anker)', () => {
      const { capabilities } = mainEvaluation();
      // Der gemeldete Fall, gegen den echten Bericht abgesichert.
      expect(capabilityOf(capabilities, CAT_GENERAL)).toMatchObject({
        name: 'General', anchorKind: 'mandatoryPhantom', isMandatoryUnmet: true,
      });
      expect(capabilityOf(capabilities, 'fcl-troops')).toMatchObject({
        name: 'Truppen', anchorKind: 'categoryAnchor', targetDefId: CAT_TROOPS,
      });

      const { container } = renderPanel();

      expect(isShown(container, 'General')).toBe(false);
      expect(isShown(container, 'Truppen')).toBe(false);
    });
  });

  describe('Kriterium 5: nichts Verstecktes, nichts Ausgeschöpftes', () => {
    it('ein versteckter (Geist) und ein ausgeschöpfter Kandidat (Verbannter) erscheinen nicht — ein gleich teurer sichtbarer schon', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, GHOST_ID)).toMatchObject({ isHidden: true, costs: { [PTS]: 40 } });
      expect(capabilityOf(capabilities, LOCKED_ID)).toMatchObject({ isBlocked: true, isHidden: false, costs: { [PTS]: 40 } });

      const { container } = renderPanel();

      expect(isShown(container, 'Geist')).toBe(false);
      expect(isShown(container, 'Verbannter')).toBe(false);
      // Beweis, dass die Abwesenheit nicht am Preis liegt: der gleich teure
      // Speertraeger (40 Pkt) steht sehr wohl da.
      expect(isShown(container, 'Speertraeger')).toBe(true);
      expect(isShown(container, 'Runenschmied')).toBe(true);
      // Der ausgeschöpfte belegte Slot „Streitwagen" wird hier NICHT über seinen
      // Namen geprüft: er steht legitim in der Zeile seiner Option
      // („Sichelklingen an Streitwagen"), Abwesenheit wäre nicht messbar.
    });
  });

  describe('Kriterium 6: Kosten > 0, höchstens die Restsumme, ablesbar', () => {
    it('genau die Restsumme (300) ja, ein Punkt darüber (301) nein, 0 Punkte nein — auch nicht mit Kosten in einer anderen Kostenart', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, MERC_ID).costs).toEqual({ [PTS]: 300 });
      expect(capabilityOf(capabilities, DRAGON_ID).costs).toEqual({ [PTS]: 301 });
      expect(capabilityOf(capabilities, BANNER_ID).costs).toEqual({ [PTS]: 0 });
      expect(capabilityOf(capabilities, WAND_ID).costs).toEqual({ [PTS]: 0, [MAGIC]: 30 });

      const { container } = renderPanel({ remainingPoints: 300 });

      expect(isShown(container, 'Soeldner')).toBe(true);
      expect(isShown(container, 'Drache')).toBe(false);
      expect(isShown(container, 'Freie Standarte')).toBe(false);
      expect(isShown(container, 'Zauberstab')).toBe(false);
    });

    it('jeder Vorschlag zeigt seine Kosten in der Limit-Kostenart', () => {
      const { container } = renderPanel();

      const knightRow = rowOf(container, 'Ritter', others('Ritter'));
      expect(knightRow.textContent).toMatch(/100/);
      expect(knightRow.textContent).toContain('Pkt');

      const smithRow = rowOf(container, 'Runenschmied', others('Runenschmied'));
      expect(smithRow.textContent).toMatch(/60/);
    });

    it('ein Vorschlag an einer bestehenden Einheit nennt die Einheit, zu der er gehört', () => {
      const { container } = renderPanel();

      const bladesRow = rowOf(container, 'Sichelklingen', others('Sichelklingen'));
      expect(bladesRow.textContent).toContain('Streitwagen');
      expect(bladesRow.textContent).toMatch(/25/);
    });
  });

  describe('Kriterium 7: eine offene Pflicht als solche erzeugt keinen Vorschlag', () => {
    it('ein Pflicht-Slot ohne Kosten in der Limit-Kostenart (Pflichtwache) erscheint nicht', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, DUTY_ID)).toMatchObject({
        anchorKind: 'mandatoryPhantom', isMandatoryUnmet: true, costs: { [PTS]: 0 },
      });

      const { container } = renderPanel();

      expect(isShown(container, 'Pflichtwache')).toBe(false);
    });

    it('auch ein Pflicht-Phantom MIT Kosten im Budget (Pflichtritter, 70 Pkt) erscheint nicht', () => {
      const { capabilities } = mainEvaluation();
      expect(capabilityOf(capabilities, DUTY_KNIGHT_ID)).toMatchObject({
        anchorKind: 'mandatoryPhantom', isMandatoryUnmet: true,
        isBlocked: false, isHidden: false, costs: { [PTS]: 70 },
      });

      const { container } = renderPanel({ remainingPoints: 300 });

      // 70 Pkt passen bequem in die Restsumme — die Ankerart schließt ihn aus,
      // nicht der Preis. Beweis dafür: ein billigerer Vorschlag steht da.
      expect(isShown(container, 'Pflichtritter')).toBe(false);
      expect(isShown(container, 'Runenschmied')).toBe(true);
    });
  });

  describe('Kriterium 8: der „+"-Knopf fügt genau den benannten Katalogeintrag hinzu', () => {
    it('bei einer Einheit unter dem Kontingent: addUnit mit genau diesem Eintrag', () => {
      const { container, addUnit, subSelectionOperations } = renderPanel();

      const knightRow = rowOf(container, 'Ritter', others('Ritter'));
      const button = knightRow.querySelector('button');
      expect(button, 'kein „+"-Knopf in der Vorschlagszeile').not.toBeNull();
      fireEvent.click(button);

      expect(addUnit).toHaveBeenCalledTimes(1);
      expect(identifiesDefinition(addUnit.mock.calls[0][0], KNIGHT_ID)).toBe(true);
      expect(addUnit.mock.calls[0][0]?.name).toBe('Ritter');
      expect(operationCalls(subSelectionOperations)).toEqual([]);
    });

    it('bei einer Option an einer bestehenden Auswahl: die Operation trifft genau diese Auswahl und diesen Eintrag', () => {
      const { container, addUnit, subSelectionOperations } = renderPanel();

      const bladesRow = rowOf(container, 'Sichelklingen', others('Sichelklingen'));
      const button = bladesRow.querySelector('button');
      expect(button, 'kein „+"-Knopf in der Vorschlagszeile').not.toBeNull();
      fireEvent.click(button);

      const calls = operationCalls(subSelectionOperations);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0]).toBe('sel-chariot');
      expect(identifiesDefinition(calls[0].args[1], BLADES_ID)).toBe(true);
      expect(addUnit).not.toHaveBeenCalled();
    });

    it('bei einem belegten Slot mit Restspielraum: die Wirkung trifft genau diesen Slot', () => {
      const { container, addUnit, subSelectionOperations } = renderPanel();

      const spearRow = rowOf(container, 'Speertraeger', others('Speertraeger'));
      const button = spearRow.querySelector('button');
      expect(button, 'kein „+"-Knopf in der Vorschlagszeile').not.toBeNull();
      fireEvent.click(button);

      // Welche der beiden bestehenden Mechaniken den Slot wachsen lässt, ist
      // offen — dass sie GENAU diesen Slot trifft, nicht.
      const effects = addEffects(addUnit, subSelectionOperations);
      expect(effects).toHaveLength(1);
      const [effect] = effects;
      expect(effect.args.some(argument => identifiesDefinition(argument, SPEAR_ID))).toBe(true);
      expect(effect.via === 'addUnit' || effect.args[0] === 'sel-spear').toBe(true);
      for (const foreign of [KNIGHT_ID, MERC_ID, BLADES_ID, CHARIOT_ID, DUTY_KNIGHT_ID, CAT_GENERAL]) {
        expect(effect.args.some(argument => identifiesDefinition(argument, foreign))).toBe(false);
      }
    });

    it('kein Knopf im Panel fügt je eine Auswahl aus einer Kategorie-ID hinzu', () => {
      const { container, addUnit, subSelectionOperations } = renderPanel();

      for (const button of container.querySelectorAll('button')) fireEvent.click(button);

      const added = [
        ...addUnit.mock.calls.map(args => args[0]),
        ...operationCalls(subSelectionOperations).map(call => call.args[1]),
      ];
      expect(added.length).toBeGreaterThan(0);
      for (const argument of added) {
        expect(identifiesDefinition(argument, CAT_GENERAL)).toBe(false);
        expect(identifiesDefinition(argument, CAT_TROOPS)).toBe(false);
        expect(identifiesDefinition(argument, DUTY_ID)).toBe(false);
        expect(identifiesDefinition(argument, DUTY_KNIGHT_ID)).toBe(false);
      }
    });
  });

  describe('Kriterium 9: nach Kosten absteigend, acht sichtbar, Rest aufklappbar', () => {
    it('die Vorschläge stehen nach Kosten absteigend', () => {
      const { container } = renderPanel();

      expect(shownInOrder(container, MAIN_SUGGESTIONS)).toEqual(
        ['Soeldner', 'Ritter', 'Runenschmied', 'Bogenschuetze', 'Speertraeger', 'Sichelklingen']);
    });

    it('genau acht Kandidaten: alle acht stehen da, ohne Aufklappen', () => {
      // Restpunkte 85 → Alpha (90) fällt über Kriterium 6 heraus, es bleiben acht.
      const { container } = renderNinePanel(85);

      const names = NINE.map(([name]) => name);
      expect(shownInOrder(container, names)).toEqual(
        ['Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota']);
      expect(isShown(container, 'Alpha')).toBe(false);
    });

    it('neun Kandidaten: acht sichtbar (die teuersten), der Rest erst nach dem Aufklappen', () => {
      const { capabilities } = nineEvaluation();
      for (const [name] of NINE) {
        expect(capabilityOf(capabilities, `entry-${name.toLowerCase()}`)).toMatchObject({ anchorKind: 'offerAnchor' });
      }

      const { container } = renderNinePanel(300);
      const names = NINE.map(([name]) => name);

      expect(shownInOrder(container, names)).toEqual(
        ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']);
      expect(isShown(container, 'Iota')).toBe(false);

      // Irgendein Bedienelement klappt den Rest auf.
      const controls = [...container.querySelectorAll('button, summary, [role="button"], a')];
      for (const control of controls) {
        fireEvent.click(control);
        if (isShown(container, 'Iota')) break;
      }
      expect(isShown(container, 'Iota')).toBe(true);
    });
  });

  describe('Kriterium 10: nur Einheiten aus dem Armeebuch dieses Kontingents, dem Spielsystem oder einer Bibliothek', () => {
    it('eine Einheit aus einem fremden Armeebuch erscheint nicht — die gleich teure aus dem eigenen schon', () => {
      const { capabilities } = originEvaluation();
      // Vorbedingung, seit Issue 0140 umgekehrt: der Eintrag des fremden
      // Armeebuchs ist gar kein Angebots-Anker mehr. Bis dahin lieferte die
      // Engine beide Einheiten desselben Preises und sie unterschieden sich NUR
      // in der Herkunft — daran zeigte dieser Test, dass das **Panel** die
      // fremde weglässt. Seit Issue 0140 reicht die App der Engine das
      // Armeebuch je Kontingent durch (`force.catalogueId`; hier steht die
      // Kontingent-Definition in der `.gst`, der Herkunftsindex kann also
      // nichts beisteuern), und schon die Engine hält sie zurück. Die
      // nutzersichtbare Zusage bleibt wörtlich dieselbe und wird unverändert
      // geprüft; nur ihre Vorbedingung ist eine andere. Der eigene Eintrag
      // bleibt selbstverständlich ein Anker — sonst prüfte der Kontrast unten
      // nichts.
      expect(capabilityOf(capabilities, 'entry-foreign')).toBeUndefined();
      expect(capabilityOf(capabilities, 'entry-own')).toMatchObject({
        name: 'Schlachtmeister', anchorKind: 'offerAnchor', sourceId: OWN_CATALOGUE_ID,
        costs: { [PTS]: 100 },
      });

      const { container } = renderOriginPanel({ forceCatalogueId: OWN_CATALOGUE_ID });

      expect(isShown(container, 'Vampirfuerst')).toBe(false);
      expect(isShown(container, 'Schlachtmeister')).toBe(true);
    });

    it('Spielsystem, Bibliothekskatalog und unbekannte Herkunft werden angeboten — und sonst nichts', () => {
      const { capabilities } = originEvaluation();
      expect(capabilityOf(capabilities, 'entry-gst-banner')).toMatchObject({ sourceId: ORIGIN_GS_ID, costs: { [PTS]: 35 } });
      expect(capabilityOf(capabilities, 'entry-lib')).toMatchObject({ sourceId: LIBRARY_CATALOGUE_ID, costs: { [PTS]: 45 } });
      expect(capabilityOf(capabilities, 'entry-noid')).toMatchObject({ sourceId: null, costs: { [PTS]: 30 } });

      const { container } = renderOriginPanel({ forceCatalogueId: OWN_CATALOGUE_ID });

      expect(shownInOrder(container, ORIGIN_NAMES)).toEqual(
        ['Schlachtmeister', 'Soeldnerhauptmann', 'Grosses Banner', 'Namenlose Wache']);
    });

    it('ohne `forceCatalogueId` gilt der aktive Katalog der Liste (dieselbe Rückfallregel wie im Aushebe-Dialog)', () => {
      // Derselbe Bericht, nur das „eigene" Armeebuch wechselt: jetzt ist der
      // Vampire-Counts-Katalog der eigene und Ogre Kingdoms das fremde.
      //
      // **Was sich umgekehrt hat:** Diese Zusage belegte früher, dass der
      // Rückfall die Einheit des Vampire-Counts-Buchs („Vampirfuerst") *zeigt*.
      // Die Voraussetzung dafür ist entfallen: Issue 0140 hat den
      // Herkunftsfilter je Kontingent in die **Engine** verlegt — die App
      // reicht ihr das Armeebuch des Kontingents durch (`force.catalogueId`,
      // hier Ogre Kingdoms), und die Einheit des fremden Buchs ist gar kein
      // Angebots-Anker mehr. Sie steht dem Panel also unabhängig von jeder
      // Prop nicht mehr zur Auswahl.
      //
      // **Was unverändert gilt:** die Regel selbst — ohne `forceCatalogueId`
      // filtert `activeCatalogue.id`. Gepinnt wird sie jetzt negativ: mit
      // `forceCatalogueId: OWN_CATALOGUE_ID` schlägt das Panel
      // „Schlachtmeister" vor (die beiden Fälle oben); greift der Rückfall auf
      // den hier abweichenden aktiven Katalog, verschwindet genau dieser
      // Vorschlag. Dieselbe Unterscheidung, andere Richtung.
      const { container } = renderOriginPanel({ activeCatalogueId: FOREIGN_CATALOGUE_ID });

      expect(isShown(container, 'Schlachtmeister')).toBe(false);
      expect(shownInOrder(container, ORIGIN_NAMES)).toEqual(
        ['Soeldnerhauptmann', 'Grosses Banner', 'Namenlose Wache']);
    });
  });
});
