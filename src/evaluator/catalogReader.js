/**
 * Eigener, minimaler XML-Leser der Reinraum-Engine (ADR-0030: der Evaluator
 * liest entpacktes `.cat`/`.gst`-XML mit **eigenem** Parser, nie ueber
 * `src/parser/`). Er nutzt allein die Plattform-Primitive `DOMParser` (Browser
 * bzw. jsdom im Test) und erzeugt daraus das engine-eigene Definitionsmodell.
 *
 * Umfang: geschachtelte `selectionEntry`-Elemente mit ihren `costs` (Kostenart
 * per ID), ihren `categoryLinks` (Kategoriezugehoerigkeit per Ziel-ID) und ihren
 * `constraint`-Grenzen — MIN/MAX ueber Selektionsanzahl *und* Kostensummen,
 * Prozentgrenzen, alle Bezugsrahmen und die Zaehl-Flags (Issue 03). Dazu
 * `forceEntries` (Kontingent-Definitionen, auch geschachtelt) und
 * `categoryEntries` (Kategorie-Definitionen), damit die Join-Schicht Kontingente
 * und Kategorien kennt. Dazu die **Datensatz-Metadaten** der Katalogwurzel, die
 * ohne Roster gebraucht werden (ADR-0034): die Kostenart-Deklarationen
 * (`costTypes`), die Profiltypen mit ihren Charakteristik-Typen (`profileTypes` —
 * die Quelle der IDs, ueber die ein Modifikator eine Charakteristik adressiert) und
 * das `library`-Kennzeichen. Dazu die **gemeinsame `EntryBase`-Basis** jedes
 * Elements (Catalogue.xsd:102-115) — ID, Name, `hidden`, Modifikatoren und
 * Modifikatorgruppen —, die damit auch an Profilen, Regeln, Info-Gruppen und
 * Info-Verweisen gelesen wird, sowie den **Regeltext** einer Regel
 * (`<description>`), den die Info-Projektion des Berichts durchreicht. Kein
 * ZIP-Entpacken, kein XSD-Gate, keine Link-Ketten/Importe
 * (Resolver-Ausbaustufen spaeter).
 */

import {
  SELECTION_COUNT,
  FORCE_COUNT,
  costSumField,
  limitValueField,
  LIMIT_FIELD_PREFIX,
  ConditionKind,
  ConditionGroupKind,
  ModifierKind,
  ConstraintKind,
  DefinitionKind,
  InfoElementKind,
  InfoLinkKind,
  DiagnosticKind,
  DEFAULT_FLAGS,
  diagnostic,
} from './model.js';

const Tag = Object.freeze({
  SELECTION_ENTRIES: 'selectionEntries',
  SELECTION_ENTRY: 'selectionEntry',
  SELECTION_ENTRY_GROUPS: 'selectionEntryGroups',
  SELECTION_ENTRY_GROUP: 'selectionEntryGroup',
  ENTRY_LINKS: 'entryLinks',
  ENTRY_LINK: 'entryLink',
  CATALOGUE_LINKS: 'catalogueLinks',
  CATALOGUE_LINK: 'catalogueLink',
  // Katalogweit geteilte Auswahl-Definitionen — die ueblichen `entryLink`-Ziele.
  SHARED_SELECTION_ENTRIES: 'sharedSelectionEntries',
  SHARED_SELECTION_ENTRY_GROUPS: 'sharedSelectionEntryGroups',
  FORCE_ENTRIES: 'forceEntries',
  FORCE_ENTRY: 'forceEntry',
  // Die Kostenart-Deklarationen des Datensatzes (Wurzelelement, Catalogue.xsd:712).
  COST_TYPES: 'costTypes',
  COST_TYPE: 'costType',
  CATEGORY_ENTRIES: 'categoryEntries',
  CATEGORY_ENTRY: 'categoryEntry',
  CATEGORY_LINKS: 'categoryLinks',
  CATEGORY_LINK: 'categoryLink',
  CONSTRAINTS: 'constraints',
  CONSTRAINT: 'constraint',
  COSTS: 'costs',
  COST: 'cost',
  MODIFIERS: 'modifiers',
  MODIFIER: 'modifier',
  MODIFIER_GROUPS: 'modifierGroups',
  MODIFIER_GROUP: 'modifierGroup',
  CONDITIONS: 'conditions',
  CONDITION: 'condition',
  CONDITION_GROUPS: 'conditionGroups',
  CONDITION_GROUP: 'conditionGroup',
  REPEATS: 'repeats',
  REPEAT: 'repeat',
  PROFILES: 'profiles',
  PROFILE: 'profile',
  RULES: 'rules',
  RULE: 'rule',
  DESCRIPTION: 'description',
  INFO_GROUPS: 'infoGroups',
  INFO_GROUP: 'infoGroup',
  INFO_LINKS: 'infoLinks',
  INFO_LINK: 'infoLink',
  CHARACTERISTICS: 'characteristics',
  CHARACTERISTIC: 'characteristic',
  // Die Profiltyp-Deklarationen des Datensatzes mit ihren Charakteristik-Typen
  // (Wurzelelement, Catalogue.xsd:65-83). Sie sind die Quelle der
  // Charakteristik-Typ-IDs, ueber die ein Modifikator eine Charakteristik adressiert.
  PROFILE_TYPES: 'profileTypes',
  PROFILE_TYPE: 'profileType',
  CHARACTERISTIC_TYPES: 'characteristicTypes',
  CHARACTERISTIC_TYPE: 'characteristicType',
  // Katalogweit geteilte Info-Definitionen (die ueblichen `infoLink`-Ziele).
  SHARED_PROFILES: 'sharedProfiles',
  SHARED_RULES: 'sharedRules',
  SHARED_INFO_GROUPS: 'sharedInfoGroups',
});

