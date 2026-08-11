/**
 * Constraint-Schicht (`docs/evaluator-architecture.md` §3.6/§4.7).
 *
 * Jede Grenze liefert nie nur "verletzt ja/nein", sondern das volle Tripel
 * Ist-Wert / effektiver Grenzwert / Delta plus Bezugsinstanz. Diese Schicht
 * wertet MIN- und MAX-Grenzen ueber Selektionsanzahl *und* Kostensummen aus und
 * leitet Prozentgrenzen aus dem Nenner ihres Bezugsrahmens ab (eine zentrale
 * Rundungskonvention). Sie ruft ausschliesslich das Query-Primitiv und reicht die
 * Grenzen-Flags (`shared`, `includeChildSelections`, `includeChildForces`) an
 * dieses durch. Der Grenzwert kommt aus der Effektiv-Werte-Schicht (Slice 04):
 * ein Modifikator kann den Roh-Grenzwert veraendert haben — bei Prozentgrenzen
 * fliesst der effektive Prozentsatz durch dieselbe `resolveBound`-Stelle.
 *
 * Jedes Ergebnis sagt zusaetzlich, ob es **berichtsfaehig** ist (`isReportable`):
 * ein Ergebnis am **Angebots-Anker** speist nur den Faehigkeitsdatensatz seines
 * Slots und wird nie als Verletzung gemeldet (ADR-0035). Die Grenzen werden dort
 * trotzdem voll ausgewertet — genau daraus liest der Datensatz Hoechstmass,
 * Belegung und Restspielraum ab.
 */

import { AnchorKind, ConstraintKind, CountedFieldKind, DefinitionKind, ScopeKeyword, SELECTION_COUNT, SUSPENDED, UNLIMITED, UNRESOLVED_BUDGET, DiagnosticKind, diagnostic, isReportableAnchorKind, isLinkDefinition, limitMeasureOfCountedField } from './model.js';
import { allNodes, evaluableLimitsOf } from './evalTree.js';
import { query, createQueryContext } from './query.js';
import { roundHalfUp } from './rounding.js';

const PERCENT_DIVISOR = 100;

/**
 * Bestimmt den effektiven Grenzwert einer Grenze. Der Roh-Grenzwert stammt aus
 * der Effektiv-Werte-Schicht (durch Modifikatoren ggf. veraendert); traegt der
 * Knoten dort keinen Wert, gilt der Basiswert der Grenze. Bei einer Prozentgrenze
 * wird der Grenzwert aus dem im Bezugsrahmen gezaehlten Nenner abgeleitet; ein
 * Nenner 0 fuehrt zu `SUSPENDED` samt Null-Nenner-Diagnose (A4), nie zu einer
 * Verletzung. Nenner und Zaehler teilen den **Scope**; die Flags koennen
 * auseinanderfallen: der Nenner zaehlt „alles im Rahmen" stets mit den
 * hingeschriebenen Flags, waehrend der Zaehler bei einer geteilten,
 * eintrags-verankerten roster- oder force-Grenze verschachtelte Vorkommen
 * erzwungen mitzaehlt ({@link countingFlagsOf}).
 */
function resolveBound(limit, node, effective, ctx) {
  const raw = effective.limitValue(node, limit.id) ?? limit.value;
  // Eine unbegrenzte Grenze (hingeschriebener Sentinel, beim Lesen bzw. im
  // `set`-Handler auf UNLIMITED gedeutet — Issue 079) braucht keinen Nenner:
  // auch als Prozentgrenze ist „unbegrenzt" unbegrenzt, unabhaengig vom
  // Bezugsrahmen. Deshalb vor der Nenner-Ableitung, sonst suspendierte ein
  // leerer Rahmen (Nenner 0) eine Grenze, die gar nichts begrenzt.
  if (raw === UNLIMITED) return UNLIMITED;
  if (!limit.isPercent) return raw;
  const denominator = query(ctx, limit.field, limit.scope, null, limit.flags);
  // Unaufloesbares Budget-Feld als Nenner (Diagnose aus `query`): die Grenze wird
  // fail-closed suspendiert statt mit dem Sentinel weiterzurechnen.
  if (denominator === UNRESOLVED_BUDGET) return SUSPENDED;
  if (denominator === 0) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.ZERO_DENOMINATOR, { limitId: limit.id }));
    return SUSPENDED;
  }
  return roundHalfUp((denominator * raw) / PERCENT_DIVISOR);
}

