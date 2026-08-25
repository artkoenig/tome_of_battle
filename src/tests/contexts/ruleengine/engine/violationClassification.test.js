/**
 * Fachliche Einordnung der Meldungen (`violationClassification.js`, Issue 75/07).
 *
 * Drei Dinge werden hier festgehalten:
 *
 * 1. **Die Einordnung selbst** — Herkunft, Schweregrad, Anker, Art der Grenze und
 *    Bezugsrahmen, je an einer echten Auswertung abgelesen statt an einem
 *    handgebauten Objekt.
 * 2. **Die Geschlossenheit der Wertevorraete** — jeder Wert der Einordnung stammt
 *    aus einer Aufzaehlung, und die Abbildungen dorthin sind zweiseitig
 *    vollstaendig. Waechst ein Wertevorrat, faellt das hier auf und nicht erst in
 *    der Oberflaeche.
 * 3. **Der Durchstich zu einem Anzeigetext** (Akzeptanzbedingung 7) — ein
 *    *Stellvertreter der Oberflaeche* bestimmt aus der Einordnung ohne
 *    Rateschritt einen Textschluessel, durchgespielt an allen heute vorhandenen
 *    Meldungsarten. Der Stellvertreter steht bewusst **im Test** und nicht in der
 *    Engine: die Zuordnung Einordnung → Satz ist Vertrag der Oberflaeche (ADR-0034),
 *    die Engine bleibt sprachfrei.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import {
  AnchorKind,
  ConstraintKind,
  CountedFieldKind,
  LimitMeasure,
  MessageAnchorKind,
  MessageOrigin,
  MessageSeverity,
  ModifierKind,
  ScopeKeyword,
  ScopeKind,
  limitMeasureOfCountedField,
  SELECTION_COUNT,
  FORCE_COUNT,
  costSumField,
  limitValueField,
} from '../../../../contexts/ruleengine/engine/model.js';

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

/** Die eine Meldung des Berichts zu einer Grenz-Id. */
function messageOf(report, limitId) {
  const matches = messagesOf(report, limitId);
  expect(matches, `genau eine Meldung zu ${limitId}`).toHaveLength(1);
  return matches[0];
}

/** Die Autor-Meldungen des Berichts (Herkunft `AUTHOR_MESSAGE`). */
function authorMessagesOf(report) {
  return report.violations.filter(message => message.origin === MessageOrigin.AUTHOR_MESSAGE);
}

// ── 1. Die Einordnung an einer echten Auswertung ─────────────────────────────

const POINTS_COST_ID = 'cost-points';
const ELITE_CATEGORY_ID = 'cat-elite';
const WARRIOR_DEF_ID = 'entry-warrior';
const SHIELD_DEF_ID = 'entry-shield';
const FORCE_DEF_ID = 'force-army';

