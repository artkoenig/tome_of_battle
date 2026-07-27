/**
 * Resolver-Schicht (`docs/evaluator-architecture.md` §3.1), Skeleton-Umfang.
 *
 * Er materialisiert die gelesenen Definitionen zu einer rosterunabhaengigen
 * Sicht mit O(1)-Nachschlag ueber die Definitions-ID. Indiziert werden Eintraege,
 * Kontingente (`forceEntries`) und Kategorien (`categoryEntries`); die
 * Kategorie-IDs werden zusaetzlich als Menge gefuehrt, damit das Query-Primitiv
 * ein Kategorie-Ziel von einem Eintrags-Ziel unterscheiden kann (Ziel-Typ-Regel
 * §7.7). Der volle Umfang (ID-Verweise/Importe/Link-Ketten ueber Katalog-Grenzen,
 * Dokumentreihenfolge) folgt in spaeteren Scheiben; hier wird nur der flache
 * Definitionsbaum indiziert und doppelte IDs werden als Diagnose sichtbar gemacht.
 *
 * Zusaetzlich baut er eine **globale `id → TargetDescriptor`-Symboltabelle** aus
 * allen Kostenart-, Constraint- und Charakteristik-Typ-IDs (mit Disjunktheits-Guard)
 * und loest damit jeden Modifikator-`field` **genau einmal** in sein Ziel auf —
 * die der Definitionen wie die der Info-Elemente. Der `field`
 * bleibt roh (xs:string, ADR-0016); die Zuordnung ist statisch und haengt nicht
 * vom effektiven Zustand ab, wird also vor der Fixpunktschleife einmal berechnet
 * (Clean-Room-Abgleich Q1).
 *
 * ── Unveraenderlichkeit ist durchgesetzt, nicht nur versprochen ──────────────
 * Die Anreicherung (`modifier.target`, `condition.witnessDefinition`,
 * `info.resolved`, `link.resolved`) schreibt **einmal, waehrend der
 * Aufloesung**, auf die frisch geparsten Objekte — danach werden die
 * zurueckgegebene Sicht und jeder von ihr getragene Definitions- und
 * Info-Knoten **tief eingefroren** ({@link freezeResolvedView}). Seit die
 * Fassade zweistufig ist, traegt ein aufbereiteter Datensatz beliebig viele
 * Auswertungen (Leitprinzip 5, `effectiveState.js`); ein gewoehnlicher
 * Schreibzugriff auf diesen Graphen — aus der Engine wie vom Aufrufer — wirft
 * deshalb einen `TypeError` an der schreibenden Stelle, statt als ferne
 * Korruption spaeterer Berichte aufzufallen. Zwei Mechanismen, je nach Ziel:
 * ein **Feld** scheitert am eingefrorenen Objekt und damit am Strict Mode, eine
 * **Menge oder Karte** an ihren ersetzten Mutatoren
 * ({@link hardenCollection}), die in jedem Modus werfen.
 *
 * Die Durchsetzung zielt auf **unbeabsichtigtes Abdriften**, nicht auf
 * boeswillige Umgehung: wer eine Mutator-Methode am Prototyp vorbeiholt
 * (`Set.prototype.add.call(...)`), kommt an den internen Slots einer Menge oder
 * Karte weiterhin vorbei. Das ist bewusst hingenommen — die Garantie soll einen
 * versehentlichen Schreibzugriff sofort sichtbar machen, und genau das tut sie.
 */

import { DefinitionKind, InfoElementKind, ModifierTargetKind, MessageSeverity, DiagnosticKind, diagnostic } from './model.js';

/**
 * Die Schluesselwort-`field`-Werte und ihr unmittelbares Ziel (ohne Symboltabelle).
 * Eine Tabelle statt einer Fallunterscheidung: ein weiteres Schluesselwort ist ein
 * weiterer Eintrag, keine weitere Verzweigung.
 *
 * `error`/`warning`/`info` benennen dasselbe Ziel — eine **Autor-Meldung** — und
 * unterscheiden sich allein in ihrem Schweregrad, der deshalb als `id` mitgefuehrt
 * wird (ADR-0022/0028). Bis Issue 75/04 fielen sie in den Kategorie-Zweig und
 * gingen dort als ungueltige Paarung verloren.
 */
const KEYWORD_TARGETS = Object.freeze({
  category: Object.freeze({ kind: ModifierTargetKind.CATEGORY, id: null }),
  hidden: Object.freeze({ kind: ModifierTargetKind.HIDDEN, id: null }),
  name: Object.freeze({ kind: ModifierTargetKind.NAME, id: null }),
  error: Object.freeze({ kind: ModifierTargetKind.MESSAGE, id: MessageSeverity.ERROR }),
  warning: Object.freeze({ kind: ModifierTargetKind.MESSAGE, id: MessageSeverity.WARNING }),
  info: Object.freeze({ kind: ModifierTargetKind.MESSAGE, id: MessageSeverity.INFO }),
});

