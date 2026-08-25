/**
 * Issue 0093 — „Armeeweite Kategorie-Min-Grenze wird mehrfach gemeldet".
 *
 * Eine `categoryEntry` mit armeeweiter Grenze (`scope="roster"`) wird doppelt
 * verankert: als Wurzel-Pflicht-Phantom **und** an jedem Kategorie-Anker jeder
 * Force, deren `categoryLink` die Grenzen erbt. Alle Anker melden dieselbe
 * Verletzung — eine unerfuellte armeeweite Pflicht erscheint 1 + n-mal
 * (`docs/battlescribe-data-format.md` §9.9 verlangt Entdopplung: „genau ein
 * Verstoss"). Das Urteil ist korrekt, die Mehrfachmeldung ein Berichtsfehler.
 *
 * Beobachtet wird ausschliesslich die echte Fassade (`prepareDataset` +
 * `evaluate`): die Meldungsliste (`violations`) und der Faehigkeitsdatensatz
 * (`capabilities`).
 *
 * Gepinnte Defaults aus dem Issue (Mensch nicht gefragt):
 * - **Ueberlebender Vertreter** der entdoppelten Meldung ist der
 *   Roster-Rahmen-Anker (das Wurzel-Pflicht-Phantom, `mandatoryPhantom`), wenn
 *   einer existiert; sonst der erste Anker in Dokumentreihenfolge.
 * - **Eingrenzung:** entdoppelt werden nur armeeweite (Roster-Rahmen-)
 *   Kategorie-Grenzen an synthetischen Kategorie-Ankern. Force-weite Grenzen
 *   bleiben je Kontingent gemeldet (Kriterium 2), belegte Instanz-Anker
 *   behalten ihre Multiplizitaet.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind } from '../../../../contexts/ruleengine/engine/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Die Meldungen des Berichts zu einer Grenz-Id. */
function messagesOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

const GENERAL_CATEGORY_ID = 'cat-general';
const FORCE_DEF_ID = 'force-army';
const HERO_DEF_ID = 'entry-hero';
const MIN_GENERAL_LIMIT_ID = 'min-general-roster';
const MAX_GENERAL_LIMIT_ID = 'max-general-roster';
const FORCE_MIN_LIMIT_ID = 'min-general-force';
const MAX_HERO_LIMIT_ID = 'max-hero-roster';

/**
 * Der Repro-Katalog des Issues: eine Kategorie „General" mit den uebergebenen
 * Grenzen direkt an der `categoryEntry`, eine Kontingent-Definition, die die
 * Kategorie per `categoryLink` fuehrt (der Link traegt keine eigenen Grenzen —
 * er erbt die der Kategorie), und ein Eintrag „Hero", der der Kategorie ueber
 * seinen eigenen `categoryLink` angehoert (§5.5).
 */
function catalogXml({ categoryConstraintsXml = '', heroConstraintsXml = '' } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0093" name="Army-Wide Category Dedup Catalogue">
      <categoryEntries>
        <categoryEntry id="${GENERAL_CATEGORY_ID}" name="General">
          <constraints>
            ${categoryConstraintsXml}
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army">
          <categoryLinks>
            <categoryLink id="clink-force-general" name="General" targetId="${GENERAL_CATEGORY_ID}"/>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_DEF_ID}" name="Hero" type="unit">
          ${heroConstraintsXml}
          <categoryLinks>
            <categoryLink id="clink-hero-general" name="General" targetId="${GENERAL_CATEGORY_ID}" primary="true"/>
          </categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

const MIN_ROSTER = `<constraint id="${MIN_GENERAL_LIMIT_ID}" type="min" value="1" field="selections" scope="roster" includeChildSelections="true"/>`;
const MAX_ROSTER = `<constraint id="${MAX_GENERAL_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="true"/>`;
const MIN_FORCE = `<constraint id="${FORCE_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="force" includeChildSelections="true"/>`;

/** Ein Roster aus `n` Kontingenten „Army", jedes mit `heroesPerForce` Heroes. */
function rosterWithForces(n, heroesPerForce = 0) {
  return {
    forces: Array.from({ length: n }, () => ({
      defId: FORCE_DEF_ID,
      count: 1,
      children: heroesPerForce === 0
        ? []
        : [{ defId: HERO_DEF_ID, count: heroesPerForce, children: [] }],
    })),
  };
}