const Attr = Object.freeze({
  ID: 'id',
  NAME: 'name',
  TYPE: 'type',
  TYPE_ID: 'typeId',
  TARGET_ID: 'targetId',
  // Die Spielsystem-Id, auf die sich ein `.cat` bezieht (Wurzelattribut). Eine
  // `.gst` traegt sie nicht — ihre eigene `id` **ist** die Spielsystem-Id.
  GAME_SYSTEM_ID: 'gameSystemId',
  FIELD: 'field',
  VALUE: 'value',
  // Trennzeichen, mit dem ein `append`/`prepend`-Modifikator seinen Text an den
  // vorhandenen anfuegt. Vendored Abweichung der Definitive Edition, in der
  // Catalogue.xsd ausdruecklich als optionales Attribut festgehalten (ADR-0016).
  JOIN: 'join',
  SCOPE: 'scope',
  CHILD_ID: 'childId',
  // `<repeat>`: wie oft der Modifikator je erreichtem `value` wirkt, und ob der
  // Quotient auf- statt abgerundet wird (Catalogue.xsd:541-548).
  REPEATS: 'repeats',
  ROUND_UP: 'roundUp',
  PERCENT_VALUE: 'percentValue',
  // Wurzelattribut eines `.cat`: true kennzeichnet eine reine **Bibliothek**, die
  // nur per `catalogueLink` bezogen und nicht eigenstaendig gespielt wird
  // (Catalogue.xsd:762).
  LIBRARY: 'library',
  // Basisattribut jeder Definition und jeder Kostenart: der Katalogautor blendet
  // sie aus (Catalogue.xsd:92, 111).
  HIDDEN: 'hidden',
  // Vorgabe-Kostengrenze einer Kostenart (Catalogue.xsd:89).
  DEFAULT_COST_LIMIT: 'defaultCostLimit',
  SHARED: 'shared',
  INCLUDE_CHILD_SELECTIONS: 'includeChildSelections',
  INCLUDE_CHILD_FORCES: 'includeChildForces',
});

/** Die gueltigen `type`-Werte einer Bedingung (SSOT-Enum {@link ConditionKind}). */
const CONDITION_KINDS = Object.freeze(new Set(Object.values(ConditionKind)));

/** Die gueltigen `type`-Werte einer Bedingungsgruppe (SSOT-Enum {@link ConditionGroupKind}). */
const CONDITION_GROUP_KINDS = Object.freeze(new Set(Object.values(ConditionGroupKind)));

/** Die gueltigen `type`-Werte eines Modifikators (SSOT-Enum {@link ModifierKind}). */
const MODIFIER_KINDS = Object.freeze(new Set(Object.values(ModifierKind)));

/** Die gueltigen `type`-Werte einer Grenze (SSOT-Enum {@link ConstraintKind}). */
const CONSTRAINT_KINDS = Object.freeze(new Set(Object.values(ConstraintKind)));

/** Die gueltigen Verweistypen eines `infoLink` (SSOT-Enum {@link InfoLinkKind}). */
const INFO_LINK_KINDS = Object.freeze(new Set(Object.values(InfoLinkKind)));

/** Das `field`-Attribut, das die Selektionsanzahl statt einer Kostenart meint. */
const SELECTION_COUNT_FIELD_XML = 'selections';
const FORCE_COUNT_FIELD_XML = 'forces';

/** Vorgabe fuer ein fehlendes `repeats`: eine Anwendung je erreichtem Schritt. */
const SINGLE_REPEAT = 1;

/** XSD-Vorgabe des `hidden`-Attributs: sichtbar (Catalogue.xsd:92, 111). */
const DEFAULT_HIDDEN = false;

/** XSD-Vorgabe des `library`-Attributs: ein spielbarer Katalog (Catalogue.xsd:762). */
const DEFAULT_LIBRARY = false;

/**
 * Der Katalogwert, mit dem eine Kostenart **keine** Vorgabe-Grenze deklariert
 * (XSD-Vorgabe von `defaultCostLimit`, Catalogue.xsd:89). Er wird beim Lesen auf
 * "keine Grenze" (`null`) abgebildet, damit kein Leser den Sentinel als Zahl
 * weiterrechnet.
 */
const NO_DEFAULT_COST_LIMIT = -1;

const BOOLEAN_TRUE_XML = 'true';
const BOOLEAN_FALSE_XML = 'false';
const XML_MIME_TYPE = 'application/xml';

/**
 * Bildet das `field`-Attribut einer Grenze auf das engine-eigene Feld ab.
 * `"selections"` meint die Selektionsanzahl; ein `limit::<costTypeId>`-Praefix
 * die **eingestellte Kostengrenze** dieser Kostenart (`LIMIT_VALUE`, aus dem
 * Roster-Budget statt dem Zaehlindex); jeder andere Wert ist die **ID** einer
 * Kostenart (Battlescribe kodiert Kosten-Grenzen ueber die Kostenart-ID im
 * `field`-Attribut) und wird zur verplanten Summe `COST_SUM(costTypeId)`.
 */
function readField(fieldAttr) {
  if (fieldAttr === null || fieldAttr === '') return undefined;
  if (fieldAttr === SELECTION_COUNT_FIELD_XML) return SELECTION_COUNT;
  if (fieldAttr === FORCE_COUNT_FIELD_XML) return FORCE_COUNT;
  if (fieldAttr.startsWith(LIMIT_FIELD_PREFIX)) {
    return limitValueField(fieldAttr.slice(LIMIT_FIELD_PREFIX.length));
  }
  return costSumField(fieldAttr);
}

/** Direkte Kind-Elemente eines Elements mit gegebenem Tag-Namen. */
function directChildren(element, tagName) {
  const result = [];
  if (!element) return result;
  for (const child of element.children) {
    if (child.tagName === tagName) result.push(child);
  }
  return result;
}

/** Elemente unter einem Wrapper-Tag (z. B. entry > constraints > constraint). */
function wrappedChildren(element, wrapperTag, tagName) {
  const wrapper = directChildren(element, wrapperTag)[0];
  return directChildren(wrapper, tagName);
}