/**
 * Muster einer BattleScribe-Verweis-ID (vier Vierergruppen, z. B.
 * `ecfa-8486-4f6c-c249`). Ein `field`, das diesem Muster folgt, aber in der
 * Symboltabelle fehlt, ist ein **baumelnder** Verweis (Diagnose) — kein
 * Textfeld-Hinweis.
 */
const REFERENCE_ID_PATTERN = /^[0-9a-fA-F]{4}(-[0-9a-fA-F]{4}){3}$/;

/** Die Definitionsarten, die als Pflicht-Phantom-Anker taugen (anwaehlbare Definitionen). */
const PHANTOM_DEFINITION_KINDS = Object.freeze(new Set([
  DefinitionKind.ENTRY,
  DefinitionKind.FORCE,
  DefinitionKind.CATEGORY,
]));

/**
 * Traegt eine Definition und ihren ganzen Teilbaum (Eintraege, Gruppen, Links)
 * rekursiv in die **globale** `id → Definition`-Tabelle ein und sammelt dabei die
 * fuer die spaeteren Auflösungs-Durchgaenge benoetigten Knoten:
 *
 * - jede Definition (fuer Symboltabelle und Modifikator-Auflösung),
 * - jeden `entryLink` (fuer die transitive Ziel-Auflösung),
 * - jeden `categoryLink` (fuer die Auflösung auf seine Kategorie-Definition),
 * - die Info-Elemente jedes Knotens (fuer Indizierung/`infoLink`-Auflösung).
 *
 * Eine doppelte ID wird als Diagnose sichtbar (der erste Eintrag gewinnt); die
 * Traversierung setzt trotzdem fort, damit der restliche Teilbaum indiziert wird.
 */
function collectDefinition(definition, collector) {
  const { byId, categoryIds, diagnostics } = collector;
  if (byId.has(definition.id)) {
    diagnostics.push(diagnostic(DiagnosticKind.DUPLICATE_DEFINITION, { definitionId: definition.id }));
  } else {
    byId.set(definition.id, definition);
    if (definition.kind === DefinitionKind.CATEGORY) {
      categoryIds.add(definition.id);
    }
  }
  collector.definitionNodes.push(definition);
  if (definition.kind === DefinitionKind.ENTRY_LINK) {
    collector.entryLinks.push(definition);
  }
  if (definition.kind === DefinitionKind.CATEGORY_LINK) {
    collector.categoryLinks.push(definition);
  }
  for (const info of definition.infos ?? []) {
    collector.infoRoots.push(info);
  }
  for (const child of definition.children ?? []) {
    collectDefinition(child, collector);
  }
}

/**
 * Sammelt die **Wurzel-Definitionsliste** fuer die Pflicht-Phantom-Synthese: die
 * anwaehlbaren Definitionen (Eintrag/Kontingent/Kategorie), die im Wurzel-Baum
 * erreichbar sind. Die Traversierung steigt nur durch anwaehlbare Definitionen ab
 * — hinter der Grenze einer Gruppe oder eines Links liegende Eintraege sind nur
 * per Verweis bezogen und duerfen keinen Pflicht-Phantom synthetisieren (ADR-0032,
 * Regel „geteilte/verlinkte Eintraege nicht in die Wurzel-Definitionsliste").
 */
function collectRootDefinitions(definition, out, seen) {
  if (!PHANTOM_DEFINITION_KINDS.has(definition.kind)) return;
  if (!seen.has(definition.id)) {
    seen.add(definition.id);
    out.push(definition);
  }
  for (const child of definition.children ?? []) {
    collectRootDefinitions(child, out, seen);
  }
}

/**
 * Die Definitionsarten, die als **Angebot auf Armee-Ebene** taugen: eine
 * anwaehlbare Auswahl unmittelbar unter einer Katalog- oder Spielsystem-Wurzel.
 * Eine Wurzel-Gruppe ist kein Auswahlpunkt, ein Wurzel-`categoryLink` keine
 * Auswahl — beide bleiben aussen vor (`design.md`, „Waehlbar im Bezugsrahmen",
 * Regel 1).
 */
const ARMY_LEVEL_CANDIDATE_KINDS = Object.freeze(new Set([
  DefinitionKind.ENTRY,
  DefinitionKind.ENTRY_LINK,
]));