// ── Kriterium 1: armeeweite MIN-Grenze meldet genau einmal ───────────────────

describe('Kriterium 1: unerfuellte armeeweite Kategorie-MIN-Grenze meldet genau einmal', () => {
  const CATALOGUE = catalogXml({ categoryConstraintsXml: MIN_ROSTER });

  it('zwei verlinkende Kontingente, leer: genau EINE Verletzung, verankert am Wurzel-Pflicht-Phantom', () => {
    // Heute rot: 1 + n = 3 identische Meldungen derselben Grenz-Id (Phantom
    // plus je Force-Kategorie-Anker).
    const report = evaluate(CATALOGUE, rosterWithForces(2));

    const messages = messagesOf(report, MIN_GENERAL_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
    // Default „ueberlebender Vertreter": der Roster-Rahmen-Anker (das
    // Wurzel-Pflicht-Phantom), wenn einer existiert — hier existiert er.
    expect(messages[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
  });

  it('ein verlinkendes Kontingent, leer: genau EINE Verletzung (heute zwei), verankert am Phantom', () => {
    const report = evaluate(CATALOGUE, rosterWithForces(1));

    const messages = messagesOf(report, MIN_GENERAL_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
    expect(messages[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
  });

  it('KONTROLLE: erfuellte armeeweite Pflicht (ein Hero vorhanden) meldet nichts', () => {
    // Das Urteil selbst ist heute korrekt — gepinnt, damit die Entdopplung
    // nicht mehr entfernt, als sie soll.
    const report = evaluate(CATALOGUE, rosterWithForces(1, 1));

    expect(messagesOf(report, MIN_GENERAL_LIMIT_ID)).toHaveLength(0);
  });
});

// ── Kriterium 1: auch die armeeweite MAX-Grenze ist eine „armeeweite Grenze" ─

describe('Kriterium 1: ueberschrittene armeeweite Kategorie-MAX-Grenze meldet genau einmal', () => {
  it('MAX-only verlinkt, 2 Kontingente mit je einem Hero (2 > max 1): genau EINE Verletzung am ersten Anker', () => {
    // Heute rot: n-fach an den Force-Kategorie-Ankern (kein Phantom, da keine
    // MIN-Grenze existiert). Default: ohne Phantom ueberlebt der erste Anker
    // in Dokumentreihenfolge — der Kategorie-Anker des ERSTEN Kontingents.
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MAX_ROSTER }),
      rosterWithForces(2, 1),
    );

    const messages = messagesOf(report, MAX_GENERAL_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
    expect(messages[0].anchor.anchorKind).toBe(AnchorKind.CATEGORY_ANCHOR);
    expect(messages[0].anchor.path.startsWith('0/')).toBe(true);
  });

  it('MIN+MAX verlinkt, MIN erfuellt, MAX ueberschritten: genau EINE MAX-Verletzung am Phantom, keine MIN-Verletzung', () => {
    // Heute rot: die MAX-Grenze reitet auf allen drei Ankern mit (2 Force-Anker
    // plus Phantom) und meldet dreifach.
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_ROSTER + MAX_ROSTER }),
      rosterWithForces(2, 1),
    );

    expect(messagesOf(report, MIN_GENERAL_LIMIT_ID)).toHaveLength(0);
    const maxMessages = messagesOf(report, MAX_GENERAL_LIMIT_ID);
    expect(maxMessages).toHaveLength(1);
    expect(maxMessages[0]).toMatchObject({ actual: 2, bound: 1 });
    expect(maxMessages[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
  });
});

// ── Kriterium 2: force-weite Grenzen bleiben je Kontingent gemeldet ──────────

describe('Kriterium 2: force-weite Kategorie-Grenzen bleiben je Kontingent gemeldet', () => {
  it('KONTROLLE: MIN scope="force", 2 leere Kontingente: genau ZWEI Verletzungen, eine je Kontingent-Anker', () => {
    // Heute gruen — gepinnt gegen Ueber-Entdopplung: die Pflicht zaehlt je
    // Kontingent, also melden beide Kontingente.
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_FORCE }),
      rosterWithForces(2),
    );

    const messages = messagesOf(report, FORCE_MIN_LIMIT_ID);
    expect(messages).toHaveLength(2);
    const anchorForces = messages.map(message => message.anchor.path.split('/')[0]).sort();
    expect(anchorForces).toEqual(['0', '1']); // je Kontingent genau eine
    for (const message of messages) {
      expect(message.anchor.anchorKind).toBe(AnchorKind.CATEGORY_ANCHOR);
      expect(message).toMatchObject({ actual: 0, bound: 1 });
    }
  });

  it('gemischt (roster-MIN + force-MIN an derselben Kategorie), 2 leere Kontingente: 1 Roster-Meldung + 2 Force-Meldungen', () => {
    // Heute rot in beiden Haelften: die Roster-Pflicht meldet dreifach, und die
    // Force-Pflicht reitet zusaetzlich auf dem Wurzel-Phantom mit (dritte
    // Meldung, die keinem Kontingent gehoert). Kriterium 2 sagt „je Kontingent
    // gemeldet" — also genau die zwei Kontingent-Anker, kein Phantom-Huckepack.
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_ROSTER + MIN_FORCE }),
      rosterWithForces(2),
    );

    const rosterMessages = messagesOf(report, MIN_GENERAL_LIMIT_ID);
    expect(rosterMessages).toHaveLength(1);
    expect(rosterMessages[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);

    const forceMessages = messagesOf(report, FORCE_MIN_LIMIT_ID);
    expect(forceMessages).toHaveLength(2);
    const anchorForces = forceMessages.map(message => message.anchor.path.split('/')[0]).sort();
    expect(anchorForces).toEqual(['0', '1']);
    for (const message of forceMessages) {
      expect(message.anchor.anchorKind).toBe(AnchorKind.CATEGORY_ANCHOR);
    }
  });
});

