import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus
 * (Konvention wie `modifiers.test.js`): erst aufbereiten, dann auswerten.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue 78: Ein ueber einen `<entryLink>` gesetzter Eintrag muss unter demselben
// Typ (`model`, `unit`, …) zaehlen wie derselbe Eintrag direkt gesetzt — eine
// `childId="model"`-Bedingung liefert in beiden Faellen dasselbe Ergebnis.
//
// Beobachtbar an der Fassade: der Squad traegt einen Modifikator (+5 Punkte),
// dessen Bedingung `childId="model"` mindestens 3 Modelle im eigenen Rahmen
// verlangt. Halten die Modelle die Schwelle, steigen die effektiven Kosten auf
// 15 und reissen die Roster-Obergrenze von 12 → genau eine Verletzung mit
// actual = 15. Sieht die Bedingung die Modelle nicht, bleibt es bei 10 ≤ 12 →
// keine Verletzung. Der Unterschied „gesehen vs. nicht gesehen" ist damit als
// Verletzung im Bericht ablesbar, ohne Interna der Zaehl-Schicht zu lesen.
// ─────────────────────────────────────────────────────────────────────────────

const SQUAD_ID = 'entry-squad';
const DIRECT_TROOPER_ID = 'entry-trooper-direct';
const SHARED_TROOPER_ID = 'shared-trooper';
const TROOPER_LINK_ID = 'link-trooper';
const POINTS_ID = 'cost-points';
const MAX_POINTS_ID = 'max-points';

const SQUAD_BASE_POINTS = 10;
const MODIFIER_POINTS = 5;
const MAX_POINTS = 12;
const MODEL_THRESHOLD = 3;

/**
 * Der Squad-Rumpf: Kosten, Roster-Punkte-Obergrenze und der Modifikator, dessen
 * Bedingung ueber `childId="model"` die Modelle im eigenen Rahmen zaehlt —
 * dieselbe Form wie in echten Katalogdaten (atLeast / field="selections" /
 * scope="self" / childId="model").
 */
const SQUAD_BODY = `
  <costs>
    <cost name="Points" typeId="${POINTS_ID}" value="${SQUAD_BASE_POINTS}"/>
  </costs>
  <constraints>
    <constraint id="${MAX_POINTS_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_ID}" scope="roster"/>
  </constraints>
  <modifiers>
    <modifier type="increment" field="${POINTS_ID}" value="${MODIFIER_POINTS}">
      <conditions>
        <condition type="atLeast" field="selections" scope="self" childId="model" value="${MODEL_THRESHOLD}" shared="true" includeChildSelections="true"/>
      </conditions>
    </modifier>
  </modifiers>`;

// Ein Squad, unter dem derselbe Modell-Eintrag auf beide Arten waehlbar ist:
// direkt als geschachtelter `<selectionEntry type="model">` und als
// `<entryLink>` auf einen geteilten Eintrag mit `type="model"`. Das
// `type`-Attribut am `<entryLink>` selbst ist der Ziel-Diskriminator
// (`selectionEntry`), NICHT der Eintragstyp — der steht am Ziel.
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-linked-type" name="Linked Type Catalogue">
    <sharedSelectionEntries>
      <selectionEntry id="${SHARED_TROOPER_ID}" name="Trooper" type="model"/>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit">${SQUAD_BODY}
        <selectionEntries>
          <selectionEntry id="${DIRECT_TROOPER_ID}" name="Trooper" type="model"/>
        </selectionEntries>
        <entryLinks>
          <entryLink id="${TROOPER_LINK_ID}" name="Trooper" targetId="${SHARED_TROOPER_ID}" type="selectionEntry"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * Roster: ein Squad mit `trooperCount` Troopern, gebunden ueber `childDefId` —
 * die ID des direkten `<selectionEntry>` oder die EIGENE ID des `<entryLink>`
 * (der Resolver findet Links unter ihrer eigenen ID).
 */