/**
 * Die **Kandidatenmenge des Angebots auf Armee-Ebene**: die Auswahl-Definitionen
 * unmittelbar unter einer Katalog- oder Spielsystem-Wurzel — das, was ein
 * Kontingent ueberhaupt aufstellen kann (ADR-0035).
 *
 * Sie steht hier, weil der Resolver die einzige Schicht ist, die den
 * **Katalog**-Wurzelbestand kennt: einem Kontingent-Knoten des Auswertungsbaums
 * ist nicht anzusehen, welche Einheiten sein Katalog fuehrt. Welche dieser
 * Kandidaten ein *bestimmtes* Kontingent zulaesst, entscheidet `offer.js` anhand
 * seiner Kategorienliste — nicht diese Stelle.
 *
 * Geteilte Definitionen (`sharedSelectionEntries`) gehoeren **nicht** dazu: sie
 * sind nur ueber einen Verweis erreichbar und erscheinen allein an dessen Stelle.
 */
function collectArmyLevelCandidates(rootSelectionChildren) {
  return rootSelectionChildren.filter(definition => ARMY_LEVEL_CANDIDATE_KINDS.has(definition.kind));
}

/**
 * Sammelt die **Member-IDs** einer `selectionEntryGroup` rekursiv: die IDs ihrer
 * direkten Auswahl-Kinder (Eintraege/Links) sowie — ueber verschachtelte
 * Untergruppen hinweg — deren Member. Fuer einen `entryLink` zaehlen zusaetzlich
 * die Ziel-ID und die ID der aufgeloesten Zieldefinition, sodass eine Instanz als
 * Member erkannt wird, unabhaengig davon, ob das Roster die Eintrags-, Link- oder
 * Ziel-ID traegt (die Import-Schicht verwirft das `entryGroupId`-Tag, die
 * Zugehoerigkeit wird deshalb aus dem Definitionsbaum abgeleitet — wie im
 * Solver-Referenzpfad `collectGroupItemIds`).
 *
 * Zeigt ein `entryLink` auf eine **Gruppe**, gehoeren deren Member ebenfalls dazu:
 * eine Grenze an der aeusseren Gruppe (z. B. "hoechstens 100 Punkte Magie-Items")
 * rechnet gegen alles, was unter ihr waehlbar ist — auch wenn die Unterlisten
 * ("Magische Waffen", "Magische Ruestung") per Verweis eingebunden sind. Der
 * `visited`-Satz haelt eine zyklische Verweiskette endlich.
 */
function collectGroupMemberIds(groupDef, into, visited = new Set()) {
  if (visited.has(groupDef.id)) return;
  visited.add(groupDef.id);
  for (const child of groupDef.children ?? []) {
    if (child.kind === DefinitionKind.GROUP) {
      collectGroupMemberIds(child, into, visited);
      continue;
    }
    into.add(child.id);
    if (child.kind === DefinitionKind.ENTRY_LINK) {
      if (child.targetId !== null && child.targetId !== undefined) into.add(child.targetId);
      if (child.resolved !== null && child.resolved !== undefined) {
        into.add(child.resolved.id);
        if (child.resolved.kind === DefinitionKind.GROUP) collectGroupMemberIds(child.resolved, into, visited);
      }
    }
  }
}

/**
 * Baut die Zugehoerigkeitstabelle `Gruppen-ID → Menge der Member-IDs`, aber nur
 * fuer Gruppen, die eine **Grenze** tragen (nur diese synthetisiert die
 * Join-Schicht als Anker). Muss **nach** der `entryLink`-Auflösung laufen, damit
 * `resolved.id` je Link verfuegbar ist.
 */
function buildGroupMemberIndex(definitionNodes) {
  const groupMemberIds = new Map();
  for (const definition of definitionNodes) {
    if (definition.kind !== DefinitionKind.GROUP) continue;
    if ((definition.limits ?? []).length === 0) continue;
    const members = new Set();
    collectGroupMemberIds(definition, members);
    groupMemberIds.set(definition.id, members);
  }
  return groupMemberIds;
}

/**
 * Loest einen `entryLink` transitiv und **zyklen-sicher** auf sein Ziel auf: folgt
 * einer Link→Link-Kette ueber die globale Tabelle, bis eine echte Definition
 * (Eintrag/Gruppe) erreicht ist, das Ziel fehlt (baumelnd) oder ein Zyklus die
 * Kette schliesst. `visited` verhindert eine Endlosschleife bei selbst- oder
 * gegenseitig referenziellen Links.
 *
 * @returns {object|null} die aufgeloeste Zieldefinition, oder `null` (baumelnd/Zyklus).
 */
function followEntryLink(targetId, byId, visited) {
  let currentId = targetId;
  while (currentId !== null && currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    const target = byId.get(currentId);
    if (target === undefined) return null;
    if (target.kind === DefinitionKind.ENTRY_LINK) {
      currentId = target.targetId;
      continue;
    }
    return target;
  }
  return null;
}