/**
 * Liest ein Boolean-Attribut mit gegebener Vorgabe. Ein fehlendes oder leeres
 * Attribut faellt auf `defaultValue` zurueck (Battlescribe-XSD-Vorgaben, z. B.
 * `shared` standardmaessig true).
 */
function readBoolean(element, attr, defaultValue) {
  const raw = element.getAttribute(attr);
  if (raw === BOOLEAN_TRUE_XML) return true;
  if (raw === BOOLEAN_FALSE_XML) return false;
  return defaultValue;
}

/**
 * Liest die Zaehl-Flags einer Query. Vorgabe nach XSD `QueryBase`: `shared` ist
 * true, `includeChildSelections`/`includeChildForces` sind false.
 */
function readFlags(element) {
  return {
    shared: readBoolean(element, Attr.SHARED, DEFAULT_FLAGS.shared),
    includeChildSelections: readBoolean(element, Attr.INCLUDE_CHILD_SELECTIONS, DEFAULT_FLAGS.includeChildSelections),
    includeChildForces: readBoolean(element, Attr.INCLUDE_CHILD_FORCES, DEFAULT_FLAGS.includeChildForces),
  };
}

/**
 * Liest das `scope`-Attribut. Ein Bezugsrahmen ist entweder ein Schluesselwort
 * (roster/force/parent/self — deren XML-Wert dem engine-eigenen Wert gleicht)
 * oder eine **ID** (Eintrag/Kategorie), die unveraendert durchgereicht wird. Ein
 * leeres Attribut ist kein gueltiger Scope.
 */
function readScope(scopeAttr) {
  return scopeAttr ? scopeAttr : undefined;
}

/**
 * Liest eine einzelne `<constraint>` in eine `LimitDef` oder meldet eine
 * Diagnose, falls ihr Vokabular ausserhalb des Umfangs liegt — nie still
 * verschluckt (`docs/evaluator-architecture.md` §5, Risiko 4).
 */
function readConstraint(constraintEl, diagnostics) {
  const id = constraintEl.getAttribute(Attr.ID);
  const type = constraintEl.getAttribute(Attr.TYPE);
  const kind = CONSTRAINT_KINDS.has(type) ? type : undefined;
  const field = readField(constraintEl.getAttribute(Attr.FIELD));
  const scope = readScope(constraintEl.getAttribute(Attr.SCOPE));
  const value = Number.parseFloat(constraintEl.getAttribute(Attr.VALUE));
  const isPercent = constraintEl.getAttribute(Attr.PERCENT_VALUE) === BOOLEAN_TRUE_XML;

  if (kind === undefined || field === undefined || scope === undefined || Number.isNaN(value)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_CONSTRAINT, {
      constraintId: id,
      type: constraintEl.getAttribute(Attr.TYPE),
      field: constraintEl.getAttribute(Attr.FIELD),
      scope: constraintEl.getAttribute(Attr.SCOPE),
    }));
    return null;
  }
  return { id, kind, field, scope, value, isPercent, flags: readFlags(constraintEl) };
}

/** Liest die Grenzen eines Eintrags. */
function readLimits(entryEl, diagnostics) {
  return wrappedChildren(entryEl, Tag.CONSTRAINTS, Tag.CONSTRAINT)
    .map(constraintEl => readConstraint(constraintEl, diagnostics))
    .filter(limit => limit !== null);
}

/**
 * Liest die Basiskosten eines Eintrags als Abbildung Kostenart-ID → Wert.
 * Kostenarten werden **per ID** (`typeId`), nie per Name, gefuehrt.
 */
function readCosts(entryEl) {
  const costs = {};
  for (const costEl of wrappedChildren(entryEl, Tag.COSTS, Tag.COST)) {
    const costTypeId = costEl.getAttribute(Attr.TYPE_ID);
    const value = Number.parseFloat(costEl.getAttribute(Attr.VALUE));
    if (costTypeId !== null && !Number.isNaN(value)) {
      costs[costTypeId] = value;
    }
  }
  return costs;
}

/**
 * Liest die Kategoriezugehoerigkeit eines Eintrags als Menge von Kategorie-IDs
 * (Ziel-ID des `categoryLink`, nie der Name — ADR-0003). Das sind die
 * **Basis**-Kategorien; Modifikatoren leiten daraus in Slice 04 die effektiven ab.
 */
function readCategoryIds(entryEl) {
  return wrappedChildren(entryEl, Tag.CATEGORY_LINKS, Tag.CATEGORY_LINK)
    .map(linkEl => linkEl.getAttribute(Attr.TARGET_ID))
    .filter(targetId => targetId !== null && targetId !== '');
}

/**
 * Liest eine einzelne `<condition>` einer Bedingung in ihre `ConditionDef` oder
 * meldet eine Diagnose, falls ihr Vokabular ausserhalb des Umfangs liegt. Ein
 * fehlendes `childId` bedeutet "alles im Rahmen" (Ziel `null`).
 */
function readCondition(conditionEl, diagnostics) {
  const type = conditionEl.getAttribute(Attr.TYPE);
  const field = readField(conditionEl.getAttribute(Attr.FIELD));
  const scope = readScope(conditionEl.getAttribute(Attr.SCOPE));
  const value = Number.parseFloat(conditionEl.getAttribute(Attr.VALUE));
  if (!CONDITION_KINDS.has(type) || field === undefined || scope === undefined || Number.isNaN(value)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_CONDITION, {
      type,
      field: conditionEl.getAttribute(Attr.FIELD),
      scope: conditionEl.getAttribute(Attr.SCOPE),
    }));
    return null;
  }
  return {
    type,
    field,
    scope,
    targetChildId: conditionEl.getAttribute(Attr.CHILD_ID) === 'any' ? null : conditionEl.getAttribute(Attr.CHILD_ID),
    value,
    flags: readFlags(conditionEl),
  };
}