describe('Einordnung: Art der Grenze und Bezugsrahmen', () => {
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-classify" name="Classify Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CATEGORY_ID}" name="Elite"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army">
          <constraints>
            <constraint id="max-forces" type="max" value="0" field="forces" scope="roster"/>
          </constraints>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <categoryLinks>
            <categoryLink id="clink-warrior" name="Elite" targetId="${ELITE_CATEGORY_ID}" primary="true"/>
          </categoryLinks>
          <costs><cost name="pts" typeId="${POINTS_COST_ID}" value="10"/></costs>
          <constraints>
            <constraint id="max-points" type="max" value="5" field="${POINTS_COST_ID}" scope="roster"/>
            <constraint id="max-budget" type="max" value="1" field="limit::${POINTS_COST_ID}" scope="roster"/>
            <constraint id="min-self" type="min" value="9" field="selections" scope="self"/>
          </constraints>
          <selectionEntries>
            <selectionEntry id="${SHIELD_DEF_ID}" name="Shield" type="upgrade">
              <constraints>
                <constraint id="max-shield-in-warrior" type="max" value="0" field="selections" scope="${WARRIOR_DEF_ID}"/>
                <constraint id="max-shield-in-elite" type="max" value="0" field="selections" scope="${ELITE_CATEGORY_ID}" includeChildSelections="true"/>
              </constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const ROSTER = {
    costLimits: [{ costTypeId: POINTS_COST_ID, value: 5 }],
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      children: [{ defId: WARRIOR_DEF_ID, count: 3, children: [{ defId: SHIELD_DEF_ID, count: 1, children: [] }] }],
    }],
  };

  const report = evaluate(CATALOGUE_XML, ROSTER);

  it('ordnet eine Zaehlgrenze als Mindest-/Hoechstmass ueber die Auswahlanzahl ein', () => {
    expect(messageOf(report, 'min-self').limit).toMatchObject({
      kind: ConstraintKind.MIN,
      measure: LimitMeasure.SELECTION_COUNT,
      costTypeId: null,
      isPercent: false,
    });
  });

  it('nennt bei einer Kostensummen-Grenze die Kostenart, gegen die gemessen wurde', () => {
    expect(messageOf(report, 'max-points').limit).toMatchObject({
      kind: ConstraintKind.MAX,
      measure: LimitMeasure.COST_SUM,
      costTypeId: POINTS_COST_ID,
    });
  });

  it('unterscheidet die eingestellte Kostengrenze von der verplanten Kostensumme', () => {
    // `limit::<id>` liest die im Roster **eingestellte** Grenze — eine
    // grundverschiedene Groesse als die summierten Kosten, deshalb eine eigene
    // Messgroesse und nicht COST_SUM.
    expect(messageOf(report, 'max-budget').limit).toMatchObject({
      measure: LimitMeasure.BUDGET_LIMIT,
      costTypeId: POINTS_COST_ID,
    });
  });

  it('ordnet eine Grenze ueber die Kontingentanzahl als eigene Messgroesse ein', () => {
    expect(messageOf(report, 'max-forces').limit).toMatchObject({
      measure: LimitMeasure.FORCE_COUNT,
      costTypeId: null,
    });
  });

  it('nennt einen Schluesselwort-Bezugsrahmen als solchen, ohne Ziel-Id', () => {
    expect(messageOf(report, 'min-self').limit.scope).toEqual({
      kind: ScopeKind.SELF,
      targetId: null,
      flags: { shared: true, includeChildSelections: false, includeChildForces: false },
    });
  });

  it('unterscheidet einen Eintrags- von einem Kategorie-Bezugsrahmen, beide mit ihrer Ziel-Id', () => {
    // Beide `scope`-Attribute sind im XML nur eine Id — ihnen sieht man nicht an,
    // was sie benennen. Genau diesen Rateschritt nimmt die Einordnung ab.
    expect(messageOf(report, 'max-shield-in-warrior').limit.scope).toMatchObject({
      kind: ScopeKind.ENTRY_ID,
      targetId: WARRIOR_DEF_ID,
    });
    expect(messageOf(report, 'max-shield-in-elite').limit.scope).toMatchObject({
      kind: ScopeKind.CATEGORY_ID,
      targetId: ELITE_CATEGORY_ID,
    });
  });

  it('reicht die Zaehl-Flags der Grenze durch, statt die Oberflaeche Vorgaben kennen zu lassen', () => {
    expect(messageOf(report, 'max-shield-in-elite').limit.scope.flags).toEqual({
      shared: true,                  // XSD-Vorgabe, im XML nicht gesetzt
      includeChildSelections: true,  // im XML ausdruecklich gesetzt
      includeChildForces: false,     // XSD-Vorgabe
    });
  });

  it('gibt jeder abgeleiteten Meldung Herkunft und Schweregrad', () => {
    for (const message of report.violations) {
      expect(message.origin).toBe(MessageOrigin.DERIVED_LIMIT);
      expect(message.severity).toBe(MessageSeverity.ERROR);
    }
  });

  it('beschreibt den Anker vollstaendig: Definition, effektiver Name, Pfad, Ankerart, Stabilitaet', () => {
    const message = messageOf(report, 'min-self');

    expect(message.anchor).toEqual({
      defId: WARRIOR_DEF_ID,
      name: 'Warrior',
      path: '0/0',
      anchorKind: AnchorKind.OCCUPIED,
      isValueUnstable: false,
    });
    // Der Pfad zeigt auf denselben Slot, dessen Faehigkeitsdatensatz der Bericht fuehrt.
    expect(report.capabilities.get(message.anchor.path).defId).toBe(WARRIOR_DEF_ID);
  });
});