/**
 * Traegt ein ID-Ziel in die Symboltabelle ein und meldet jede **Ueberschneidung**
 * mit einer bereits eingetragenen, andersartigen ID als Diagnose: nur bei
 * disjunktem ID-Raum ist die ID ihr eigener Diskriminator (Kostenart vs. Grenze
 * vs. Charakteristik-Typ). Der erste Eintrag gewinnt.
 */
function addTargetSymbol(symbolTable, id, kind, diagnostics) {
  const existing = symbolTable.get(id);
  if (existing !== undefined && existing.kind !== kind) {
    diagnostics.push(diagnostic(DiagnosticKind.MODIFIER_TARGET_COLLISION, { targetId: id }));
    return;
  }
  symbolTable.set(id, { kind, id });
}

/**
 * Baut die globale `id → TargetDescriptor`-Symboltabelle aus allen Kostenart-IDs
 * (→ COST), allen Constraint-IDs (→ LIMIT) der indizierten Definitionen und allen
 * **Charakteristik-Typ-IDs** der Profiltypen (→ CHARACTERISTIC). Letztere liefen
 * bis Issue 75/04 als „baumelnder Verweis" ins Leere, weil die Symboltabelle sie
 * nicht kannte.
 */
function buildTargetSymbolTable(definitions, profileTypes, diagnostics) {
  const symbolTable = new Map();
  for (const definition of definitions) {
    for (const costTypeId of Object.keys(definition.costs ?? {})) {
      addTargetSymbol(symbolTable, costTypeId, ModifierTargetKind.COST, diagnostics);
    }
  }
  for (const profileType of profileTypes) {
    for (const characteristicType of profileType.characteristicTypes ?? []) {
      addTargetSymbol(symbolTable, characteristicType.id, ModifierTargetKind.CHARACTERISTIC, diagnostics);
    }
  }
  for (const definition of definitions) {
    for (const limit of definition.limits ?? []) {
      addTargetSymbol(symbolTable, limit.id, ModifierTargetKind.LIMIT, diagnostics);
    }
  }
  return symbolTable;
}

/**
 * Loest den rohen `field` eines Modifikators **einmal** in seinen
 * `TargetDescriptor` auf. Praezedenz: Schluesselwort zuerst
 * ({@link KEYWORD_TARGETS}), sonst ein Treffer in der Symboltabelle
 * (Kostenart→COST, Charakteristik-Typ→CHARACTERISTIC, Constraint→LIMIT).
 *
 * Ohne Treffer gibt es **kein Auffang-Ziel**: ein Verweis, der wie eine ID
 * aussieht, ist ein **baumelnder** Verweis, jeder andere Text ein nicht deutbares
 * Ziel — beides wird gemeldet statt still in einen Hinweistext zu fallen
 * (Issue 75/04, „was die Engine nicht deuten kann, meldet sie sichtbar").
 *
 * @returns {{ kind: string, id: string|null }|null} das Ziel, oder `null`, wenn es nicht aufloest.
 */
function resolveModifierTarget(field, symbolTable, diagnostics) {
  const keywordTarget = Object.hasOwn(KEYWORD_TARGETS, field) ? KEYWORD_TARGETS[field] : undefined;
  if (keywordTarget !== undefined) return keywordTarget;

  const symbol = symbolTable.get(field);
  if (symbol !== undefined) return symbol;

  if (typeof field === 'string' && REFERENCE_ID_PATTERN.test(field)) {
    diagnostics.push(diagnostic(DiagnosticKind.DANGLING_MODIFIER_TARGET, { field }));
    return null;
  }
  diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER_TARGET, { field }));
  return null;
}

/**
 * Die Definitionsarten, die als **Zeuge** einer erfuellten Bedingung taugen: eine
 * anwaehlbare Auswahl (ADR-0027 „nur benennbare Ausloeser"). Eine Kategorie, eine
 * Gruppe oder ein Pseudo-Ziel wie `childId="model"` benennt keine Auswahl, die ein
 * Nutzer gesetzt haette — sie bleibt ohne Zeugen, statt einen zu erfinden.
 */
const WITNESS_DEFINITION_KINDS = Object.freeze(new Set([
  DefinitionKind.ENTRY,
  DefinitionKind.ENTRY_LINK,
]));

/**
 * Reichert eine Bedingung um die **Definition ihres Ziels** an, sofern das eine
 * benennbare Auswahl ist (`condition.witnessDefinition`, sonst `null`). Die
 * Zuordnung ist statisch und roster-unabhaengig — sie gehoert deshalb hierher und
 * nicht in die je Runde laufende Modifikator-Schicht, die daraus nur noch den
 * Zeugen eines Kettenschritts baut (ADR-0027).
 */