/**
 * Liest die direkten Bedingungen eines Elements (Modifikator, Bedingungsgruppe
 * oder Modifikatorgruppe) — leer, wenn keine vorhanden.
 */
function readConditions(element, diagnostics) {
  return wrappedChildren(element, Tag.CONDITIONS, Tag.CONDITION)
    .map(conditionEl => readCondition(conditionEl, diagnostics))
    .filter(condition => condition !== null);
}

/**
 * Liest eine einzelne `<conditionGroup>` **rekursiv** in ihre `ConditionGroupDef`:
 * ihre `type`-Verknuepfung ({@link ConditionGroupKind} `and`/`or`), ihre direkten
 * Bedingungen und ihre verschachtelten Untergruppen (beliebige Tiefe). Ein `type`
 * ausserhalb des SSOT-Enums wird als Diagnose gemeldet, nie still verschluckt
 * (`docs/issues/.../design.md`, Kontrakt `ConditionGroupDef`).
 */
function readConditionGroup(groupEl, diagnostics) {
  const type = groupEl.getAttribute(Attr.TYPE);
  if (!CONDITION_GROUP_KINDS.has(type)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_CONDITION_GROUP, { type }));
    return null;
  }
  return {
    type,
    conditions: readConditions(groupEl, diagnostics),
    groups: readConditionGroups(groupEl, diagnostics),
  };
}

/**
 * Liest die direkten Bedingungsgruppen eines Elements (Modifikator,
 * Bedingungsgruppe oder Modifikatorgruppe) — leer, wenn keine vorhanden.
 */
function readConditionGroups(element, diagnostics) {
  return wrappedChildren(element, Tag.CONDITION_GROUPS, Tag.CONDITION_GROUP)
    .map(groupEl => readConditionGroup(groupEl, diagnostics))
    .filter(group => group !== null);
}

/**
 * Liest eine einzelne `<repeat>` einer Wiederholung in ihre `RepeatDef` oder
 * meldet eine Diagnose.
 *
 * Die XSD leitet `Repeat` von `QueryFilteredBase` ab (Catalogue.xsd:541-548):
 * die **Schrittweite** steht im geerbten `value` (`QueryBase`, Catalogue.xsd:427)
 * — ein eigenes `perValue`-Attribut gibt es nicht. `repeats` (Pflicht laut XSD,
 * defensiv auf 1 vorbelegt) ist die Zahl der Anwendungen **je** erreichtem
 * Schritt, `roundUp` rundet den Quotienten auf statt ab. Die engine-eigene
 * `RepeatDef` nennt die Schrittweite `perValue` ("je N"), weil sie dort als
 * Divisor auftritt ({@link ../evaluator/modifiers.js}).
 *
 * Die Schrittweite muss eine Zahl ungleich 0 sein (0 gaebe eine Division durch
 * null); ein unlesbarer Wert wird als Diagnose gemeldet, nie still verschluckt.
 */
function readRepeat(repeatEl, diagnostics) {
  const field = readField(repeatEl.getAttribute(Attr.FIELD));
  const scope = readScope(repeatEl.getAttribute(Attr.SCOPE));
  const perValue = Number.parseFloat(repeatEl.getAttribute(Attr.VALUE));
  const repeatsAttr = repeatEl.getAttribute(Attr.REPEATS);
  const repeats = repeatsAttr === null ? SINGLE_REPEAT : Number.parseInt(repeatsAttr, 10);
  if (field === undefined || scope === undefined || Number.isNaN(perValue) || perValue === 0 || Number.isNaN(repeats)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_REPEAT, {
      field: repeatEl.getAttribute(Attr.FIELD),
      scope: repeatEl.getAttribute(Attr.SCOPE),
      value: repeatEl.getAttribute(Attr.VALUE),
      repeats: repeatsAttr,
    }));
    return null;
  }
  return {
    field,
    scope,
    targetChildId: repeatEl.getAttribute(Attr.CHILD_ID) === 'any' ? null : repeatEl.getAttribute(Attr.CHILD_ID),
    perValue,
    repeats,
    roundUp: readBoolean(repeatEl, Attr.ROUND_UP, false),
    flags: readFlags(repeatEl),
  };
}

/** Liest die Wiederholungen eines Modifikators (leer, wenn keine vorhanden). */
function readRepeats(modifierEl, diagnostics) {
  return wrappedChildren(modifierEl, Tag.REPEATS, Tag.REPEAT)
    .map(repeatEl => readRepeat(repeatEl, diagnostics))
    .filter(repeat => repeat !== null);
}

/**
 * Liest einen einzelnen `<modifier>` kanonisch (BattleScribe-XSD): die Art an
 * `type` ({@link ModifierKind}), das Ziel roh im `field`-String und der rohe
 * `value`-String. `field` und `value` bleiben **ungeparst** — der Resolver loest
 * `field` genau einmal in einen `TargetDescriptor` auf, das `value`-Parsen bleibt
 * der Apply-Schicht ueberlassen (`docs/issues/.../design.md`, Kontrakt `ModifierDef`).
 * Ein `type` ausserhalb des SSOT-Enums wird als Diagnose gemeldet, nie still
 * verschluckt.
 */
function readModifier(modifierEl, diagnostics) {
  const kind = modifierEl.getAttribute(Attr.TYPE);
  const field = modifierEl.getAttribute(Attr.FIELD);
  const value = modifierEl.getAttribute(Attr.VALUE);
  if (!MODIFIER_KINDS.has(kind)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, { type: kind, field, value }));
    return null;
  }
  return {
    kind,
    field,
    value,
    // `null`, wenn der Katalog kein Trennzeichen deklariert: dann wird der Text
    // ohne Trenner angefuegt.
    join: modifierEl.getAttribute(Attr.JOIN),
    conditions: readConditions(modifierEl, diagnostics),
    conditionGroups: readConditionGroups(modifierEl, diagnostics),
    repeats: readRepeats(modifierEl, diagnostics),
  };
}