describe('Einordnung: die roster-weite Budget-Regel', () => {
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-budget" name="Budget Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <costs><cost name="pts" typeId="${POINTS_COST_ID}" value="10"/></costs>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const report = evaluate(CATALOGUE_XML, {
    costLimits: [{ costTypeId: POINTS_COST_ID, value: 15 }],
    forces: [{ defId: WARRIOR_DEF_ID, count: 2, children: [] }],
  });

  it('ordnet „Armee zu teuer" als eigene Art ein — keine Kostensummen-Grenze des Katalogs', () => {
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      origin: MessageOrigin.DERIVED_LIMIT,
      severity: MessageSeverity.ERROR,
      actual: 20,
      bound: 15,
      limit: {
        kind: ConstraintKind.MAX,
        measure: LimitMeasure.ROSTER_BUDGET,
        costTypeId: POINTS_COST_ID,
        isPercent: false,
        scope: { kind: ScopeKind.ROSTER, targetId: null },
      },
    });
  });

  it('haengt sie an den Roster als Ganzes — eine eigene Ankerart, ohne Slot-Pfad', () => {
    expect(report.violations[0].anchor).toMatchObject({
      anchorKind: MessageAnchorKind.ROSTER,
      path: null,
    });
    // Diese Ankerart ist keine Slot-Ankerart: kein Faehigkeitsdatensatz traegt sie.
    const slotAnchorKinds = [...report.capabilities.values()].map(capability => capability.anchorKind);
    expect(slotAnchorKinds).not.toContain(MessageAnchorKind.ROSTER);
  });
});

describe('Einordnung: Ankerarten jenseits des belegten Slots', () => {
  const GROUP_ID = 'group-weapons';
  const MISSING_DEF_ID = 'entry-missing';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-anchors" name="Anchor Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CATEGORY_ID}" name="Elite"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army">
          <categoryLinks>
            <categoryLink id="clink-force-elite" name="Elite" targetId="${ELITE_CATEGORY_ID}">
              <constraints>
                <constraint id="max-elite-per-force" type="max" value="0" field="selections" scope="force"/>
              </constraints>
            </categoryLink>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <categoryLinks>
            <categoryLink id="clink-warrior" name="Elite" targetId="${ELITE_CATEGORY_ID}" primary="true"/>
          </categoryLinks>
          <selectionEntryGroups>
            <selectionEntryGroup id="${GROUP_ID}" name="Weapons">
              <constraints>
                <constraint id="min-weapons" type="min" value="1" field="selections" scope="parent"/>
              </constraints>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntry>
        <selectionEntry id="${MISSING_DEF_ID}" name="Missing" type="unit">
          <constraints>
            <constraint id="min-missing" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const report = evaluate(CATALOGUE_XML, {
    forces: [{ defId: FORCE_DEF_ID, count: 1, children: [{ defId: WARRIOR_DEF_ID, count: 1, children: [] }] }],
  });

  it('nennt einen Pflicht-Phantom als solchen — nicht als belegten Slot', () => {
    expect(messageOf(report, 'min-missing').anchor).toMatchObject({
      defId: MISSING_DEF_ID,
      anchorKind: AnchorKind.MANDATORY_PHANTOM,
    });
  });

  it('nennt einen Gruppen-Anker als solchen', () => {
    expect(messageOf(report, 'min-weapons').anchor).toMatchObject({
      defId: GROUP_ID,
      anchorKind: AnchorKind.GROUP_ANCHOR,
    });
  });

  it('nennt einen Kategorie-Anker als solchen', () => {
    expect(messageOf(report, 'max-elite-per-force').anchor).toMatchObject({
      anchorKind: AnchorKind.CATEGORY_ANCHOR,
    });
  });

  it('meldet nichts an einem Angebots-Anker (ADR-0036)', () => {
    // Der Bericht fuehrt die nicht gewaehlten Definitionen als Slots …
    const offerSlots = [...report.capabilities.values()]
      .filter(capability => capability.anchorKind === AnchorKind.OFFER_ANCHOR);
    expect(offerSlots.length).toBeGreaterThan(0);

    // … aber keine einzige Meldung haengt an einem von ihnen.
    const messageAnchorKinds = report.violations.map(message => message.anchor.anchorKind);
    expect(messageAnchorKinds).not.toContain(AnchorKind.OFFER_ANCHOR);
  });
});