// ── Kriterium 3: der Faehigkeitsdatensatz jedes Kategorie-Slots bleibt voll ──

describe('Kriterium 3: die Entdopplung betrifft nur die Meldungsliste, nicht die Faehigkeitsdatensaetze', () => {
  it('KONTROLLE: roster-MIN, 2 leere Kontingente — jeder Kategorie-Slot traegt die Pflicht weiterhin', () => {
    // Heute gruen (die Slots werten alle Grenzen aus) — gepinnt, damit die
    // Entdopplung nicht in die Anker- oder Ergebnis-Schicht rutscht: BEIDE
    // Force-Kategorie-Anker UND das Wurzel-Phantom behalten effectiveMin und
    // die unerfuellte Pflicht.
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_ROSTER }),
      rosterWithForces(2),
    );

    const capabilities = [...report.capabilities.values()];

    const forceCategorySlots = capabilities.filter(
      slot => slot.anchorKind === AnchorKind.CATEGORY_ANCHOR
        && slot.targetDefId === GENERAL_CATEGORY_ID,
    );
    expect(forceCategorySlots).toHaveLength(2); // ein Kategorie-Anker je Kontingent
    for (const slot of forceCategorySlots) {
      expect(slot.effectiveMin).toBe(1);
      expect(slot.isMandatoryUnmet).toBe(true);
    }

    const phantomSlots = capabilities.filter(
      slot => slot.anchorKind === AnchorKind.MANDATORY_PHANTOM
        && slot.defId === GENERAL_CATEGORY_ID,
    );
    expect(phantomSlots).toHaveLength(1); // das roster-weite Wurzel-Phantom
    expect(phantomSlots[0].effectiveMin).toBe(1);
    expect(phantomSlots[0].isMandatoryUnmet).toBe(true);
  });
});

// ── Review-Befund F1: der Ueberlebende ist das WURZEL-Pflicht-Phantom ────────

/**
 * Repro des Review-Befunds F1: eine UNVERLINKTE Kategorie (kein `categoryLink`
 * in der Kontingent-Definition) traegt Roster-MIN **und** Force-MIN. Dann
 * synthetisiert die Engine ZWEI Pflicht-Phantome: eines unter dem Kontingent
 * (Force-Schleife, fuer die Force-Pflicht) und eines an der Wurzel
 * (Roster-Schleife). Die protokollierte Entscheidung sagt: der Ueberlebende
 * der entdoppelten Roster-Grenze ist das WURZEL-Phantom, wenn eines existiert
 * — nicht irgendein Pflicht-Phantom.
 */