/**
 * Liest die Modifikatoren eines Knotens **in Dokumentreihenfolge** — die
 * Reihenfolge im Array ist die Semantik (`docs/evaluator-architecture.md` §4.1).
 */
function readModifiers(element, diagnostics) {
  return wrappedChildren(element, Tag.MODIFIERS, Tag.MODIFIER)
    .map(modifierEl => readModifier(modifierEl, diagnostics))
    .filter(modifier => modifier !== null);
}

/**
 * Liest eine einzelne `<modifierGroup>` **rekursiv** in ihre `ModifierGroupDef`:
 * ihre gemeinsame Gruppen-Bedingung (`conditions` **und** `conditionGroups`), die
 * von ihr gebuendelten Modifikatoren und ihre verschachtelten Untergruppen
 * (`modifierGroups`, beliebige Tiefe — die XSD definiert `ModifierGroup` mit einem
 * eigenen `modifierGroups`-Element, Catalogue.xsd:523-538). Haelt die
 * Gruppen-Bedingung, greifen alle Modifikatoren der Gruppe gemeinsam und ihre
 * Untergruppen werden weiter ausgewertet (Auswertung in {@link ./modifiers.js}),
 * sonst entfaellt die Gruppe samt Untergruppen gemeinsam
 * (`docs/issues/.../design.md`, Kontrakt `ModifierGroupDef`).
 *
 * `ModifierGroup` erbt zudem `repeats` von `ModifierBase` (Catalogue.xsd:469-479).
 * Volle Repeat-Semantik fuer eine *ganze* Gruppe ist bewusst **nicht** im Umfang;
 * ein nicht-leeres `<repeats>` wird deshalb als sichtbare Grenze gemeldet, nie
 * still verschluckt (§5, Risiko 4).
 */
function readModifierGroup(groupEl, diagnostics) {
  if (wrappedChildren(groupEl, Tag.REPEATS, Tag.REPEAT).length > 0) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER_GROUP_REPEAT, {}));
  }
  return {
    conditions: readConditions(groupEl, diagnostics),
    conditionGroups: readConditionGroups(groupEl, diagnostics),
    modifiers: readModifiers(groupEl, diagnostics),
    modifierGroups: readModifierGroups(groupEl, diagnostics),
  };
}

/**
 * Liest die Modifikatorgruppen eines Knotens **in Dokumentreihenfolge** (leer,
 * wenn keine vorhanden) — analog zu {@link readModifiers}.
 */
function readModifierGroups(element, diagnostics) {
  return wrappedChildren(element, Tag.MODIFIER_GROUPS, Tag.MODIFIER_GROUP)
    .map(groupEl => readModifierGroup(groupEl, diagnostics));
}

/**
 * Liest die **gemeinsame Basis** jedes Katalog-Elements des `EntryBase`-Zweigs
 * (Catalogue.xsd:102-115): Auswahl-Definitionen, Kontingente, Kategorien, Verweise
 * **und** Info-Elemente teilen ID, Namen, das `hidden`-Kennzeichen sowie
 * Modifikatoren und Modifikatorgruppen. Die eine Lesestelle haelt sie
 * deckungsgleich — insbesondere traegt damit auch ein Profil oder ein Info-Verweis
 * seine Modifikatoren, die die Engine bisher gar nicht kannte (Issue 75/04).
 */
function readEntryBase(element, diagnostics) {
  return {
    id: element.getAttribute(Attr.ID),
    name: element.getAttribute(Attr.NAME),
    isHidden: readBoolean(element, Attr.HIDDEN, DEFAULT_HIDDEN),
    modifiers: readModifiers(element, diagnostics),
    modifierGroups: readModifierGroups(element, diagnostics),
  };
}

/**
 * Liest eine einzelne `<characteristic>` eines Profils in ihren rohen Wert:
 * benannt (`name`), typisiert per ID (`typeId`) und mit dem Textinhalt als Wert.
 * Rein beschreibend — kein Constraint, kein Modifikator.
 */
function readCharacteristic(characteristicEl) {
  return {
    name: characteristicEl.getAttribute(Attr.NAME),
    typeId: characteristicEl.getAttribute(Attr.TYPE_ID),
    value: characteristicEl.textContent,
  };
}

/**
 * Liest ein `<profile>` (Info-Element `ProfileDef`): seine `EntryBase`-Basis, die
 * Profiltyp-ID (`typeId`) und seine Merkmale (`characteristics`). Die
 * Modifikatoren der Basis sind hier tragend: **jeder** Charakteristik-Modifikator
 * der Katalogdaten haengt an einem Profil oder an einem Info-Verweis, nie an einer
 * Auswahl-Definition (Issue 75/04, Beleg in der Szenario-Doku).
 */
function readProfile(profileEl, diagnostics) {
  return {
    ...readEntryBase(profileEl, diagnostics),
    kind: InfoElementKind.PROFILE,
    typeId: profileEl.getAttribute(Attr.TYPE_ID),
    characteristics: wrappedChildren(profileEl, Tag.CHARACTERISTICS, Tag.CHARACTERISTIC).map(readCharacteristic),
  };
}

/**
 * Liest ein `<rule>` (Info-Element `RuleDef`): seine `EntryBase`-Basis und den
 * **Regeltext** (`<description>`, XSD optional — 10 der 1157 Regeln der
 * Fixture-Kataloge tragen keinen, dann `null`).
 *
 * Der Evaluator *bewertet* den Text nach wie vor nicht; er reicht ihn nur in die
 * Info-Projektion des Berichts durch (Issue 75/06, Kontrakt „Profile und
 * Regeltexte je Slot"). Er ist bewusst kein Modifikator-Ziel: kein Modifikator
 * der Fixture-Kataloge adressiert `description`, der Text ist also statisch.
 */