/**
 * Die Zaehl-Flags einer Grenze, wie sie an das Query-Primitiv gehen.
 *
 * Eine **geteilte, eintrags-verankerte** Grenze mit `scope="roster"` oder
 * `scope="force"` zaehlt die Vorkommen ihres Eintrags im **ganzen** Rahmen —
 * auch verschachtelte —,
 * unabhaengig von `includeChildSelections="false"`: „unchecked" heisst „just
 * scope's field", nicht „nichts" (`docs/battlescribe-data-format.md` §7.6,
 * Issue 083), und die Auswahlen des Rosters sind alle seine Auswahlen — eine
 * armeeweite „hoechstens 1"-Grenze trifft ein magisches Item auch dann, wenn
 * es unter einem Charakter geschachtelt steht. §7.6 formuliert diese Regel
 * rahmen-unabhaengig, und fuer das Kontingent sagt die Nachbarzeile derselben
 * Tabelle dasselbe aus der Gegenrichtung: `includeChildForces="false"` rechnet
 * „only from parent force selections" — die Auswahlen des **eigenen**
 * Kontingents zaehlen also weiter mit, und das sind alle seine Auswahlen,
 * geschachtelte eingeschlossen (Issue 0147). `includeChildForces` bleibt
 * dabei bewusst **un**angehoben: Unter-Kontingente bleiben draussen.
 * Das gilt fuer jede Messgroesse:
 * auch eine Kostenart-Grenze liest die **Eigen**-Kosten jedes Vorkommens ihres
 * Traegers, egal wie tief es steckt (§9.4: „Ein Traeger mit eigenen Kosten
 * bringt diese in seine Summe ein", Issue 091).
 *
 * Die unter die Traeger-Id **aufgestiegenen Nachfahren**-Kosten bleiben davon
 * getrennt: fuer sie gilt weiterhin das **hingeschriebene**
 * `includeChildSelections` (§7.6 „just scope's field", Issue 091) — die
 * Anhebung setzt deshalb das eigene Gate `includeClimbedCosts` des
 * Query-Primitivs auf das hingeschriebene Flag, bevor sie die
 * Schachtelungs-Flags anhebt (Kollision 083/091, entschieden in Issue 0113).
 * Fuer alle anderen Rahmen (und fuer Kategorie- und Gruppen-Anker, deren Ziel
 * kein Eintrag ist) bleiben die hingeschriebenen Flags massgeblich.
 */
function countingFlagsOf(limit, node) {
  const flags = limit.flags;
  if (limit.scope !== ScopeKeyword.ROSTER && limit.scope !== ScopeKeyword.FORCE) return flags;
  if (flags?.shared === false || flags?.includeChildSelections === true) return flags;
  const counted = isLinkDefinition(node.def) ? node.def.resolved : node.def;
  if (counted?.kind !== DefinitionKind.ENTRY) return flags;
  return { ...flags, includeChildSelections: true, includeClimbedCosts: flags?.includeChildSelections ?? false };
}