// ── 2. Autor-Meldungen in derselben Liste ────────────────────────────────────

describe('Einordnung: Autor-Meldung gegenueber abgeleiteter Meldung', () => {
  const BANNER_DEF_ID = 'entry-banner';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-author" name="Author Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="max-warriors" type="max" value="1" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="add" field="warning" value="{this} braucht eine Standarte"/>
            <modifier type="add" field="info" value="Nur mit Bannertraeger sinnvoll">
              <conditions>
                <condition type="atLeast" value="1" field="selections" scope="roster" childId="${BANNER_DEF_ID}"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_DEF_ID}" name="Banner" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  const report = evaluate(CATALOGUE_XML, {
    forces: [
      { defId: WARRIOR_DEF_ID, count: 2, children: [] },
      { defId: BANNER_DEF_ID, count: 1, children: [] },
    ],
  });

  it('fuehrt beide Herkuenfte in **einer** Liste, unterscheidbar am Diskriminator', () => {
    const origins = report.violations.map(message => message.origin);

    expect(origins).toContain(MessageOrigin.DERIVED_LIMIT);
    expect(origins).toContain(MessageOrigin.AUTHOR_MESSAGE);
  });

  it('uebernimmt den Schweregrad der Autor-Meldung aus dem Katalog, nicht aus der Grenze', () => {
    const severities = authorMessagesOf(report).map(message => message.severity);

    // Beide Modifikator-Bedingungen halten: die unbedingte Warnung und der Hinweis.
    expect(severities).toEqual([MessageSeverity.WARNING, MessageSeverity.INFO]);
    // Die abgeleitete Meldung daneben bleibt ein Fehler.
    expect(messageOf(report, 'max-warriors').severity).toBe(MessageSeverity.ERROR);
  });

  it('traegt den Katalogtext mit aufgeloestem `{this}` und keines der Grenzen-Felder', () => {
    const warning = authorMessagesOf(report).find(message => message.severity === MessageSeverity.WARNING);

    expect(warning.text).toBe('Warrior braucht eine Standarte');
    for (const field of ['limitId', 'limit', 'actual', 'bound', 'delta', 'derivation', 'causes']) {
      expect(field in warning, `Autor-Meldung darf kein Feld "${field}" tragen`).toBe(false);
    }
  });

  it('zeigt dieselbe Meldung am Slot und in der Liste — eine Quelle, zwei Sichten', () => {
    const warning = authorMessagesOf(report).find(message => message.severity === MessageSeverity.WARNING);
    const capability = report.capabilities.get(warning.anchor.path);

    expect(capability.authorMessages).toContainEqual({
      severity: MessageSeverity.WARNING,
      text: 'Warrior braucht eine Standarte',
    });
  });

  it('gibt einer abgeleiteten Meldung keinen Katalogtext', () => {
    expect('text' in messageOf(report, 'max-warriors')).toBe(false);
  });
});

// ── 3. Ursachen aus der Herleitungskette (ADR-0027) ──────────────────────────