function readRule(ruleEl, diagnostics) {
  return {
    ...readEntryBase(ruleEl, diagnostics),
    kind: InfoElementKind.RULE,
    text: readRuleText(ruleEl),
  };
}

/** Der Textinhalt der `<description>` einer Regel (`null`, wenn sie keine traegt). */
function readRuleText(ruleEl) {
  const description = directChildren(ruleEl, Tag.DESCRIPTION)[0];
  return description === undefined ? null : description.textContent;
}

/**
 * Liest ein `<infoGroup>` (Info-Element `InfoGroupDef`) **rekursiv**: seine
 * `EntryBase`-Basis und die von ihm gebuendelten Info-Elemente (`infos`, beliebige
 * Tiefe) — verschachtelte Profile, Regeln, Info-Gruppen und Info-Links
 * (`docs/issues/.../design.md`, Kontrakt `InfoGroupDef`).
 */
function readInfoGroup(infoGroupEl, diagnostics) {
  return {
    ...readEntryBase(infoGroupEl, diagnostics),
    kind: InfoElementKind.INFO_GROUP,
    infos: readInfos(infoGroupEl, diagnostics),
  };
}

/**
 * Liest ein `<infoLink>` (Info-Element `InfoLinkDef`): seine `EntryBase`-Basis,
 * den Verweistyp (`type`, aus dem SSOT-Enum {@link InfoLinkKind}) und die
 * Ziel-ID (`targetId`). Ein `type` ausserhalb des SSOT-Enums wird zu `null`
 * normalisiert — der Resolver loest den Link ueber `targetId` auf, unabhaengig
 * vom Typ (`docs/issues/.../design.md`, Kontrakt `InfoLinkDef`).
 */
function readInfoLink(infoLinkEl, diagnostics) {
  const type = infoLinkEl.getAttribute(Attr.TYPE);
  return {
    ...readEntryBase(infoLinkEl, diagnostics),
    kind: InfoElementKind.INFO_LINK,
    type: INFO_LINK_KINDS.has(type) ? type : null,
    targetId: infoLinkEl.getAttribute(Attr.TARGET_ID),
    resolved: null,
  };
}

/**
 * Liest die reinen Info-**Definitionen** (Profile, Regeln, Info-Gruppen) eines
 * Elements aus den gegebenen Wrapper-Tags — der einzige Unterschied zwischen den
 * regulaeren (`profiles`/…) und den katalogweit geteilten (`sharedProfiles`/…)
 * Wrappern ist der Wrapper-Name.
 */
function readInfoDefinitions(element, diagnostics, profilesTag, rulesTag, infoGroupsTag) {
  return [
    ...wrappedChildren(element, profilesTag, Tag.PROFILE).map(profileEl => readProfile(profileEl, diagnostics)),
    ...wrappedChildren(element, rulesTag, Tag.RULE).map(ruleEl => readRule(ruleEl, diagnostics)),
    ...wrappedChildren(element, infoGroupsTag, Tag.INFO_GROUP).map(groupEl => readInfoGroup(groupEl, diagnostics)),
  ];
}

/**
 * Liest die Info-Elemente eines Knotens (Eintrag, Kontingent, Kategorie oder
 * Info-Gruppe) aus dem InfoNodeGroup-Zweig der BattleScribe-XSD: Profile, Regeln,
 * Info-Gruppen und Info-Links — leer, wenn keine vorhanden.
 */
function readInfos(element, diagnostics) {
  return [
    ...readInfoDefinitions(element, diagnostics, Tag.PROFILES, Tag.RULES, Tag.INFO_GROUPS),
    ...wrappedChildren(element, Tag.INFO_LINKS, Tag.INFO_LINK).map(linkEl => readInfoLink(linkEl, diagnostics)),
  ];
}

/**
 * Liest die Info-Elemente des Katalog-Wurzelknotens: die knoteneigenen
 * (`profiles`/`rules`/`infoGroups`/`infoLinks`) **und** die katalogweit geteilten
 * (`sharedProfiles`/`sharedRules`/`sharedInfoGroups`), die die ueblichen Ziele der
 * `infoLink`-Verweise sind.
 */
function readCatalogueInfos(root, diagnostics) {
  return [
    ...readInfos(root, diagnostics),
    ...readInfoDefinitions(root, diagnostics, Tag.SHARED_PROFILES, Tag.SHARED_RULES, Tag.SHARED_INFO_GROUPS),
  ];
}

/**
 * Liest einen `<profileType>` samt seiner `<characteristicType>`-Deklarationen:
 * die **Quelle der Charakteristik-Typ-IDs**, ueber die ein Modifikator eine
 * Charakteristik adressiert (Catalogue.xsd:49-83). Reine Datensatz-Angabe ohne
 * Roster-Bezug — sie beschreibt, *welche* Merkmale es gibt, nicht welche gelten.
 */
function readProfileType(profileTypeEl) {
  return {
    id: profileTypeEl.getAttribute(Attr.ID),
    name: profileTypeEl.getAttribute(Attr.NAME),
    characteristicTypes: wrappedChildren(profileTypeEl, Tag.CHARACTERISTIC_TYPES, Tag.CHARACTERISTIC_TYPE)
      .map(characteristicTypeEl => ({
        id: characteristicTypeEl.getAttribute(Attr.ID),
        name: characteristicTypeEl.getAttribute(Attr.NAME),
      })),
  };
}

/** Liest alle `<profileType>`-Deklarationen der Katalogwurzel. */
function readProfileTypes(root) {
  return wrappedChildren(root, Tag.PROFILE_TYPES, Tag.PROFILE_TYPE).map(readProfileType);
}