function resolveConditionWitness(condition, byId) {
  const targetId = condition.targetChildId;
  const definition = targetId === null || targetId === undefined ? undefined : byId.get(targetId);
  condition.witnessDefinition = definition !== undefined && WITNESS_DEFINITION_KINDS.has(definition.kind)
    ? definition
    : null;
}

/** Reichert die Bedingungen und — rekursiv — die Bedingungsgruppen eines Elements an. */
function resolveConditionWitnesses(conditions, conditionGroups, byId) {
  for (const condition of conditions) {
    resolveConditionWitness(condition, byId);
  }
  for (const group of conditionGroups) {
    resolveConditionWitnesses(group.conditions, group.groups, byId);
  }
}

/**
 * Reichert jeden Modifikator einer Liste mit seinem aufgeloesten
 * `TargetDescriptor` und seine Bedingungen mit ihrer Zieldefinition an.
 */
function resolveModifierList(modifiers, symbolTable, byId, diagnostics) {
  for (const modifier of modifiers) {
    modifier.target = resolveModifierTarget(modifier.field, symbolTable, diagnostics);
    resolveConditionWitnesses(modifier.conditions, modifier.conditionGroups ?? [], byId);
  }
}

/**
 * Reichert eine Modifikatorgruppe **rekursiv** an: ihre eigene Gruppen-Bedingung,
 * ihre gebuendelten Modifikatoren und die aller verschachtelten Untergruppen
 * (beliebige Tiefe). Ohne diese Rekursion bliebe ein Modifikator einer inneren
 * Gruppe ohne `.target`, und die Apply-Schicht griffe auf `undefined.kind` zu.
 */
function resolveModifierGroup(group, symbolTable, byId, diagnostics) {
  resolveConditionWitnesses(group.conditions, group.conditionGroups, byId);
  resolveModifierList(group.modifiers, symbolTable, byId, diagnostics);
  for (const nestedGroup of group.modifierGroups ?? []) {
    resolveModifierGroup(nestedGroup, symbolTable, byId, diagnostics);
  }
}

/**
 * Reichert jeden Modifikator jeder Definition mit seinem einmal aufgeloesten
 * `TargetDescriptor` an (`modifier.target`) — die eigenstaendigen Modifikatoren
 * **und** die von Modifikatorgruppen gebuendelten, verschachtelte Untergruppen
 * eingeschlossen (Slice 02, Kontrakt `ModifierGroupDef`). Baumelnde Verweise
 * tragen `null` — die Apply-Schicht ueberspringt sie stumm, weil die Diagnose
 * hier bereits gemeldet ist.
 */
function resolveModifierTargets(definitions, symbolTable, byId, diagnostics) {
  for (const definition of definitions) {
    resolveModifierList(definition.modifiers ?? [], symbolTable, byId, diagnostics);
    for (const group of definition.modifierGroups ?? []) {
      resolveModifierGroup(group, symbolTable, byId, diagnostics);
    }
  }
}

/**
 * Traegt eine Info-**Definition** (Profil/Regel/Info-Gruppe) rekursiv in die
 * ID-Karte ein, damit `lookup(targetId)` sie findet. Info-Gruppen indizieren ihre
 * verschachtelten Elemente mit. Info-**Links** sind Verweise, keine Definitionen —
 * sie werden nicht indiziert. Eine doppelte ID wird als Diagnose sichtbar.
 */
function indexInfoElement(info, byId, diagnostics) {
  if (info.kind === InfoElementKind.INFO_LINK) return;
  if (byId.has(info.id)) {
    diagnostics.push(diagnostic(DiagnosticKind.DUPLICATE_DEFINITION, { definitionId: info.id }));
  } else {
    byId.set(info.id, info);
  }
  if (info.kind === InfoElementKind.INFO_GROUP) {
    for (const nested of info.infos) indexInfoElement(nested, byId, diagnostics);
  }
}

/**
 * Loest einen `infoLink` ueber `lookup(targetId)` auf sein Ziel (Profil/Regel/
 * Info-Gruppe) auf und macht das verlinkte Element als `info.resolved` verfuegbar.
 * Ein Ziel, das nirgends indiziert ist, ist ein **baumelnder** Verweis (Diagnose,
 * `resolved` bleibt `null`). In einer Info-Gruppe verschachtelte Links werden
 * mit aufgeloest.
 */