/**
 * Whether a limit counts the **contents of its frame** instead of the
 * occurrences of its own carrier.
 *
 * A `scope="self"` limit over `field="selections"` is that case. Its frame is
 * the carrying selection itself (`query.js` -> `resolveSharedFrame`,
 * ADR-0029), and `docs/battlescribe-data-format.md` §7.6 states the counting
 * rule for it: "Gezaehlt werden die Auswahlen *unterhalb* des Traegers der
 * Grenze, nicht der Traeger selbst. Der `scope` sagt nur, in welchem Rahmen
 * summiert wird." So the counted target becomes `null` ("everything in the
 * frame") and the engine-own gate `includeFrameOwn` is closed, which keeps the
 * carrier's own piece count out of the answer. The two rosters of the
 * `self-scope-max-house-rules` scenario delimit the rule from both sides:
 * roster 05 (the carrier's parent holds two direct children, the carrier one)
 * forbids counting in the **parent** frame, roster 02 (carrier plus one child)
 * forbids counting the **carrier itself**.
 *
 * Restricted to `SELECTION_COUNT` on purpose. A self-scoped **cost** limit
 * keeps its settled reading — the carrier's own costs, plus the climbed
 * descendant costs under `includeChildSelections="true"` (Issues 091/0113,
 * pinned by `countIndex.costSumCarrierFrame.test.js`) — and a `LIMIT_VALUE`
 * field never reaches the frame code at all. The decision belongs here and not
 * in `query.js`, because the primitive cannot tell a constraint's "everything
 * under the carrier" from a **condition** with `scope="self"` and
 * `childId="any"`, which keeps reading the carrier's own count.
 */
function countsFrameContents(limit) {
  return limit.scope === ScopeKeyword.SELF && limit.field.kind === CountedFieldKind.SELECTION_COUNT;
}

/**
 * Wertet eine einzelne Grenze am Knoten aus und liefert ihr Ergebnis-Tripel,
 * oder `null`, wenn die Grenze suspendiert ist. Ziel der Zaehlung ist die
 * eigene Definition der Bezugsinstanz — bei einem Verweis dessen Ziel, siehe
 * die Begruendung an der Stelle selbst; eine `scope="self"`-Grenze ueber
 * `field="selections"` zaehlt stattdessen den Inhalt ihres Rahmens
 * ({@link countsFrameContents}).
 */