/** Liest einen `<selectionEntry>` samt Kosten, Kategorien, Grenzen und Modifikatoren. */
function readEntry(entryEl, diagnostics) {
  return {
    ...readEntryBase(entryEl, diagnostics),
    kind: DefinitionKind.ENTRY,
    type: entryEl.getAttribute(Attr.TYPE),
    costs: readCosts(entryEl),
    categoryIds: readCategoryIds(entryEl),
    limits: readLimits(entryEl, diagnostics),
    infos: readInfos(entryEl, diagnostics),
    children: readSelectionChildren(entryEl, diagnostics),
  };
}

/**
 * Liest einen `<selectionEntryGroup>` (Bündel von Auswahl-Optionen, {@link
 * DefinitionKind.GROUP}). Er traegt keine eigenen Kosten (Optionen tragen die
 * Kosten), aber Grenzen/Modifikatoren und geschachtelte Auswahl-Kinder. Er ist
 * ein **Verweisziel** eines `entryLink` und wird deshalb indiziert; als reines
 * Bündel synthetisiert er selbst keinen Pflicht-Phantom (Resolver: nicht in der
 * Wurzel-Definitionsliste, ADR-0032).
 */
function readGroup(groupEl, diagnostics) {
  return {
    ...readEntryBase(groupEl, diagnostics),
    kind: DefinitionKind.GROUP,
    limits: readLimits(groupEl, diagnostics),
    infos: readInfos(groupEl, diagnostics),
    children: readSelectionChildren(groupEl, diagnostics),
  };
}

/**
 * Liest einen `<entryLink>` ({@link DefinitionKind.ENTRY_LINK}): den Verweis auf
 * eine importierte Definition (`targetId`) samt der **eigenen** Grenzen/
 * Modifikatoren/Kategorien. `resolved` bleibt `null`, bis der Resolver das Ziel
 * ueber die globale `id → Definition`-Tabelle auffindet (ADR-0032, analog
 * {@link readInfoLink}); das aufgeloeste Ziel wird auf `resolved` vermerkt. Eine
 * Per-Vorkommen-Ueberlagerung der eigenen Grenzen auf das Ziel wird heute noch
 * nicht angewandt (die auswertenden Schichten lesen `resolved` nicht) — bewusst,
 * siehe die Reconciliation von Issue 67/02. Geschachtelte Links/Eintraege werden
 * mitgelesen.
 */
function readEntryLink(entryLinkEl, diagnostics) {
  return {
    ...readEntryBase(entryLinkEl, diagnostics),
    kind: DefinitionKind.ENTRY_LINK,
    targetId: entryLinkEl.getAttribute(Attr.TARGET_ID),
    costs: readCosts(entryLinkEl),
    categoryIds: readCategoryIds(entryLinkEl),
    limits: readLimits(entryLinkEl, diagnostics),
    infos: readInfos(entryLinkEl, diagnostics),
    children: readSelectionChildren(entryLinkEl, diagnostics),
    resolved: null,
  };
}

/** Liest alle direkten `<selectionEntry>`-Kinder eines Elements. */
function readEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.SELECTION_ENTRIES, Tag.SELECTION_ENTRY)
    .map(entryEl => readEntry(entryEl, diagnostics));
}

/** Liest alle direkten `<selectionEntryGroup>`-Kinder eines Elements. */
function readGroups(element, diagnostics) {
  return wrappedChildren(element, Tag.SELECTION_ENTRY_GROUPS, Tag.SELECTION_ENTRY_GROUP)
    .map(groupEl => readGroup(groupEl, diagnostics));
}

/** Liest alle direkten `<entryLink>`-Kinder eines Elements. */
function readEntryLinks(element, diagnostics) {
  return wrappedChildren(element, Tag.ENTRY_LINKS, Tag.ENTRY_LINK)
    .map(entryLinkEl => readEntryLink(entryLinkEl, diagnostics));
}

/**
 * Liest die Auswahl-Kinder eines Knotens (Katalog-Wurzel, Eintrag, Gruppe oder
 * Link): direkte `selectionEntry`, `selectionEntryGroup` und `entryLink`. Damit
 * werden auch per Verweis importierte und gebuendelte Definitionen erfasst — die
 * Voraussetzung fuer die kataloguebergreifende Auflösung (ADR-0032).
 */
/** Liest einen <categoryLink>. */
function readCategoryLink(linkEl, diagnostics) {
  return {
    ...readEntryBase(linkEl, diagnostics),
    kind: DefinitionKind.CATEGORY_LINK,
    targetId: linkEl.getAttribute(Attr.TARGET_ID),
    limits: readLimits(linkEl, diagnostics),
  };
}

/** Liest alle direkten <categoryLink>-Kinder. */
function readCategoryLinks(element, diagnostics) {
  return wrappedChildren(element, Tag.CATEGORY_LINKS, Tag.CATEGORY_LINK)
    .map(linkEl => readCategoryLink(linkEl, diagnostics));
}

function readSelectionChildren(element, diagnostics) {
  return [
    ...readEntries(element, diagnostics),
    ...readGroups(element, diagnostics),
    ...readEntryLinks(element, diagnostics),
    ...readCategoryLinks(element, diagnostics),
  ];
}

/**
 * Liest die katalogweit **geteilten** Auswahl-Definitionen der Wurzel
 * (`sharedSelectionEntries`/`sharedSelectionEntryGroups`) — die ueblichen Ziele
 * der `entryLink`-Verweise. Sie werden indiziert, gehen aber nicht in die
 * Wurzel-Definitionsliste ein (Resolver, ADR-0032).
 */
function readSharedEntries(root, diagnostics) {
  return [
    ...wrappedChildren(root, Tag.SHARED_SELECTION_ENTRIES, Tag.SELECTION_ENTRY)
      .map(entryEl => readEntry(entryEl, diagnostics)),
    ...wrappedChildren(root, Tag.SHARED_SELECTION_ENTRY_GROUPS, Tag.SELECTION_ENTRY_GROUP)
      .map(groupEl => readGroup(groupEl, diagnostics)),
  ];
}