function unlinkedCatalogXml(categoryConstraintsXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0093-f1" name="Unlinked Category Catalogue">
      <categoryEntries>
        <categoryEntry id="${GENERAL_CATEGORY_ID}" name="General">
          <constraints>
            ${categoryConstraintsXml}
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_DEF_ID}" name="Hero" type="unit">
          <categoryLinks>
            <categoryLink id="clink-hero-general" name="General" targetId="${GENERAL_CATEGORY_ID}" primary="true"/>
          </categoryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

describe('Ueberlebender bei konkurrierenden Phantomen (Review-Befund F1)', () => {
  it('unverlinkt, roster-MIN + force-MIN, 1 leeres Kontingent: Roster-Meldung am WURZEL-Phantom, Force-Meldung am Kontingent-Phantom', () => {
    // Heute rot: der Tiebreak befoerdert JEDES Pflicht-Phantom — die
    // Roster-Meldung ueberlebt am Kontingent-Phantom (Pfad "0/…", erstes in
    // Dokumentreihenfolge) statt am Wurzel-Phantom (einsegmentiger Pfad).
    const report = evaluate(
      unlinkedCatalogXml(MIN_ROSTER + MIN_FORCE),
      rosterWithForces(1),
    );

    // Vorbedingung des Repros: BEIDE Phantome existieren (eines unter dem
    // Kontingent, eines an der Wurzel) — sonst testet der Fall nichts.
    const phantomSlots = [...report.capabilities.values()].filter(
      slot => slot.anchorKind === AnchorKind.MANDATORY_PHANTOM
        && slot.defId === GENERAL_CATEGORY_ID,
    );
    expect(phantomSlots).toHaveLength(2);

    // Die armeeweite Pflicht: genau EINE Meldung, verankert am
    // WURZEL-Phantom — dessen Pfad liegt ausserhalb jedes Kontingents
    // (einsegmentig, ohne "/").
    const rosterMessages = messagesOf(report, MIN_GENERAL_LIMIT_ID);
    expect(rosterMessages).toHaveLength(1);
    expect(rosterMessages[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
    expect(rosterMessages[0].anchor.path).not.toContain('/');

    // Wache gegen Ueber-Korrektur: die Force-Pflicht bleibt am
    // KONTINGENT-Phantom des (einzigen) Kontingents gemeldet.
    const forceMessages = messagesOf(report, FORCE_MIN_LIMIT_ID);
    expect(forceMessages).toHaveLength(1);
    expect(forceMessages[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
    expect(forceMessages[0].anchor.path.startsWith('0/')).toBe(true);
  });
});

// ── Wache: belegte Instanz-Anker behalten ihre Multiplizitaet ────────────────

describe('KONTROLLE: Grenzen an belegten Instanz-Ankern werden nicht entdoppelt', () => {
  it('Eintrags-MAX scope="roster", zwei belegte Instanzen: weiterhin ZWEI Meldungen, je Instanz eine', () => {
    // Heute gruen — gepinnt, damit die Entdopplung auf synthetische
    // Kategorie-Anker beschraenkt bleibt (Tyrant-Familie: count 2).
    const heroConstraintsXml = `<constraints>
      <constraint id="${MAX_HERO_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="true" shared="true"/>
    </constraints>`;
    const report = evaluate(
      catalogXml({ heroConstraintsXml }),
      {
        forces: [{
          defId: FORCE_DEF_ID,
          count: 1,
          children: [
            { defId: HERO_DEF_ID, count: 1, children: [] },
            { defId: HERO_DEF_ID, count: 1, children: [] },
          ],
        }],
      },
    );

    const messages = messagesOf(report, MAX_HERO_LIMIT_ID);
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.anchor.anchorKind).toBe(AnchorKind.OCCUPIED);
      expect(message).toMatchObject({ actual: 2, bound: 1 });
    }
  });
});