function evaluateLimit(limit, node, effective, ctx) {
  const bound = resolveBound(limit, node, effective, ctx);
  if (bound === SUSPENDED) return null;

  // Eine unbegrenzte Grenze feuert nie und beschraenkt keinen Restspielraum —
  // sie liefert kein Ergebnis. Ob sie unbegrenzt ist, wurde am hingeschriebenen
  // Wert entschieden (Katalog-Leser bzw. `set`-Handler, Issue 079); ein per
  // increment/decrement/multiply **errechneter** negativer Grenzwert ist nie
  // unbegrenzt und wird hier ganz normal verglichen („nichts erlaubt").
  if (bound === UNLIMITED) return null;

  // Gezaehlt wird die **aufgeloeste Ziel-Id**, wenn der Anker ein Verweis ist —
  // fuer `entryLink` genauso wie fuer `categoryLink`. Verschiedene Verweise
  // koennen auf dasselbe Ziel zeigen; zaehlte eine Grenze die Id des Verweises,
  // fiele jede Auswahl, die ueber einen anderen Verweis desselben Ziels
  // hereinkam, aus ihrer Zaehlung heraus (`docs/battlescribe-data-format.md`
  // §"Aufloesung": `scope="parent"` vergleicht aufgeloeste Ziel-IDs, nicht
  // `entryLinkId`s). Der Verweis bleibt trotzdem der Anker: nur an ihm gelten
  // die an ihm selbst deklarierten Grenzen.
  const targetId = isLinkDefinition(node.def) ? node.def.targetId : node.def.id;
  // Counts what stands *under* the carrier, not the carrier's own occurrences
  // ({@link countsFrameContents}, §7.6). `countedTargetId` below keeps the
  // carrier's resolved target id either way: that field is the identity of the
  // obligation across anchors and the dedup key of the report list, not the
  // query's filter.
  const frameContents = countsFrameContents(limit);
  const countingFlags = countingFlagsOf(limit, node);
  const actual = query(
    ctx,
    limit.field,
    limit.scope,
    frameContents ? null : targetId,
    frameContents ? { ...countingFlags, includeFrameOwn: false } : countingFlags,
  );
  // Zaehlt die Grenze selbst ein unaufloesbares Budget-Feld (Diagnose aus `query`),
  // wird sie fail-closed suspendiert statt den Sentinel zu vergleichen.
  if (actual === UNRESOLVED_BUDGET) return null;
  const satisfied = limit.kind === ConstraintKind.MIN ? actual >= bound : actual <= bound;
  return {
    limit,
    anchor: node,
    actual,
    bound,
    satisfied,
    delta: bound - actual,
    // Die **gezaehlte Ziel-Id** (bei einem Verweis das aufgeloeste Ziel, s. o.)
    // reist mit dem Ergebnis: zusammen mit der Grenz-Id ist sie die Identitaet
    // der Pflicht ueber alle Anker hinweg — der Entdopplungsschluessel der
    // Meldungsliste (`report.js`, §9.9 „ueber die Ziel-Id entdoppelt").
    countedTargetId: targetId,
    // Ob dieses Ergebnis **berichtsfaehig** ist, also als Verletzung gemeldet
    // werden darf, oder nur den Faehigkeitsdatensatz seines Slots speist. Diese
    // Schicht stellt die Unterscheidung bereit und deutet sie nicht: sie liest die
    // Ankerart des Knotens ab (`model.js`, {@link isReportableAnchorKind}).
    // Zusaetzlich ist die MIN-Grenze eines **effektiv versteckten** Traegers nie
    // meldbar (`docs/battlescribe-data-format.md` §5.6, per Projektentscheidung
    // Issue 0088 fuer alle Ankerarten): der Nutzer kann einen Verstoss ueber
    // etwas, das ihm nicht angeboten wird, nie beheben. Der Filter haengt am
    // `limit.kind` des einzelnen Ergebnisses — Max-Grenzen desselben Traegers
    // melden weiter —, und nur an der Meldbarkeit: die Grenze bleibt voll
    // ausgewertet, ihr Ergebnis speist den Faehigkeitsdatensatz unveraendert
    // (der Angebots-Anker-Praezedenzfall, ADR-0035). Massgeblich ist das eigene
    // effektive hidden des Traegers; versteckte Vorfahren zaehlen nicht.
    isReportable: isReportableAnchorKind(node.anchorKind)
      && !(limit.kind === ConstraintKind.MIN && effective.isHidden(node)),
    // Die **Messgroesse** der Grenze — ein Rohdatum der Einordnung, abgelesen am
    // gezaehlten Feld (`model.js`, {@link limitMeasureOfCountedField}). Sie steht
    // hier und nicht erst in der Einordnung, weil die roster-weite Budget-Regel
    // (`budget.js`) ihre eigene Messgroesse mitbringt: so liest die Einordnung
    // beide Herkuenfte aus **einem** Feld, statt eine davon zu erraten.
    measure: limitMeasureOfCountedField(limit.field),
    // Die **Herleitung** des Grenzwerts, unveraendert durchgereicht: diese Schicht
    // deutet sie nicht, sie stellt sie nur bereit (die Ursachen nach ADR-0027 sind
    // eine Filterung dieser Kette). Bei einer Prozentgrenze beschreibt sie den
    // Prozentsatz — die Groesse, auf die ein Modifikator wirkt —, nicht den daraus
    // abgeleiteten Grenzwert.
    derivation: effective.limitDerivation(node, limit.id),
  };
}

/**
 * Wertet alle MIN- und MAX-Grenzen des Baums aus.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: Function }} index
 * @param {import('./effectiveState.js').EffectiveState} effective effektive Grenzwerte je Knoten.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel).
 * @param {object[]} diagnostics  Sammelliste, in die Query- und Null-Nenner-Diagnosen fliessen.
 * @param {import('./rosterBudget.js').RosterBudget} [budget]  die eingestellten
 *   Roster-Kostengrenzen (`RosterBudget`), an den Query-Kontext durchgereicht.
 * @param {Map<string, string>} [primaryCatalogueByForceDefId]  der Herkunftsindex
 *   der Kontingente (`catalogSet.js`, Bezugsrahmen `primary-catalogue`), ebenfalls
 *   nur an den Query-Kontext durchgereicht.
 * @returns {object[]} Constraint-Ergebnisse (je ein Tripel; suspendierte Grenzen ausgenommen).
 */