/**
 * Liest die `catalogueLink`-Abhaengigkeitsdeklarationen der Wurzel: je ein
 * `{ id, name, targetId }`. `targetId` ist die Id des abhaengigen Katalogs; die
 * Fassade prueft, ob dieser mitgegeben wurde (ADR-0032, `MISSING_CATALOGUE_DEPENDENCY`).
 */
function readCatalogueLinks(root) {
  return wrappedChildren(root, Tag.CATALOGUE_LINKS, Tag.CATALOGUE_LINK).map(linkEl => ({
    id: linkEl.getAttribute(Attr.ID),
    name: linkEl.getAttribute(Attr.NAME),
    targetId: linkEl.getAttribute(Attr.TARGET_ID),
  }));
}

/**
 * Liest eine `<costType>` (Kostenart-Deklaration des Datensatzes): ihre ID, ihren
 * Klartext-Namen, ihre Vorgabe-Grenze und ob der Autor sie ausblendet. Eine
 * Kostenart ist eine reine Datensatz-Angabe ohne Roster-Bezug — sie beschreibt,
 * *welche* Kosten es gibt, nicht welche verplant sind.
 *
 * Die Vorgabe-Grenze ist `null`, wenn der Katalog keine deklariert (fehlendes,
 * unlesbares oder auf {@link NO_DEFAULT_COST_LIMIT} gesetztes Attribut).
 */
function readCostType(costTypeEl) {
  const declaredLimit = Number.parseFloat(costTypeEl.getAttribute(Attr.DEFAULT_COST_LIMIT));
  const hasDefaultLimit = !Number.isNaN(declaredLimit) && declaredLimit !== NO_DEFAULT_COST_LIMIT;
  return {
    id: costTypeEl.getAttribute(Attr.ID),
    name: costTypeEl.getAttribute(Attr.NAME),
    defaultLimit: hasDefaultLimit ? declaredLimit : null,
    isHidden: readBoolean(costTypeEl, Attr.HIDDEN, DEFAULT_HIDDEN),
  };
}

/** Liest alle `<costType>`-Deklarationen der Katalogwurzel. */
function readCostTypes(root) {
  return wrappedChildren(root, Tag.COST_TYPES, Tag.COST_TYPE).map(readCostType);
}

/**
 * Liest einen `<forceEntry>` (Kontingent-Definition) samt eigener Grenzen und
 * geschachtelter Kontingente. Kontingente tragen keine Selektion bei; ihre
 * Kinder im Definitionsbaum sind ihre Unter-Kontingente.
 */
function readForceEntry(forceEl, diagnostics) {
  return {
    ...readEntryBase(forceEl, diagnostics),
    kind: DefinitionKind.FORCE,
    categoryIds: readCategoryIds(forceEl),
    limits: readLimits(forceEl, diagnostics),
    infos: readInfos(forceEl, diagnostics),
    children: [
      ...readForceEntries(forceEl, diagnostics),
      ...readCategoryLinks(forceEl, diagnostics),
    ],
  };
}

/** Liest alle direkten `<forceEntry>`-Kinder eines Elements. */
function readForceEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.FORCE_ENTRIES, Tag.FORCE_ENTRY)
    .map(forceEl => readForceEntry(forceEl, diagnostics));
}

/** Liest eine `<categoryEntry>` (Kategorie-Definition) samt eigener Grenzen. */
function readCategoryEntry(categoryEl, diagnostics) {
  return {
    ...readEntryBase(categoryEl, diagnostics),
    kind: DefinitionKind.CATEGORY,
    limits: readLimits(categoryEl, diagnostics),
    infos: readInfos(categoryEl, diagnostics),
    children: [],
  };
}

/** Liest alle `<categoryEntry>`-Definitionen des Katalogs. */
function readCategoryEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.CATEGORY_ENTRIES, Tag.CATEGORY_ENTRY)
    .map(categoryEl => readCategoryEntry(categoryEl, diagnostics));
}

/**
 * Liest Katalog-XML in das engine-eigene Definitionsmodell.
 *
 * Ein `.cat` **und** eine `.gst` teilen dieselben Element-Namen und werden von
 * dieser Funktion gleich gelesen; nur die Wurzel unterscheidet sich (`catalogue`
 * vs. `gameSystem`). `gameSystemId` traegt nur ein `.cat` — die `.gst` ist ihr
 * eigenes Spielsystem (Kohaerenzpruefung in der Fassade, ADR-0032). `library`
 * traegt ebenfalls nur ein `.cat`; eine `.gst` ist nie eine Bibliothek und faellt
 * damit auf die XSD-Vorgabe zurueck.
 *
 * @param {string} catalogXml Entpacktes `.cat`/`.gst`-XML.
 * @returns {{ id: string|null, name: string|null, gameSystemId: string|null, isLibrary: boolean, costTypes: object[], profileTypes: object[], entries: object[], forces: object[], categories: object[], sharedEntries: object[], infos: object[], catalogueLinks: object[], diagnostics: object[] }}
 */
export function parseCatalogue(catalogXml) {
  const diagnostics = [];
  const document = new DOMParser().parseFromString(catalogXml, XML_MIME_TYPE);
  const root = document.documentElement;
  return {
    id: root.getAttribute(Attr.ID),
    name: root.getAttribute(Attr.NAME),
    gameSystemId: root.getAttribute(Attr.GAME_SYSTEM_ID),
    isLibrary: readBoolean(root, Attr.LIBRARY, DEFAULT_LIBRARY),
    costTypes: readCostTypes(root),
    profileTypes: readProfileTypes(root),
    entries: readSelectionChildren(root, diagnostics),
    forces: readForceEntries(root, diagnostics),
    categories: readCategoryEntries(root, diagnostics),
    sharedEntries: readSharedEntries(root, diagnostics),
    infos: readCatalogueInfos(root, diagnostics),
    catalogueLinks: readCatalogueLinks(root),
    diagnostics,
  };
}
