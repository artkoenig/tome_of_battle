<!--
Referenz-Entwurf für die eigenständige Auswertungs-Engine unter `src/evaluator/`.
Diese Datei ist die dauerhaft im Repo gesicherte Grundlage („auf Grundlage dieser
Architektur") für die zweite, räumlich getrennte Engine. Der Bau-Entscheid und
seine Abgrenzung zu ADR-0023 (Solver-Fassade) und ADR-0029 (In-Solver-Query-Engine,
Fixpunkt bewusst weggelassen) stehen in ADR-0030. Die Pseudocode-Typen und
Funktionssignaturen unten sind Entwurf/Leitbild, nicht der finale Vertrag: die
Umsetzung darf Details schärfen, solange das beschriebene Verhalten erhalten bleibt.

Begriffs-Brücke zum Glossar (CONTEXT.md, Abschnitt „Regelauswertung"):
Limit → Grenze (Constraint), Condition → Bedingung, Repeat → Wiederholung,
Scope → Bezugsrahmen, target/childId → Ziel, report/violations → Validierungsmeldungen,
diagnostics → Diagnosen. „Phantomknoten", „Fixpunkt" und „capabilities" sind
engine-interne Begriffe dieses Entwurfs, kein Bestandteil des Domänen-Glossars.
-->

# Auswertungs-Architektur für eine deklarative Armeelisten-Regelengine

Reinraum-Entwurf. Grundlage sind ausschließlich das beschriebene Problem und die Datenform (Definitionsbaum, Instanzbaum, Limit/Condition/Repeat, Modifikatoren, Scopes).

## 1. Annahmen

- **A1:** Rosters umfassen Hunderte bis wenige Tausend Instanzknoten; vollständige Neuauswertung pro Änderung ist als Startpunkt vertretbar.
- **A2:** Modifikatoren können zählrelevante Werte verändern (Kosten, Kategorien, Sichtbarkeit) — es existieren potenzielle Zyklen zwischen Zählen und Modifizieren.
- **A3:** Die Semantik bei solchen Zyklen ist nicht extern vorgegeben und wird hier definiert (Fixpunkt mit Obergrenze).
- **A4:** Prozent-Grenzen mit Nenner 0 (leere Liste) gelten als suspendiert, nicht als verletzt.
- **A5:** Die UI läuft synchron im selben Client-Prozess wie die Auswertung.

## 2. Leitprinzipien

1. **Eine reine Funktion.** Die gesamte Auswertung ist `evaluate(Katalog, Roster) → Bericht`. Keine Seiteneffekte, kein verteilter Zustand. Damit ist die Logik ohne UI und ohne Framework testbar.
2. **Single Source of Truth.** Der Bericht ist der einzige Ort, an dem Regel-Ergebnisse existieren. Validierung und UI-Steuerung sind zwei Projektionen desselben Berichts — die Regeln werden nie zweimal ausgewertet.
3. **Unidirektionaler Datenfluss.** Roster-Änderung → `evaluate` → neuer Bericht → Rendering. Die UI liest nur, sie rechnet nie.
4. **Ein Query-Primitiv.** Limit, Condition und Repeat sind drei Verpackungen derselben Frage: *„Zähle `field` im Rahmen `scope`, gefiltert auf `target`, unter `flags`."* Es gibt genau eine Implementierung dieser Frage.
5. **Immutability.** Basisdefinitionen werden nie mutiert. Modifikatoren erzeugen eine separate Ebene „effektiver Werte".

## 3. Bausteine und Datenfluss

```
Kataloge ──► [1 Resolver] ──► aufgelöste Definitionen (rosterunabhängig, gecacht)
                                      │
Roster ───────────────────────► [2 Join-Schicht] ──► Evaluationsbaum (inkl. Phantomknoten)
                                      │
                     ┌────────────────┴───────────────────┐
                     ▼                                    │
              [3 Index-Schicht]  ◄── Fixpunktschleife ──  │
                     │                                    │
                     ▼                                    │
              [4 Modifikator-Schicht] ── effektive Werte ─┘
                     │
                     ▼
              [5 Constraint-Schicht] ──► [6 Bericht] ──► UI-Projektionen / Validierungsanzeige
```

### 3.1 Resolver (rosterunabhängig)

Löst alle ID-Verweise auf, auch über Katalog-Grenzen, und materialisiert pro Definitionsknoten eine **geschlossene Sicht**: eigener Eintrag plus hereinverlinkte Kinder, Regeln und Modifikatoren, in deterministischer Dokumentreihenfolge. Mehrdeutige IDs werden über einen Kontextstapel aufgelöst: lokaler Katalog des verweisenden Knotens → dessen Importe → Spielsystem. Jede Auflösungsentscheidung wird protokolliert (Diagnose bei Katalogfehlern). Das Ergebnis ist unveränderlich und wird gecacht, da es nicht vom Roster abhängt.

> **Umsetzungshinweis (ADR-0032):** Die reale Implementierung baut diesen Kontextstapel **bewusst nicht**. Da BattleScribe-IDs global-eindeutige GUIDs sind, lösen alle Quellen (`.gst` + Liste von `.cat`) über **eine** flache globale `id→Definition`-Tabelle auf (global-by-ID); `catalogueLink` ist reine Abhängigkeits-Deklaration. Ein Disjunktheits-Guard meldet eine echte ID-Kollision als Diagnose — erst sie würde den vollen Kontextstapel erzwingen. Siehe [ADR-0032](adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md).

### 3.2 Join-Schicht: Evaluationsbaum mit Phantomknoten

Verheiratet Instanz- und Definitionsbaum: Jeder Instanzknoten erhält seine aufgelöste Definition. Zusätzlich werden **Phantomknoten** synthetisiert für Definitionen, die Grenzen tragen, aber keine Instanz haben:

- Kategorie-Definitionen (je Kontingent und für die Gesamtliste),
- Kontingent-Definitionen selbst (Grenzen am Force-Typ),
- Pflichteinträge mit `min > 0`, die im jeweiligen Rahmen nicht gewählt wurden.

Ein Phantomknoten zählt 0 und ist der Auswertungsanker, an dem eine Min-Grenze *gerade beim Fehlen* anschlagen kann. Ohne Phantomknoten hätten diese Regeln keinen Ort im Instanzbaum.

### 3.3 Index-Schicht: Scope-Schlüssel statt Baumtraversalen

Ein Durchlauf über den Evaluationsbaum baut Zählindizes. Jeder reale Knoten trägt zu einer Menge von **Scope-Schlüsseln** bei: Wurzel (roster), sein Kontingent (force), jeder Vorfahre (für parent-Scopes), jede effektive Kategorie-ID, seine Definitions-ID (inklusive Link-Kette). Pro Schlüssel werden geführt: Anzahl Auswahlen und Summe je Kostenart, jeweils als *direkte* und *tiefe* Variante (für `includeChildSelections` / `includeChildForces`). Damit sind roster- und force-Bezüge O(1)-Lookups. Prozent-Nenner sind derselbe Lookup im Referenzrahmen.

### 3.4 Modifikator-Schicht

Pro Knoten: Conditions (bool) und Repeats (Anzahl) über das Query-Primitiv auswerten, dann Modifikatoren **strikt in Dokumentreihenfolge** auf eine Kopie der Basiseigenschaften anwenden. Ergebnis: effektive Kosten, effektive Kategorien, effektive Grenzwerte, Sichtbarkeit, bedingte Hinweistexte.

### 3.5 Fixpunktschleife (Kernentscheidung)

Modifikatoren hängen von Zählungen ab; Zählungen hängen von effektiven Kosten/Kategorien ab. Entscheidung: **Iteration bis zur Konvergenz mit harter Rundenobergrenze.** Ändert eine Runde keine zählrelevanten effektiven Werte mehr, ist der Fixpunkt erreicht. Wird die Obergrenze erreicht, gilt der Stand der letzten Runde und der Bericht erhält eine Nichtkonvergenz-Diagnose — stilles Falschrechnen ist ausgeschlossen.

*Verworfen:* „genau zwei Pässe" (einfacher, aber stille Fehler bei mehrstufigen Abhängigkeiten); Dependency-Graph mit topologischer Sortierung (roster-Scopes machen fast alles von fast allem abhängig, der Graph degeneriert).

### 3.6 Constraint-Schicht und Bericht

Jede effektive Grenze wird ausgewertet und liefert nie nur „verletzt ja/nein", sondern immer das volle Tripel **Ist-Wert / effektiver Grenzwert / Delta** plus Bezugsinstanz. Der Bericht enthält:

- **Verletzungen** (für die Validierungsanzeige),
- pro Auswahlpunkt einen **Fähigkeitsdatensatz**: effektives min/max, aktueller Stand, Restspielraum, Pflicht-Flag, Gesperrt-Flag, Versteckt-Flag, bedingte Hinweise (für die UI-Steuerung),
- **Diagnosen** (Auflösungsprobleme, Nichtkonvergenz, Null-Nenner).

## 4. Pseudocode

Sprachneutral, typisiert notiert. Fehlerpfade sind explizit; nichts wird still verschluckt.

### 4.1 Typen

```
// Die geschlossenen Format-Enums (ConstraintKind/ConditionKind/ModifierKind/
// ConditionGroupKind) kommen aus der **einen** Quelle der Wahrheit: der aus der
// vendored BattleScribe-XSD generierten SSOT (ADR-0031), nicht aus einer eigenen,
// driftgefährdeten Kopie.
enum ConstraintKind { min, max }                                  // XSD-SSOT
enum CountedField   { SELECTION_COUNT, COST_SUM(costTypeId) }
enum ConditionKind  { lessThan, greaterThan, equalTo, notEqualTo,  // XSD-SSOT
                      atLeast, atMost, instanceOf, notInstanceOf }
enum ModifierKind   { set, increment, decrement, add, remove,      // XSD-SSOT (10 Werte)
                      append, prepend, multiply, set-primary, unset-primary }
enum ConditionGroupKind { and, or }                               // XSD-SSOT
enum ScopeKeyword   { ROSTER, FORCE, PARENT, SELF }
type ScopeRef       = ScopeKeyword | EntryId | CategoryId

record CountFlags {
  shared: bool                    // über alle Instanzen der Ziel-Definition aggregieren
  includeChildSelections: bool
  includeChildForces: bool
}

record LimitDef       { id, kind: ConstraintKind, field: CountedField, scope: ScopeRef,
                        value: number, isPercent: bool, flags: CountFlags }
record ConditionDef   { type: ConditionKind, field: CountedField, scope: ScopeRef,
                        targetChildId: Id, value: number, flags: CountFlags }
record RepeatDef      { field: CountedField, scope: ScopeRef,
                        targetChildId: Id, perValue: number, flags: CountFlags }
record ModifierDef    { field: string,                    // roher XSD-`field`, im Resolver aufgelöst
                        target: TargetDescriptor,          // aufgelöstes Ziel (Kosten/Grenze/Kategorie/Sichtbarkeit/Hinweis)
                        kind: ModifierKind, value,
                        conditions: ConditionDef[], conditionGroups: ConditionGroupDef[],
                        repeats: RepeatDef[] }
                        // Reihenfolge im Array == Dokumentreihenfolge

// Gruppen (rekursiv, `and`/`or`): eine Bedingungsgruppe verknüpft Bedingungen und
// weitere Untergruppen zu einem Wahrheitswert; eine Modifikatorgruppe bündelt
// Modifikatoren unter einer gemeinsamen Gruppen-Bedingung und ist beliebig
// verschachtelbar.
record ConditionGroupDef { type: ConditionGroupKind, conditions: ConditionDef[],
                          groups: ConditionGroupDef[] }
record ModifierGroupDef  { modifiers: ModifierDef[], modifierGroups: ModifierGroupDef[],
                          conditions: ConditionDef[], conditionGroups: ConditionGroupDef[] }

// Info-Elemente: rein strukturell gelesen, ohne Grenzen- oder Modifikator-Logik.
record InfoElement    { kind: profile | rule | infoGroup | infoLink, id, name,
                        infos: InfoElement[] }    // infoLink verweist per targetId

record ResolvedDef  { id, kind: ENTRY | GROUP | FORCE_DEF | CATEGORY_DEF,
                      baseCosts: Map<CostTypeId, number>, baseCategoryIds: Set<CategoryId>,
                      limits: LimitDef[], modifiers: ModifierDef[],
                      children: ResolvedDef[], resolutionLog: Diagnostic[] }

record InstanceNode { defId: Id, count: number, children: InstanceNode[] }
record Roster       { forces: InstanceNode[] }

record EvalNode {
  def: ResolvedDef
  instance: InstanceNode?          // null bei Phantomknoten
  parent: EvalNode?
  children: EvalNode[]
  isPhantom: bool
  forceRoot: EvalNode              // das umschließende Kontingent
}

record EffectiveState {            // Ergebnis der Modifikator-Schicht, unveränderlich
  costs: Map<EvalNode, Map<CostTypeId, number>>
  categories: Map<EvalNode, Set<CategoryId>>
  limitValues: Map<(EvalNode, LimitId), number>
  hidden: Set<EvalNode>
  notes: Map<EvalNode, string[]>
}

record ConstraintResult { limit: LimitDef, anchor: EvalNode,
                          actual: number, bound: number, satisfied: bool, delta: number }

record SlotCapability   { node: EvalNode, effectiveMin: number?, effectiveMax: number?,
                          current: number, headroom: number?,
                          isMandatoryUnmet: bool, isBlocked: bool, isHidden: bool, notes: string[] }

record Report { violations: ConstraintResult[], capabilities: Map<NodePath, SlotCapability>,
                diagnostics: Diagnostic[] }
```

### 4.2 Hauptfunktion

```
const MAX_FIXPOINT_ROUNDS = 5

function evaluate(catalogs, roster): Report
  resolved    = resolveCatalogs(catalogs)              // gecacht; rosterunabhängig
  tree        = buildEvalTree(resolved, roster)
  effective   = effectiveStateFromBaseDefinitions(tree)
  diagnostics = collect(resolved.allResolutionLogs)

  converged = false
  for round in 1 .. MAX_FIXPOINT_ROUNDS:
    index        = buildIndex(tree, effective)
    newEffective = applyAllModifiers(tree, index, effective)
    if countRelevantPartsEqual(effective, newEffective):
      converged = true
      effective = newEffective
      break
    effective = newEffective

  if not converged:
    diagnostics.add(Diagnostic.NO_CONVERGENCE(MAX_FIXPOINT_ROUNDS))

  index   = buildIndex(tree, effective)                // finaler, konsistenter Index
  results = evaluateAllConstraints(tree, effective, index, diagnostics)
  return buildReport(tree, effective, results, diagnostics)
```

### 4.3 Join-Schicht

```
function buildEvalTree(resolved, roster): EvalNode
  root = EvalNode(def = resolved.gameSystemRoot, instance = null, isPhantom = false)
  for forceInstance in roster.forces:
    forceDef  = resolved.lookup(forceInstance.defId)   // Fehler → Diagnose + Knoten überspringen
    forceNode = attachChild(root, forceDef, forceInstance)
    joinChildrenRecursively(forceNode, resolved)
    synthesizePhantoms(forceNode, resolved)
  synthesizeRosterPhantoms(root, resolved)             // rosterweite Kategorie-/Eintragsgrenzen
  return root

function synthesizePhantoms(forceNode, resolved)
  // Anker für Grenzen an Knoten, die keine Instanz haben
  for categoryDef in resolved.categoriesOf(forceNode.def):
    attachPhantom(forceNode, categoryDef)
  for entryDef in resolved.selectableEntriesOf(forceNode.def):
    if hasMinLimit(entryDef) and countInstances(forceNode, entryDef.id) == 0:
      attachPhantom(forceNode, entryDef)
```

### 4.4 Index-Schicht

```
record ScopeKey(frame: ROSTER | ForceNode | EvalNode, targetId: Id?)

record Index {
  direct: Map<ScopeKey, Tally>      // ohne Kindauswahlen
  deep:   Map<ScopeKey, Tally>      // mit Kindauswahlen (und ggf. Kind-Forces)
}
record Tally { selectionCount: number, costSums: Map<CostTypeId, number> }

function buildIndex(tree, effective): Index
  index = emptyIndex()
  for node in realNodesOf(tree):                        // Phantome zählen nie mit
    contribution = Tally(
      selectionCount = node.instance.count,
      costSums       = scale(effective.costs[node], node.instance.count))
    for key in scopeKeysOf(node, effective):
      index.addTo(key, contribution)
  return index

function scopeKeysOf(node, effective): ScopeKey[]
  keys = []
  for frame in [ROSTER, node.forceRoot] + ancestorsOf(node):
    keys.add(ScopeKey(frame, targetId = null))          // „alles in diesem Rahmen"
    keys.add(ScopeKey(frame, node.def.id))              // gefiltert auf Eintrag
    for linkedId in linkChainOf(node.def):              // Verweis-Kette mitzählen
      keys.add(ScopeKey(frame, linkedId))
    for categoryId in effective.categories[node]:       // effektive, nicht Basis-Kategorien!
      keys.add(ScopeKey(frame, categoryId))
  return keys
```

Direkte vs. tiefe Zählung: beim Eintragen wird die Beitragskette entlang der Vorfahren geführt — der unmittelbare Elternrahmen erhält den Beitrag in `direct` und `deep`, weiter entfernte Rahmen nur in `deep`.

### 4.5 Das Query-Primitiv

Die eine Stelle, die Scopes, Flags und Felder versteht. Limit, Condition und Repeat rufen ausschließlich diese Funktion.

```
function query(ctx: QueryContext, field, scope, targetId, flags): number
  frame = resolveScopeFrame(ctx.node, scope)
  // ROSTER → Wurzel | FORCE → ctx.node.forceRoot | PARENT → ctx.node.parent
  // SELF → ctx.node | EntryId/CategoryId → nächster Vorfahre bzw. Kategorierahmen mit dieser ID
  if frame == null:
    ctx.diagnostics.add(Diagnostic.UNRESOLVED_SCOPE(scope, ctx.node))
    return 0

  effectiveTarget = flags.shared ? targetId : narrowToOwnInstance(ctx.node, targetId)
  table = flags.includeChildSelections ? ctx.index.deep : ctx.index.direct
  tally = table.get(ScopeKey(frame, effectiveTarget)) ?? Tally.ZERO

  return field == SELECTION_COUNT
       ? tally.selectionCount
       : tally.costSums[field.costTypeId] ?? 0
```

### 4.6 Condition, Repeat, Modifikatoren

```
function conditionHolds(ctx, c: ConditionDef): bool
  actual = query(ctx, c.field, c.scope, c.targetChildId, c.flags)
  return compare(c.type, actual, c.value)   // COMPARATORS-Registry: ConditionKind → Vergleichsprädikat

function repeatCount(ctx, r: RepeatDef): number
  actual = query(ctx, r.field, r.scope, r.targetChildId, r.flags)
  return floor(actual / r.perValue)         // Konvention: abrunden; 0 = Modifikator inaktiv

function applyAllModifiers(tree, index, previous): EffectiveState
  next = baseStateCopy(tree)                // immer von den Basisdefinitionen aus, nie kumulativ!
  for node in allNodesOf(tree):             // inkl. Phantome: auch deren Grenzen sind modifizierbar
    ctx = QueryContext(node, index, diagnostics)
    for modifier in node.def.modifiers:     // Dokumentreihenfolge — Reihenfolge ist Semantik
      applyModifier(ctx, next, node, modifier)
    for group in node.def.modifierGroups:   // Modifikatorgruppen nach den freien Modifikatoren
      applyModifierGroup(ctx, next, node, group)
  return next

function applyModifier(ctx, state, node, modifier)
  // feuert nur, wenn ALLE direkten Bedingungen UND alle Bedingungsgruppen halten
  if not conditionsAndGroupsHold(ctx, modifier.conditions, modifier.conditionGroups): return
  times = modifier.repeats.isEmpty ? 1
                                   : product(repeatCount(ctx, r) for r in modifier.repeats)
  applyOperation(state, node, modifier, times)

function applyModifierGroup(ctx, state, node, group)
  // hält die gemeinsame Gruppen-Bedingung, greifen alle enthaltenen Modifikatoren
  // gemeinsam (jeder weiterhin unter seinen eigenen Bedingungen), sonst gemeinsam keiner
  if not conditionsAndGroupsHold(ctx, group.conditions, group.conditionGroups): return
  for modifier in group.modifiers:
    applyModifier(ctx, state, node, modifier)

// Eine `and`-Gruppe hält, wenn ALLE ihre Bedingungen und Untergruppen halten; eine
// `or`-Gruppe, wenn MINDESTENS EINE hält — rekursiv über beliebige Tiefe.
function conditionGroupHolds(ctx, group): bool
  members = [conditionHolds(ctx, c) for c in group.conditions]
          + [conditionGroupHolds(ctx, g) for g in group.groups]
  return group.type == and ? all(members) : any(members)

function applyOperation(state, node, modifier, times)
  if times == 0 or modifier.target == null: return   // baumelndes Ziel: im Resolver gemeldet
  handler = MODIFIER_HANDLERS[modifier.kind]          // Registry ModifierKind → Effekt
  if handler == null: diagnostics.add(UNSUPPORTED_MODIFIER); return
  handler(state, node, modifier.target, modifier.value, times, diagnostics)
  // set → schreibt/setzt (ignoriert times); increment/decrement/multiply → numerisch × times;
  // add/remove/set-primary/unset-primary → Kategorie-Mitgliedschaft; append/prepend → Hinweistext
```

Info-Elemente (`profile`/`rule`/`infoGroup`/`infoLink`) werden rein strukturell gelesen und tragen keine Grenzen- oder Modifikator-Logik; ein `infoLink` verweist per `targetId` auf sein Ziel.

Wichtig: Jede Fixpunktrunde wendet Modifikatoren auf eine frische Kopie der **Basiswerte** an — sonst würde `ADD` über Runden hinweg kumulieren.

### 4.7 Constraint-Auswertung

```
function evaluateAllConstraints(tree, effective, index, diagnostics): ConstraintResult[]
  results = []
  for node in allNodesOf(tree):                          // Phantome eingeschlossen
    ctx = QueryContext(node, index, diagnostics)
    for limit in node.def.limits:
      actual = query(ctx, limit.field, limit.scope, targetIdFor(limit, node), limit.flags)
      bound  = resolveBound(ctx, limit, effective)
      if bound == SUSPENDED: continue                    // A4: Null-Nenner
      satisfied = limit.kind == MIN ? actual >= bound : actual <= bound
      results.add(ConstraintResult(limit, node, actual, bound, satisfied,
                                   delta = bound - actual))
  return results

function resolveBound(ctx, limit, effective): number | SUSPENDED
  raw = effective.limitValues[(ctx.node, limit.id)]      // ggf. durch Modifikatoren verändert
  if not limit.isPercent: return raw
  denominator = query(ctx, limit.field, limit.scope, targetId = null, limit.flags)
  if denominator == 0:
    ctx.diagnostics.add(Diagnostic.ZERO_DENOMINATOR(limit))
    return SUSPENDED
  return roundHalfUp(denominator * raw / 100)            // Rundung: eine zentrale Konvention
```

### 4.8 Bericht und UI-Projektion

```
function buildReport(tree, effective, results, diagnostics): Report
  capabilities = {}
  for node in selectableSlotsOf(tree):                   // reale Knoten + Phantom-Pflichtslots
    minResult = findResult(results, node, MIN)
    maxResult = findResult(results, node, MAX)
    capabilities[pathOf(node)] = SlotCapability(
      node          = node,
      effectiveMin  = minResult?.bound,
      effectiveMax  = maxResult?.bound,
      current       = maxResult?.actual ?? minResult?.actual ?? 0,
      headroom      = maxResult != null ? max(0, maxResult.bound - maxResult.actual) : null,
      isMandatoryUnmet = minResult != null and not minResult.satisfied,
      isBlocked     = maxResult != null and maxResult.actual >= maxResult.bound,
      isHidden      = node in effective.hidden,
      notes         = effective.notes[node])
  return Report(
    violations   = results.filter(r → not r.satisfied),
    capabilities = capabilities,
    diagnostics  = diagnostics)

// UI-Seite: reine Lookups, keine Regelauswertung
function isSelectable(report, path):  cap = report.capabilities[path]
                                      return not cap.isHidden and not cap.isBlocked
function remainingAllowed(report, path): return report.capabilities[path].headroom
function mandatoryOpenSlots(report):  return report.capabilities.values
                                            .filter(c → c.isMandatoryUnmet)
```

### 4.9 Inkrementalisierung (nur falls A1 kippt)

Hinter derselben `evaluate`-Schnittstelle, für die Aufrufer unsichtbar: Eine Roster-Änderung invalidiert nur die Scope-Schlüssel ihrer Rahmenkette (Eltern-Kette, eigenes Kontingent, roster, betroffene Kategorien und Definitions-IDs). Nur Knoten, deren Queries invalidierte Schlüssel berühren, werden neu ausgewertet. Erst messen, dann bauen (YAGNI).

## 5. Trade-offs, Risiken, verworfene Alternativen

**Interpretieren statt Kompilieren.** Regeln zu Closures zu kompilieren wäre schneller, aber intransparent für Diagnosen und schwerer zu debuggen. Der Interpreter über dem Query-Primitiv bleibt; Kompilierung wäre eine spätere Optimierung hinter derselben Schnittstelle.

**Zentrale Indizes statt lokalem Hochreichen.** Grenzen lokal am Teilbaum auszuwerten und Ergebnisse nach oben zu propagieren scheitert strukturell an roster-, force- und Kategorie-Scopes, die quer zum Baum liegen.

**Keine separate UI-Regelschicht.** Eine zweite, UI-nahe Auswertung driftet garantiert. Der Fähigkeitsdatensatz im Bericht ist die einzige Quelle.

**Kein Rete-Netz.** Inkrementelle Regelnetze sind für Listen dieser Größe Überengineering; die Scope-Schlüssel-Invalidierung (4.9) ist die einfachere Reserve.

**Risiken.**
1. *Dokumentreihenfolge über Katalog-Grenzen:* Der Resolver muss beim Hereinverlinken eine deterministische Gesamtordnung festlegen — sonst ist Modifikator-Semantik plattformabhängig.
2. *Flag-Interaktionen:* `shared` × `includeChildSelections` × `includeChildForces` × Scope-Arten ergeben eine Matrix feiner Fälle. Das Query-Primitiv braucht eine Matrix-Testsuite als ausführbare Spezifikation (FIRST-Tests, ein Fall pro Zelle).
3. *Fixpunkt:* Pathologische Kataloge (Modifikator A aktiviert B, B deaktiviert A) oszillieren. Die Rundenobergrenze plus Diagnose macht das sichtbar statt still falsch.
4. *ID-Mehrdeutigkeit:* Ohne protokollierte Auflösungsentscheidungen sind Katalogfehler praktisch unauffindbar; das `resolutionLog` gehört in den Bericht.
5. *Rundungskonventionen:* Prozentgrenzen und Repeats brauchen je genau eine zentrale, dokumentierte Rundungsregel — verstreute `floor`/`round`-Aufrufe wären ein klassischer Driftfehler.