function resolveInfoElement(info, byId, symbolTable, diagnostics) {
  // Ein Info-Element traegt dieselbe `EntryBase`-Basis wie eine Definition und
  // damit eigene Modifikatoren — an Profilen und Info-Verweisen haengt in den
  // Katalogdaten *jeder* Charakteristik-Modifikator (Issue 75/04). Ohne diese
  // Auflösung bliebe ihr `.target` undefiniert und die Apply-Schicht griffe darauf zu.
  resolveModifierList(info.modifiers ?? [], symbolTable, byId, diagnostics);
  for (const group of info.modifierGroups ?? []) {
    resolveModifierGroup(group, symbolTable, byId, diagnostics);
  }
  if (info.kind === InfoElementKind.INFO_LINK) {
    const target = byId.get(info.targetId) ?? null;
    if (target === null) {
      diagnostics.push(diagnostic(DiagnosticKind.DANGLING_INFO_LINK, { targetId: info.targetId }));
    }
    info.resolved = target;
    return;
  }
  if (info.kind === InfoElementKind.INFO_GROUP) {
    for (const nested of info.infos) resolveInfoElement(nested, byId, symbolTable, diagnostics);
  }
}

/**
 * Indiziert alle Info-Definitionen in die ID-Karte und loest anschliessend alle
 * `infoLink`-Verweise **und** die Modifikator-Ziele der Info-Elemente auf. Zwei
 * Durchgaenge, damit ein Link ein Ziel unabhaengig von dessen Dokumentposition
 * (und dessen Herkunftskatalog) findet.
 */
function indexAndResolveInfos(infoRoots, byId, symbolTable, diagnostics) {
  for (const info of infoRoots) indexInfoElement(info, byId, diagnostics);
  for (const info of infoRoots) resolveInfoElement(info, byId, symbolTable, diagnostics);
}

/**
 * Ersetzt die mutierenden Methoden einer Menge/Karte durch werfende Varianten:
 * `Object.freeze` allein liesse `add`/`set`/`delete`/`clear` zu, weil sie keine
 * Eigenschaften schreiben, sondern internen Zustand. Lesend bleibt alles nutzbar.
 *
 * Das haelt den **gewoehnlichen** Zugriff (`menge.add(x)`) auf, nicht den am
 * Prototyp vorbeigeholten (`Set.prototype.add.call(menge, x)`) — siehe die
 * Einordnung im Kopf dieser Datei.
 */
function hardenCollection(collection, methodNames) {
  for (const name of methodNames) {
    Object.defineProperty(collection, name, {
      value: function frozenCollectionMutator() {
        throw new TypeError(`Die aufgeloeste Sicht ist unveraenderlich: ${name}() ist nicht erlaubt.`);
      },
    });
  }
}

/**
 * Friert einen Objektgraphen **tief und zyklen-sicher** ein: jedes erreichbare
 * Objekt (auch ueber `resolved`-Rueckverweise, daher der `seen`-Satz), jede
 * Liste, jede Menge und jede Karte. Mengen und Karten werden zusaetzlich
 * gehaertet ({@link hardenCollection}), weil `Object.freeze` ihre Eintraege
 * nicht schuetzt.
 */
function deepFreezeGraph(value, seen) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map) {
    for (const [key, entry] of value) {
      deepFreezeGraph(key, seen);
      deepFreezeGraph(entry, seen);
    }
    hardenCollection(value, ['set', 'delete', 'clear']);
  } else if (value instanceof Set) {
    for (const entry of value) deepFreezeGraph(entry, seen);
    hardenCollection(value, ['add', 'delete', 'clear']);
  } else {
    for (const key of Object.keys(value)) deepFreezeGraph(value[key], seen);
  }
  Object.freeze(value);
}

/**
 * Friert die fertig aufgeloeste Sicht **und jeden Definitionsknoten** ein — die
 * Immutability-Garantie dieser Schicht als Mechanik statt als Disziplin.
 *
 * Ueber die Sicht selbst hinaus werden alle gesammelten Knoten eingefroren,
 * denn nicht jeder ist von ihr aus per Eigenschaft erreichbar: geteilte
 * Definitionen stehen nur im `lookup`-Abschluss, eine Duplikat-Definition nicht
 * einmal dort.
 *
 * **Was nicht eingefroren wird:** die eigenen Behaelter des uebergebenen
 * Katalogs (`catalogue.entries`, `catalogue.infos`, …). Sie sind das Objekt des
 * Aufrufers, nicht das Erzeugnis dieser Schicht, und die Sicht liest sie nach
 * ihrer Rueckgabe nicht mehr: jede Liste, die sie fuehrt, ist frisch abgeleitet
 * (`definitions`, `armyLevelCandidates`, `diagnostics`) — die einzige
 * durchgereichte, `profileTypes`, ist als Teil der Sicht mit eingefroren. Ein
 * Schreibzugriff auf den Katalog kann eine schon aufgeloeste Sicht daher nicht
 * mehr veraendern; die **Knoten** darin sind ohnehin dieselben eingefrorenen
 * Objekte.
 */
function freezeResolvedView(view, definitionNodes, infoRoots) {
  const seen = new Set();
  for (const definition of definitionNodes) deepFreezeGraph(definition, seen);
  for (const info of infoRoots) deepFreezeGraph(info, seen);
  deepFreezeGraph(view, seen);
  return view;
}