export function evaluateConstraints(root, index, effective, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId) {
  const results = [];
  for (const node of allNodes(root)) {
    // `effective` reist mit in den Query-Kontext: der Bezugsrahmen `ancestor`
    // prueft die Vorfahren gegen ihre **effektiven** Kategorien (Issue 086).
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId, effective });
    // Die vom Verweis geerbten Grenzen gehoeren dazu (`limitsOf` ist die eine
    // Quelle der Wahrheit) — sonst blieben die Grenzen des Ziels eines
    // `entryLink`/`categoryLink` still unausgewertet. Ausgewertet wird die
    // **Knoten**-Sicht (`evaluableLimitsOf`): ein rahmen-zugeschnittener Anker
    // (unverlinkte Kategorie mit Grenzen verschiedener Rahmen) wertet nur die
    // Grenzen seines Rahmens aus, sonst meldete jede Grenze je Anker einmal.
    for (const limit of evaluableLimitsOf(node)) {
      const result = evaluateLimit(limit, node, effective, ctx);
      if (result !== null) results.push(result);
    }
  }
  return results;
}

/**
 * Zaehlt je **Kategorie-Anker** die Belegung seines Rahmens: wie viele
 * Auswahlen unter dem Rahmen des Ankers effektiv zu seiner Kategorie gehoeren.
 * Ein Kategorie-Anker ist ein Zaehlrahmen, keine Grenze — traegt er keine
 * auswertbare Grenze (etwa eine unbegrenzte, die kein Ergebnis liefert), gibt es
 * ohne diese Zaehlung ueberhaupt keine Zahl zu seinem Rahmen.
 *
 * Gezaehlt wird ueber dasselbe Query-Primitiv wie jede Grenze, damit die
 * Rahmen-Aufloesung und der Zaehlindex die einzige Zaehlstelle bleiben; die
 * hier gesammelten Diagnosen fliessen in dieselbe Liste wie die der Grenzen.
 * Der Rahmen ist `scope="parent"` — der Eltern-Knoten des Ankers, also das
 * Kontingent bzw. die Wurzel, unter der er haengt. Die Flags sind die dieser
 * Zaehlung eigenen: Mitgliedschaft in einer Kategorie endet weder an einer
 * Verschachtelungsgrenze noch an einem Unter-Kontingent, deshalb zaehlen
 * `includeChildSelections` und `includeChildForces` mit. Sie sind unabhaengig
 * von den Flags, die eine Grenze am selben Anker hinschreibt.
 *
 * Gezaehlt wird die aufgeloeste Ziel-Id, wenn der Anker ein `categoryLink` ist,
 * sonst die eigene Definition — dieselbe Wahl wie in {@link evaluateLimit} und
 * aus demselben Grund.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: Function }} index
 * @param {import('./effectiveState.js').EffectiveState} effective
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel).
 * @param {object[]} diagnostics  Sammelliste, in die Query-Diagnosen fliessen.
 * @param {import('./rosterBudget.js').RosterBudget} [budget]
 * @param {Map<string, string>} [primaryCatalogueByForceDefId]
 * @returns {Map<object, number>} je Kategorie-Anker die gezaehlte Belegung.
 */
export function categoryAnchorOccupancies(root, index, effective, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId) {
  const occupancies = new Map();
  for (const node of allNodes(root)) {
    if (node.anchorKind !== AnchorKind.CATEGORY_ANCHOR) continue;
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId, effective });
    const targetId = isLinkDefinition(node.def) ? node.def.targetId : node.def.id;
    const count = query(ctx, SELECTION_COUNT, ScopeKeyword.PARENT, targetId, {
      shared: true,
      includeChildSelections: true,
      includeChildForces: true,
    });
    occupancies.set(node, count);
  }
  return occupancies;
}