function squadRoster(childDefId, trooperCount) {
  return {
    forces: [{
      defId: SQUAD_ID,
      count: 1,
      children: [{ defId: childDefId, count: trooperCount, children: [] }],
    }],
  };
}

describe('Verlinkte Eintraege zaehlen unter dem Typ ihres Ziels (Issue 78)', () => {
  it('liefert die childId="model"-Bedingung fuer direkt und per entryLink gesetzte Modelle dasselbe Ergebnis', () => {
    // Beide Roster stellen dieselben 3 Modelle unter denselben Squad — einmal
    // ueber den direkten Eintrag gebunden, einmal ueber die Link-ID.
    const direct = evaluate(CATALOGUE_XML, squadRoster(DIRECT_TROOPER_ID, MODEL_THRESHOLD));
    const linked = evaluate(CATALOGUE_XML, squadRoster(TROOPER_LINK_ID, MODEL_THRESHOLD));

    // Direkter Fall: die Bedingung haelt (3 Modelle) → 15 Punkte → 1 Verletzung.
    expect(direct.violations).toHaveLength(1);
    expect(direct.violations[0].actual).toBe(SQUAD_BASE_POINTS + MODIFIER_POINTS);

    // Verlinkter Fall: identisches beobachtbares Ergebnis.
    expect(linked.violations).toHaveLength(1);
    expect(linked.violations[0].actual).toBe(SQUAD_BASE_POINTS + MODIFIER_POINTS);
  });

  it('SIEHT die verlinkten Modelle wirklich: an der Schwelle greift die Bedingung, darunter nicht', () => {
    // Genau an der Schwelle (3 Modelle ueber den Link): die Bedingung muss
    // greifen — nicht bloss „beide gleich leer".
    const atThreshold = evaluate(CATALOGUE_XML, squadRoster(TROOPER_LINK_ID, MODEL_THRESHOLD));
    expect(atThreshold.violations).toHaveLength(1);
    expect(atThreshold.violations[0].actual).toBe(SQUAD_BASE_POINTS + MODIFIER_POINTS);

    // Unter der Schwelle (2 Modelle ueber den Link): keine Verletzung — schuetzt
    // gegen Doppeltzaehlung (Link UND Ziel), die 2 Modelle ueber die Schwelle 3
    // heben wuerde.
    const belowThreshold = evaluate(CATALOGUE_XML, squadRoster(TROOPER_LINK_ID, MODEL_THRESHOLD - 1));
    expect(belowThreshold.violations).toHaveLength(0);
  });
});

describe('Transitive Link-Kette: Link → Link → Eintrag (Rand von Issue 78)', () => {
  const OUTER_LINK_ID = 'link-outer';
  const MID_LINK_ID = 'link-mid';

  // Der Squad zieht seinen Trooper ueber eine Kette aus zwei Links herein: der
  // aeussere Link zielt auf einen Katalog-Link, der erst auf den geteilten
  // Eintrag mit type="model" zeigt.
  const CHAIN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-linked-chain" name="Linked Chain Catalogue">
      <sharedSelectionEntries>
        <selectionEntry id="${SHARED_TROOPER_ID}" name="Trooper" type="model"/>
      </sharedSelectionEntries>
      <entryLinks>
        <entryLink id="${MID_LINK_ID}" name="Trooper (mid)" targetId="${SHARED_TROOPER_ID}" type="selectionEntry"/>
      </entryLinks>
      <selectionEntries>
        <selectionEntry id="${SQUAD_ID}" name="Squad" type="unit">${SQUAD_BODY}
          <entryLinks>
            <entryLink id="${OUTER_LINK_ID}" name="Trooper" targetId="${MID_LINK_ID}" type="selectionEntry"/>
          </entryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('zaehlt auch ueber die Kette gesetzte Modelle unter dem Typ des Endziels', () => {
    const report = evaluate(CHAIN_CATALOGUE_XML, squadRoster(OUTER_LINK_ID, MODEL_THRESHOLD));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(SQUAD_BASE_POINTS + MODIFIER_POINTS);
  });
});