/**
 * Weist eine **zweite Aufloesung derselben Knoten** an der Tuer ab, mit klarer
 * Meldung statt eines rohen `TypeError` mitten in der Anreicherung.
 *
 * Die Aufloesung schreibt einmalig auf die geparsten Objekte und friert sie
 * danach ein — ein Aufruf auf schon aufgeloesten Knoten koennte gar nicht
 * gelingen. Der Fall ist nicht konstruiert: `mergeCatalogues` teilt die
 * Knotenobjekte seiner Quelldokumente mit dem Aggregat, zwei Aggregate ueber
 * demselben Dokument tragen also **dieselben** Knoten. Geprueft wird vor dem
 * ersten Schreibzugriff, sodass ein abgewiesener Aufruf nichts halb Mutiertes
 * hinterlaesst.
 */
function assertUnresolved(definitionNodes, infoRoots) {
  const resolvedNode = definitionNodes.find(node => Object.isFrozen(node))
    ?? infoRoots.find(info => Object.isFrozen(info));
  if (resolvedNode === undefined) return;
  throw new TypeError(
    'Diese Definitionen sind bereits aufgeloest und damit eingefroren: `resolveCatalogue` ist einmal ' +
      `je geparstem Katalog aufzurufen (zuerst betroffen: \`${resolvedNode.id}\`). Fuer eine erneute ` +
      'Aufloesung muss der Katalog neu geparst werden — ein aufbereiteter Datensatz ist dafuer da, ' +
      'wiederverwendet statt neu aufgeloest zu werden.',
  );
}

/**
 * Loest einen gelesenen Katalog (oder das zusammengefuehrte Aggregat mehrerer
 * Dokumente, ADR-0032) zu einer nachschlagbaren, unveraenderlichen Sicht auf.
 *
 * Alle mitgegebenen Quellen — Wurzel-Eintraege/Kontingente/Kategorien **und** die
 * per Verweis bzw. geteilt bezogenen Definitionen (`sharedEntries`) — fliessen in
 * **eine** globale `id → Definition`-Tabelle. Darueber loesen `infoLink`- und
 * `entryLink`-Ziele transitiv und zyklen-sicher auf, katalog-intern wie
 * kataloguebergreifend (der ID-Raum ist disjunkte GUIDs, ADR-0032).
 *
 * Die **Wurzel-Definitionsliste** (`definitions`) umfasst nur die anwaehlbaren,
 * im Wurzel-Baum erreichbaren Definitionen — geteilte/verlinkte Eintraege stehen
 * im `lookup`, aber nicht hier, damit ihre `min`-Grenze keine falsche
 * Pflichtverletzung synthetisiert.
 *
 * Daneben liefert er die **Kandidatenmenge des Angebots auf Armee-Ebene**
 * (`armyLevelCandidates`, siehe {@link collectArmyLevelCandidates}) als eigene,
 * benannte Sicht — die Grundlage der Angebots-Anker je Kontingent (ADR-0035).
 *
 * Die zurueckgegebene Sicht und jeder Definitions- und Info-Knoten dahinter sind
 * **tief eingefroren** ({@link freezeResolvedView}): die Aufloesung ist der
 * letzte Schritt, der auf die geparsten Objekte schreibt. Die eigenen Behaelter
 * des uebergebenen Katalogs bleiben davon unberuehrt — was das heisst und warum,
 * steht an {@link freezeResolvedView}.
 *
 * **Vorbedingung — einmal je geparstem Katalog.** Der Aufruf reichert die
 * uebergebenen Knoten an und friert sie ein; dieselben Knoten ein zweites Mal
 * aufzuloesen ist deshalb ausgeschlossen und wird abgewiesen. Zu beachten ist
 * das, weil `mergeCatalogues` die Knotenobjekte seiner Quelldokumente mit dem
 * Aggregat teilt: zwei Aggregate ueber demselben Dokument tragen dieselben
 * Knoten. Wer erneut aufloesen will, parst erneut — oder, besser, verwendet den
 * aufbereiteten Datensatz wieder (`datasetPreparation.js`).
 *
 * @param {{ entries?: object[], forces?: object[], categories?: object[], sharedEntries?: object[], infos?: object[], profileTypes?: object[] }} catalogue Ergebnis von `parseCatalogue` oder `mergeCatalogues`.
 * @returns {{ lookup: (id: string) => object|null, definitions: object[], armyLevelCandidates: object[], categoryIds: Set<string>, groupMemberIds: Map<string, Set<string>>, profileTypes: object[], diagnostics: object[] }}
 * @throws {TypeError} Wenn die uebergebenen Knoten schon aufgeloest (und damit
 *   eingefroren) sind — siehe Vorbedingung. Geprueft wird vor dem ersten
 *   Schreibzugriff: ein abgewiesener Aufruf laesst den Graphen unveraendert.
 */