describe('Ursachen: aus der Kette gelesen, an einer echten Auswertung', () => {
  const BANNER_DEF_ID = 'entry-banner';
  const MAX_WARRIORS_LIMIT_ID = 'max-warriors';
  // Der Fall aus ADR-0027: eine *andere* Auswahl setzt die Grenze auf 0.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-causes" name="Causes Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="3" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${MAX_WARRIORS_LIMIT_ID}" value="0">
              <conditions>
                <condition type="atLeast" value="1" field="selections" scope="roster" childId="${BANNER_DEF_ID}"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${BANNER_DEF_ID}" name="Battle Standard Bearer" type="upgrade"/>
      </selectionEntries>
    </catalogue>`;

  it('nennt die ausloesende Auswahl, wenn ein bedingter Modifikator den Grenzwert gesenkt hat', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        { defId: WARRIOR_DEF_ID, count: 1, children: [] },
        { defId: BANNER_DEF_ID, count: 1, children: [] },
      ],
    });

    const message = messageOf(report, MAX_WARRIORS_LIMIT_ID);
    expect(message.bound).toBe(0);
    expect(message.causes).toEqual([{
      witness: { defId: BANNER_DEF_ID, name: 'Battle Standard Bearer' },
      modifierKind: ModifierKind.SET,
      value: 0,
    }]);
    // Die Ursache ist genau der bedingte Schritt der Kette — keine zweite Herleitung.
    expect(message.derivation).toEqual({
      base: 3,
      steps: [expect.objectContaining({ isConditional: true, result: 0 })],
    });
  });

  it('laesst das Ursachen-Feld weg, wenn der Grenzwert unveraendert gilt', () => {
    // Ohne Bannertraeger greift der Modifikator nicht: die Grenze steht auf ihrem
    // Basiswert 3, und 4 Warrior verletzen sie ohne benennbare Ursache.
    const report = evaluate(CATALOGUE_XML, {
      forces: [{ defId: WARRIOR_DEF_ID, count: 4, children: [] }],
    });

    const message = messageOf(report, MAX_WARRIORS_LIMIT_ID);
    expect(message.bound).toBe(3);
    expect('causes' in message).toBe(false);
  });
});

// ── 4. Geschlossenheit der Wertevorraete ─────────────────────────────────────

describe('Geschlossene Wertevorraete der Einordnung', () => {
  it('kennt zu jedem gezaehlten Feld genau eine Messgroesse', () => {
    const fieldsByKind = {
      [CountedFieldKind.SELECTION_COUNT]: SELECTION_COUNT,
      [CountedFieldKind.FORCE_COUNT]: FORCE_COUNT,
      [CountedFieldKind.COST_SUM]: costSumField('any-cost-type'),
      [CountedFieldKind.LIMIT_VALUE]: limitValueField('any-cost-type'),
    };

    // Zweiseitig: jede Feldart hat eine Messgroesse, und keine Feldart fehlt.
    expect(Object.keys(fieldsByKind).sort()).toEqual(Object.values(CountedFieldKind).sort());
    const measures = Object.values(fieldsByKind).map(limitMeasureOfCountedField);
    expect(new Set(measures).size).toBe(measures.length);
    for (const measure of measures) {
      expect(Object.values(LimitMeasure)).toContain(measure);
    }
  });

  it('meldet ein gezaehltes Feld ohne Messgroesse laut, statt `undefined` durchzureichen', () => {
    expect(() => limitMeasureOfCountedField({ kind: 'erfundene-feldart' })).toThrow(/Messgroesse/);
  });

  it('haelt die Meldungs-Ankerarten als echte Obermenge der Slot-Ankerarten', () => {
    for (const anchorKind of Object.values(AnchorKind)) {
      expect(Object.values(MessageAnchorKind)).toContain(anchorKind);
    }
    // Genau ein zusaetzlicher Wert: der Roster, an dem die Budget-Regel haengt.
    expect(Object.values(MessageAnchorKind)).toHaveLength(Object.values(AnchorKind).length + 1);
    expect(Object.values(MessageAnchorKind)).toContain(MessageAnchorKind.ROSTER);
  });

  it('haelt die Rahmenarten als echte Obermenge der Rahmen-Schluesselwoerter', () => {
    for (const keyword of Object.values(ScopeKeyword)) {
      expect(Object.values(ScopeKind)).toContain(keyword);
    }
    // Genau zwei zusaetzliche Werte: die beiden ID-Rahmen.
    expect(Object.values(ScopeKind)).toHaveLength(Object.values(ScopeKeyword).length + 2);
  });
});

// ── 5. Akzeptanzbedingung 7: der Durchstich zum Anzeigetext ──────────────────

/**
 * Ein **Stellvertreter der Oberflaeche**: er waehlt allein aus der Einordnung
 * einen Textschluessel. Er steht hier und nicht in der Engine — die Zuordnung
 * Einordnung → Satz ist Vertrag der Oberflaeche (ADR-0034), und die Engine kennt
 * keinen i18n-Schluessel.
 *
 * Entscheidend ist, **wie** er waehlt: ueber Tabellen ueber geschlossenen
 * Aufzaehlungen. Ein fehlender Fall liefert deshalb keinen halbgaren Text, sondern
 * einen Fehler — genau die „Erkennbarkeit eines fehlenden Falls", die
 * Akzeptanzbedingung 7 verlangt. Kein Zweig liest je einen freien String, eine
 * Pfadform oder einen Namen.
 */
const MEASURE_TEXT_PARTS = Object.freeze({
  [LimitMeasure.SELECTION_COUNT]: 'anzahl',
  [LimitMeasure.FORCE_COUNT]: 'kontingente',
  [LimitMeasure.COST_SUM]: 'kosten',
  [LimitMeasure.BUDGET_LIMIT]: 'budgetgrenze',
  [LimitMeasure.ROSTER_BUDGET]: 'armeeZuTeuer',
});

const SCOPE_TEXT_PARTS = Object.freeze({
  [ScopeKind.ROSTER]: 'armeeweit',
  [ScopeKind.FORCE]: 'imKontingent',
  [ScopeKind.PARENT]: 'imUebergeordneten',
  [ScopeKind.SELF]: 'anSichSelbst',
  [ScopeKind.ENTRY_ID]: 'unterEintrag',
  [ScopeKind.CATEGORY_ID]: 'inKategorie',
});

const ANCHOR_TEXT_PARTS = Object.freeze({
  [MessageAnchorKind.OCCUPIED]: 'gewaehlt',
  [MessageAnchorKind.MANDATORY_PHANTOM]: 'fehlend',
  [MessageAnchorKind.GROUP_ANCHOR]: 'gruppe',
  [MessageAnchorKind.CATEGORY_ANCHOR]: 'kategorie',
  [MessageAnchorKind.OFFER_ANCHOR]: 'angebot',
  [MessageAnchorKind.ROSTER]: 'armee',
});

/** Liest einen Tabelleneintrag oder scheitert laut — nie stillschweigend `undefined`. */
function requiredPart(table, key, what) {
  const part = table[key];
  if (part === undefined) throw new Error(`Kein Anzeigetext fuer ${what} "${key}"`);
  return part;
}

/** Der Textschluessel einer abgeleiteten Meldung: Art × Messgroesse × Prozent × Rahmen. */
function derivedTextKey({ limit }) {
  return [
    'grenze',
    requiredPart({ [ConstraintKind.MIN]: 'min', [ConstraintKind.MAX]: 'max' }, limit.kind, 'Grenzenart'),
    requiredPart(MEASURE_TEXT_PARTS, limit.measure, 'Messgroesse'),
    ...(limit.isPercent ? ['prozent'] : []),
    requiredPart(SCOPE_TEXT_PARTS, limit.scope.kind, 'Rahmenart'),
  ].join('.');
}

/** Der Textschluessel je Herkunft — die Fallunterscheidung, die der Diskriminator traegt. */
const TEXT_KEY_BY_ORIGIN = Object.freeze({
  // Eine Autor-Meldung wird nicht uebersetzt: der Schluessel waehlt nur den Rahmen,
  // in den die Oberflaeche den Katalogtext stellt.
  [MessageOrigin.AUTHOR_MESSAGE]: message => `autor.${message.severity}`,
  [MessageOrigin.DERIVED_LIMIT]: derivedTextKey,
});

/** Der Anzeigetext-Schluessel einer Meldung, allein aus ihrer Einordnung. */
function displayTextKeyOf(message) {
  const textKeyOf = requiredPart(TEXT_KEY_BY_ORIGIN, message.origin, 'Herkunft');
  const anchorPart = requiredPart(ANCHOR_TEXT_PARTS, message.anchor.anchorKind, 'Ankerart');
  return `${textKeyOf(message)}@${anchorPart}`;
}

describe('Akzeptanzbedingung 7: aus der Einordnung folgt ein Anzeigetext ohne Rateschritt', () => {
  const MISSING_DEF_ID = 'entry-missing';
  // Ein Katalog, der die heute vorhandenen Meldungsarten gemeinsam ausloest.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-walkthrough" name="Walkthrough Catalogue">
      <categoryEntries>
        <categoryEntry id="${ELITE_CATEGORY_ID}" name="Elite"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army">
          <constraints>
            <constraint id="max-forces" type="max" value="0" field="forces" scope="roster"/>
          </constraints>
          <categoryLinks>
            <categoryLink id="clink-force-elite" name="Elite" targetId="${ELITE_CATEGORY_ID}">
              <constraints>
                <constraint id="max-elite-per-force" type="max" value="0" field="selections" scope="force"/>
              </constraints>
            </categoryLink>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <categoryLinks>
            <categoryLink id="clink-warrior" name="Elite" targetId="${ELITE_CATEGORY_ID}" primary="true"/>
          </categoryLinks>
          <costs><cost name="pts" typeId="${POINTS_COST_ID}" value="10"/></costs>
          <constraints>
            <constraint id="max-points" type="max" value="5" field="${POINTS_COST_ID}" scope="roster"/>
            <constraint id="max-budget" type="max" value="1" field="limit::${POINTS_COST_ID}" scope="roster"/>
            <constraint id="max-percent" type="max" value="50" percentValue="true" field="selections" scope="roster"/>
            <constraint id="min-self" type="min" value="9" field="selections" scope="self"/>
          </constraints>
          <modifiers>
            <modifier type="add" field="warning" value="{this} ist knapp"/>
          </modifiers>
          <selectionEntries>
            <selectionEntry id="${SHIELD_DEF_ID}" name="Shield" type="upgrade">
              <constraints>
                <constraint id="max-shield-in-warrior" type="max" value="0" field="selections" scope="${WARRIOR_DEF_ID}"/>
                <constraint id="max-shield-in-elite" type="max" value="0" field="selections" scope="${ELITE_CATEGORY_ID}" includeChildSelections="true"/>
              </constraints>
            </selectionEntry>
            <selectionEntry id="${MISSING_DEF_ID}" name="Missing" type="upgrade">
              <constraints>
                <constraint id="min-missing" type="min" value="1" field="selections" scope="parent"/>
              </constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  const report = evaluate(CATALOGUE_XML, {
    costLimits: [{ costTypeId: POINTS_COST_ID, value: 5 }],
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      children: [{ defId: WARRIOR_DEF_ID, count: 3, children: [{ defId: SHIELD_DEF_ID, count: 1, children: [] }] }],
    }],
  });

  it('bestimmt fuer **jede** Meldung des Berichts einen Schluessel, ohne je zu raten', () => {
    expect(report.violations.length).toBeGreaterThan(0);
    for (const message of report.violations) {
      expect(() => displayTextKeyOf(message), `Meldung ohne Anzeigetext: ${JSON.stringify(message)}`).not.toThrow();
    }
  });

  it('spielt die heute vorhandenen Meldungsarten durch — je Art genau ein Schluessel', () => {
    const keys = new Set(report.violations.map(displayTextKeyOf));

    expect([...keys].sort()).toEqual([
      // Autor-Meldung: der Schweregrad waehlt den Rahmen, der Text bleibt Katalogtext.
      'autor.warning@gewaehlt',
      // Beide Grenzenarten, alle fuenf Messgroessen, die Prozentform, alle sechs
      // Rahmenarten und vier der sechs Ankerarten (der Angebots-Anker meldet
      // grundsaetzlich nichts, der Gruppen-Anker ist oben eigens geprueft).
      'grenze.max.anzahl.imKontingent@kategorie',
      'grenze.max.anzahl.inKategorie@gewaehlt',
      'grenze.max.anzahl.prozent.armeeweit@gewaehlt',
      'grenze.max.anzahl.unterEintrag@gewaehlt',
      'grenze.max.armeeZuTeuer.armeeweit@armee',
      'grenze.max.budgetgrenze.armeeweit@gewaehlt',
      'grenze.max.kontingente.armeeweit@gewaehlt',
      'grenze.max.kosten.armeeweit@gewaehlt',
      'grenze.min.anzahl.anSichSelbst@gewaehlt',
      'grenze.min.anzahl.imUebergeordneten@fehlend',
    ].sort());
  });

  it('meldet einen fehlenden Fall, statt einen halbgaren Text zu liefern', () => {
    const unknownMeasure = { origin: MessageOrigin.DERIVED_LIMIT, anchor: { anchorKind: AnchorKind.OCCUPIED },
      limit: { kind: ConstraintKind.MAX, measure: 'neue-messgroesse', isPercent: false, scope: { kind: ScopeKind.ROSTER } } };

    expect(() => displayTextKeyOf(unknownMeasure)).toThrow(/Messgroesse/);
  });
});