export function resolveCatalogue(catalogue) {
  const collector = {
    byId: new Map(),
    categoryIds: new Set(),
    diagnostics: [],
    definitionNodes: [],
    entryLinks: [],
    categoryLinks: [],
    infoRoots: [...(catalogue.infos ?? [])],
  };
  const rootForest = [
    ...(catalogue.entries ?? []),
    ...(catalogue.forces ?? []),
    ...(catalogue.categories ?? []),
  ];
  for (const definition of [...rootForest, ...(catalogue.sharedEntries ?? [])]) {
    collectDefinition(definition, collector);
  }
  const { byId, categoryIds, diagnostics, definitionNodes, entryLinks, categoryLinks, infoRoots } = collector;

  // Vorbedingung, geprueft vor dem ersten Schreibzugriff: die Knoten duerfen
  // nicht schon einmal aufgeloest (und damit eingefroren) worden sein.
  assertUnresolved(definitionNodes, infoRoots);

  // Pflicht-Phantom-Quelle: nur die im Wurzel-Baum erreichbaren anwaehlbaren
  // Definitionen (nicht die geteilten/verlinkten — die stehen nur im `lookup`).
  const definitions = [];
  const seen = new Set();
  for (const definition of rootForest) {
    collectRootDefinitions(definition, definitions, seen);
  }

  // Modifikator-Ziele einmal ueber die globale Symboltabelle aufloesen — fuer alle
  // Definitionsknoten, damit auch ein per Verweis in den Baum gezogener Knoten sein
  // `.target` traegt (die Apply-Schicht griffe sonst auf `undefined.kind` zu).
  const symbolTable = buildTargetSymbolTable(definitionNodes, catalogue.profileTypes ?? [], diagnostics);
  resolveModifierTargets(definitionNodes, symbolTable, byId, diagnostics);

  // Info-Definitionen indizieren, `infoLink`s und die Modifikator-Ziele der
  // Info-Elemente aufloesen (zwei Durchgaenge).
  indexAndResolveInfos(infoRoots, byId, symbolTable, diagnostics);

  // `entryLink`-Ziele ueber dieselbe globale Tabelle aufloesen (transitiv,
  // zyklen-sicher); ein nach der Zusammenfuehrung baumelndes Ziel bleibt Diagnose.
  for (const link of entryLinks) {
    const target = followEntryLink(link.targetId, byId, new Set([link.id]));
    link.resolved = target;
    if (target === null) {
      diagnostics.push(diagnostic(DiagnosticKind.DANGLING_ENTRY_LINK, { targetId: link.targetId }));
    }
  }

  // `categoryLink`-Ziele auf ihre Kategorie-Definition aufloesen. Der Link erbt
  // damit deren Grenzen und Modifikatoren (wie ein `entryLink` von seinem Ziel),
  // sodass eine am `categoryEntry` deklarierte Grenze am Kategorie-Anker des
  // Kontingents ausgewertet wird. Ein Link zeigt immer direkt auf eine Kategorie —
  // eine Link→Link-Kette wie beim `entryLink` gibt es hier nicht.
  for (const link of categoryLinks) {
    link.resolved = byId.get(link.targetId) ?? null;
    if (link.resolved === null) {
      diagnostics.push(diagnostic(DiagnosticKind.DANGLING_CATEGORY_LINK, { targetId: link.targetId }));
    }
  }

  // Gruppen-Zugehoerigkeit erst nach der Link-Auflösung ableiten (Slice: gruppen-
  // skopierte Zaehl-Constraints) — die Join-Schicht synthetisiert daraus je
  // Eigentuemer-Auswahl einen Gruppen-Anker und annotiert die Member-Knoten.
  const groupMemberIds = buildGroupMemberIndex(definitionNodes);

  return freezeResolvedView({
    lookup: id => byId.get(id) ?? null,
    definitions,
    armyLevelCandidates: collectArmyLevelCandidates(catalogue.entries ?? []),
    categoryIds,
    groupMemberIds,
    // Die Profiltyp-Deklarationen wandern unveraendert durch: sie sind die
    // **einzige** Quelle der Klartext-Namen von Profiltyp und Charakteristik-Typ
    // (XSD: `profileType/@name` und `characteristicType/@name` sind Pflicht,
    // `profile/@typeName` dagegen optional). Die Info-Projektion des Berichts
    // liest sie; ausgewertet wird an ihnen nichts.
    profileTypes: catalogue.profileTypes ?? [],
    diagnostics,
  }, definitionNodes, infoRoots);
}
