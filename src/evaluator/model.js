/**
 * Geteilte, unveraenderliche Wertdefinitionen der Reinraum-Auswertungs-Engine
 * (`src/evaluator/`, ADR-0030, `docs/evaluator-architecture.md` §4.1).
 *
 * Diese Datei buendelt die Enums, Schluessel-Kodierung und Diagnose-Fabrik, die
 * alle Schichten teilen. Nach dem Walking-Skeleton (Issue 01) traegt sie das
 * verbreiterte Grenz-Vokabular (Issue 02): MIN- und MAX-Grenzen ueber die
 * Selektionsanzahl *und* Kostensummen (Kostenart per ID) sowie Prozentgrenzen.
 * Issue 03 verbreitert den Bezugsrahmen: alle Scope-Schluesselwoerter
 * (roster/force/parent/self) plus Eintrags- und Kategorie-IDs als Ziel, die
 * Zaehl-Flags (`shared`, `includeChildSelections`, `includeChildForces`) und die
 * Definitionsarten, an denen die Join-Schicht Kontingente von Auswahlen und
 * Kategorien unterscheidet.
 */

// Die geschlossenen Format-Enums bezieht die Engine aus der **einen Quelle der
// Wahrheit** (ADR-0016/0031): der aus der vendored BattleScribe-XSD generierten
// SSOT. Statt eigener, driftgefaehrdeter Kopien werden `ConditionKind`
// (Bedingungs-Art), `ModifierKind` (Modifikator-Art), `ConstraintKind`
// (Grenzen-Art), `ConditionGroupKind` und `InfoLinkKind` hier nur noch
// re-exportiert. Engine-eigene Konstrukte (ScopeKeyword, DefinitionKind,
// CountedFieldKind, ModifierTargetKind, Diagnose-Infra) bleiben unten definiert.
export {
  ConditionKind,
  ModifierKind,
  ConstraintKind,
  ConditionGroupKind,
  InfoLinkKind,
} from '../parser/schema/battlescribeSchema.generated.js';

/**
 * Diskriminator des gezaehlten Feldes einer Query. `SELECTION_COUNT` zaehlt
 * Selektionen; `COST_SUM` summiert eine Kostenart, die per ID benannt wird
 * (`docs/evaluator-architecture.md` §4.1: `CountedField { SELECTION_COUNT,
 * COST_SUM(costTypeId) }`). `LIMIT_VALUE` liest die **eingestellte
 * Roster-Kostengrenze** einer Kostenart (per ID) aus dem `RosterBudget` — eine
 * grundverschiedene Groesse als eine gezaehlte Summe, die deshalb **nicht** aus
 * dem Zaehlindex, sondern aus dem Budget bedient wird (Main-Issue 70, `design.md`).
 */
export const CountedFieldKind = Object.freeze({
  SELECTION_COUNT: 'selectionCount',
  FORCE_COUNT: 'forceCount',
  COST_SUM: 'costSum',
  LIMIT_VALUE: 'limitValue',
});

/** Das Feld "Selektionsanzahl" als unveraenderlicher, parameterloser Wert. */
export const SELECTION_COUNT = Object.freeze({ kind: CountedFieldKind.SELECTION_COUNT });

/** Das Feld "Kontingentanzahl" als unveraenderlicher, parameterloser Wert. */
export const FORCE_COUNT = Object.freeze({ kind: CountedFieldKind.FORCE_COUNT });

/**
 * Das Feld "Kostensumme einer Kostenart", identifiziert **per ID** (nicht per
 * Name) — die Auspraegung von `COST_SUM(costTypeId)`.
 */
export function costSumField(costTypeId) {
  return Object.freeze({ kind: CountedFieldKind.COST_SUM, costTypeId });
}

/**
 * Das Feld "eingestellte Kostengrenze einer Kostenart", identifiziert **per ID** —
 * die Auspraegung von `LIMIT_VALUE(costTypeId)`. Sie liest die konfigurierte Grenze
 * aus dem `RosterBudget`, nicht die verplante Summe aus dem Zaehlindex.
 */
export function limitValueField(costTypeId) {
  return Object.freeze({ kind: CountedFieldKind.LIMIT_VALUE, costTypeId });
}

/**
 * Das XML-Praefix, mit dem BattleScribe im `field`-Attribut die **eingestellte
 * Kostengrenze** einer Kostenart adressiert (`limit::<costTypeId>`) — im
 * Unterschied zur blossen Kostenart-ID, die die verplante Summe meint. Der
 * costTypeId-Raum sind disjunkte GUIDs, sodass der Praefix-Test am Stringanfang
 * keine echte Kostenart faelschlich abfaengt (`design.md`, Risiko „Praefix-Kollision").
 */
export const LIMIT_FIELD_PREFIX = 'limit::';

/**
 * Sentinel-Rueckgabewert des Query-Primitivs fuer ein **unaufloesbares Budget**:
 * ein `LIMIT_VALUE`-Feld, dessen Kostengrenze weder im Budget noch (bei
 * abweichendem Scope) sinnvoll deklariert ist. Bewusst **kein** `0`, damit kein
 * Konsument einen erfundenen Wert weiterrechnet: jede Regel behandelt diesen
 * Sentinel **fail-closed** — sie feuert nicht (`design.md`, Clean-Room-Abgleich).
 */
export const UNRESOLVED_BUDGET = Symbol('unresolvedBudget');

/**
 * Grund, aus dem ein `LIMIT_VALUE`-Feld unaufloesbar ist — zwei distinkte
 * Ursachen unter derselben Diagnose {@link DiagnosticKind.UNRESOLVED_BUDGET_LIMIT},
 * damit ein Berichts-Leser sie trennen kann (`design.md`, „Zwei Unauflösbar-Gründe").
 */
export const BudgetLimitUnresolvedReason = Object.freeze({
  // Die Kostenart ist im mitgegebenen Budget (`costLimits`) nicht deklariert.
  NOT_BUDGETED: 'notBudgeted',
  // Das `limit::`-Feld traegt einen Bezugsrahmen ungleich `roster`; eine
  // eingestellte Grenze ist roster-weit, ein abweichender Scope wird nicht still
  // umgedeutet, sondern laut gemeldet.
  NON_ROSTER_SCOPE: 'nonRosterScope',
});

/**
 * Bezugsrahmen-Schluesselwoerter (Scope) einer Query
 * (`docs/evaluator-architecture.md` §4.1: `ScopeKeyword { ROSTER, FORCE, PARENT,
 * SELF }`). Ein Scope, der keines dieser Woerter ist, wird als **ID** gelesen:
 * eine Eintrags-ID (naechster Vorfahre mit dieser ID) oder eine Kategorie-ID
 * (armeeweiter Kategorierahmen).
 */
export const ScopeKeyword = Object.freeze({
  ROSTER: 'roster',
  FORCE: 'force',
  PARENT: 'parent',
  SELF: 'self',
});

/**
 * Definitionsart eines Knotens. Die Join-Schicht braucht sie, um Kontingente
 * (Force) von Auswahlen (Entry) und Kategorien zu unterscheiden — nur Forces
 * begrenzen den `force`-Bezugsrahmen und die `includeChildForces`-Ausweitung,
 * nur Kategorien loesen die armeeweite Ziel-Typ-Regel aus (§3.3, BSData §7.7).
 */
export const DefinitionKind = Object.freeze({
  ENTRY: 'entry',
  FORCE: 'force',
  CATEGORY: 'category',
  // Ein `selectionEntryGroup` buendelt Auswahl-Optionen. Er ist ein
  // **Verweisziel** (per `entryLink`) und wird deshalb indiziert, ist aber selbst
  // keine anwaehlbare Einheit — die Join-Schicht unterscheidet ihn ueber diese Art
  // von ENTRY/FORCE/CATEGORY und synthetisiert fuer ihn keinen Pflicht-Phantom.
  GROUP: 'group',
  // Ein `entryLink` verweist ueber `targetId` auf eine importierte Definition
  // (Eintrag/Gruppe) — katalog-intern **oder** kataloguebergreifend (ADR-0032). Er
  // traegt eigene Grenzen/Modifikatoren, die der Resolver auf das aufgeloeste Ziel
  // schichtet; als reiner Verweis synthetisiert er selbst nie einen Phantom.
  ENTRY_LINK: 'entryLink',
  // Ein `categoryLink` ordnet eine Definition einer Kategorie zu und kann
  // eigene Grenzen/Modifikatoren tragen, die im Scope des Elternknotens ausgwertet werden.
  CATEGORY_LINK: 'categoryLink',
});

/**
 * True, wenn die Definition ein **Verweis** auf eine andere ist (`entryLink`
 * oder `categoryLink`). Beide erben Grenzen und Modifikatoren von ihrem
 * aufgeloesten Ziel (`resolved`) und ueberschreiben sie mit ihren eigenen — die
 * Schichten, die dieses Erben umsetzen, teilen sich dieses eine Praedikat.
 */
export function isLinkDefinition(def) {
  return def.kind === DefinitionKind.ENTRY_LINK || def.kind === DefinitionKind.CATEGORY_LINK;
}

/**
 * Die drei Zaehl-Flags einer Query (`docs/evaluator-architecture.md` §4.1,
 * `record CountFlags`). Battlescribe-Vorgabe (XSD `QueryBase`): `shared` ist
 * standardmaessig **true** (armeeweit ueber alle Instanzen der Ziel-Definition),
 * die beiden `includeChild…`-Flags sind standardmaessig **false**.
 */
export const DEFAULT_FLAGS = Object.freeze({
  shared: true,
  includeChildSelections: false,
  includeChildForces: false,
});

/** Fuellt fehlende Flag-Felder mit der Battlescribe-Vorgabe (siehe {@link DEFAULT_FLAGS}). */
export function normalizeFlags(flags) {
  return {
    shared: flags?.shared ?? DEFAULT_FLAGS.shared,
    includeChildSelections: flags?.includeChildSelections ?? DEFAULT_FLAGS.includeChildSelections,
    includeChildForces: flags?.includeChildForces ?? DEFAULT_FLAGS.includeChildForces,
  };
}

/**
 * Zielart eines Modifikators — welche effektive Eigenschaft er veraendert
 * (`docs/evaluator-architecture.md` §4.1, `target: PropertyRef | LimitId`). `COST`
 * und `LIMIT` werden per ID (Kostenart bzw. Grenze) benannt und numerisch
 * veraendert; `CHARACTERISTIC` benennt per ID einen **Charakteristik-Typ** aus den
 * Profiltypen des Spielsystems und veraendert dessen Wert am tragenden
 * Info-Element; `CATEGORY` schaltet die Zugehoerigkeit zu einer Kategorie-ID
 * (per `value` an/aus); `HIDDEN` setzt die Sichtbarkeit; `NAME` veraendert den
 * Anzeigenamen; `MESSAGE` haengt eine **Autor-Meldung** des Katalogs mit ihrem
 * Schweregrad an (`id` traegt den {@link MessageSeverity Schweregrad}).
 *
 * Es gibt **kein** Auffang-Ziel: ein `field`, das keines dieser Ziele benennt, ist
 * eine Diagnose ({@link DiagnosticKind.UNSUPPORTED_MODIFIER_TARGET}) und kein
 * stiller Hinweistext (Issue 75/04).
 */
export const ModifierTargetKind = Object.freeze({
  COST: 'cost',
  CATEGORY: 'category',
  LIMIT: 'limit',
  HIDDEN: 'hidden',
  CHARACTERISTIC: 'characteristic',
  NAME: 'name',
  MESSAGE: 'message',
});

/**
 * Schweregrad einer **Autor-Meldung** des Katalogs (`field="error"`/`"warning"`/
 * `"info"`, ADR-0022/0028). Engine-eigenes Enum: die XSD kennt das `field` nur als
 * freien String, die Klassifikation gehoert der Engine. Der Wert ist sprachfrei —
 * welchen Satz die Oberflaeche daraus baut, ist ihr Vertrag (ADR-0026).
 */
export const MessageSeverity = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

/**
 * Art eines reinen **Info-Elements** — welcher Knoten des InfoNodeGroup-Zweigs
 * (BattleScribe-XSD) er ist. Rein strukturell, ohne Grenzen- oder
 * Modifikator-Logik: `PROFILE` traegt Merkmale (Characteristics), `RULE` einen
 * benannten Regeltext, `INFO_GROUP` buendelt weitere Info-Elemente, `INFO_LINK`
 * verweist ueber `targetId` auf ein Profil / eine Regel / eine Info-Gruppe. Diese
 * Klassifikation ist **engine-intern** (analog {@link DefinitionKind}); der
 * Verweistyp eines Links selbst kommt aus dem SSOT-Enum {@link InfoLinkKind}.
 */
export const InfoElementKind = Object.freeze({
  PROFILE: 'profile',
  RULE: 'rule',
  INFO_GROUP: 'infoGroup',
  INFO_LINK: 'infoLink',
});

/**
 * Sentinel fuer einen suspendierten Grenzwert: eine Prozentgrenze mit leerem
 * Bezugsrahmen (Nenner 0) wird weder erfuellt noch verletzt, sondern
 * ausgesetzt (`docs/evaluator-architecture.md` §4.7, Annahme A4).
 */
export const SUSPENDED = Symbol('suspended');

/** Klassifikation einer Diagnose (Auswertungsproblem, nie still verschluckt). */
export const DiagnosticKind = Object.freeze({
  UNRESOLVED_DEFINITION: 'unresolvedDefinition',
  DUPLICATE_DEFINITION: 'duplicateDefinition',
  UNSUPPORTED_CONSTRAINT: 'unsupportedConstraint',
  UNRESOLVED_SCOPE: 'unresolvedScope',
  UNSUPPORTED_FIELD: 'unsupportedField',
  ZERO_DENOMINATOR: 'zeroDenominator',
  UNSUPPORTED_MODIFIER: 'unsupportedModifier',
  UNSUPPORTED_CONDITION: 'unsupportedCondition',
  // Der `type` einer Bedingungsgruppe ist keiner der SSOT-Werte (and/or) —
  // sichtbar gemacht statt still ignoriert. Gueltige Gruppen erzeugen keine
  // Diagnose (Slice 02).
  UNSUPPORTED_CONDITION_GROUP: 'unsupportedConditionGroup',
  UNSUPPORTED_REPEAT: 'unsupportedRepeat',
  // Eine Modifikatorgruppe traegt ein nicht-leeres `<repeats>` (von ModifierBase
  // geerbt, Catalogue.xsd:469-479). Volle Repeat-Semantik fuer eine *ganze*
  // Gruppe ist bewusst nicht im Umfang — statt sie still zu verschlucken, wird
  // diese Grenze als Diagnose sichtbar gemacht (§5, Risiko 4).
  UNSUPPORTED_MODIFIER_GROUP_REPEAT: 'unsupportedModifierGroupRepeat',
  UNSUPPORTED_COMPARATOR: 'unsupportedComparator',
  // Die Fixpunktschleife kam nicht zur Ruhe, weil ein **zaehlrelevanter Zustand
  // wiederkehrt**: der Katalog schwingt. Die Diagnose traegt neben der Rundenzahl
  // die **Zykluslaenge** (den Abstand der beiden gleichen Zustaende) — sie ist die
  // Angabe, die den Katalogfehler auffindbar macht.
  OSCILLATION: 'oscillation',
  // Die harte Rundenobergrenze ist erreicht, **ohne** dass sich ein Zustand
  // wiederholt haette. Fachlich etwas anderes als eine Oszillation: dieser Katalog
  // *koennte* mit mehr Runden noch konvergieren. Die Diagnose traegt die Rundenzahl.
  ROUND_BUDGET_EXHAUSTED: 'roundBudgetExhausted',
  // Der `field` eines Modifikators verweist wie eine Definitions-ID, findet in der
  // globalen Symboltabelle (Kostenart- und Constraint-IDs) aber kein Ziel —
  // baumelnder Verweis, sichtbar gemacht statt still ignoriert.
  DANGLING_MODIFIER_TARGET: 'danglingModifierTarget',
  // Der `field` eines Modifikators benennt weder ein Schluesselwort-Ziel
  // (category/hidden/name/error/warning/info) noch eine ID aus der Symboltabelle
  // (Kostenart, Grenze, Charakteristik-Typ). Frueher fiel jeder solche Text still
  // in ein Hinweis-Ziel; er wird jetzt sichtbar gemeldet (Issue 75/04).
  UNSUPPORTED_MODIFIER_TARGET: 'unsupportedModifierTarget',
  // Verletzung des Disjunktheits-Guards: dieselbe ID benennt zugleich eine
  // Kostenart und eine Grenze. Der ID-Raum muss disjunkt sein, damit die ID ihr
  // eigener Diskriminator (COST vs LIMIT) sein kann.
  MODIFIER_TARGET_COLLISION: 'modifierTargetCollision',
  // Der `targetId` eines `infoLink` verweist auf kein indiziertes Info-Element
  // (Profil/Regel/Info-Gruppe) — baumelnder Verweis, sichtbar gemacht statt still
  // ignoriert (analog {@link DANGLING_MODIFIER_TARGET}). Ein gueltiger Link erzeugt
  // keine Diagnose.
  DANGLING_INFO_LINK: 'danglingInfoLink',
  // Der `targetId` eines `entryLink` verweist — auch nach der globalen
  // Zusammenfuehrung aller Quellen (ADR-0032) — auf keine indizierte Definition.
  // Sichtbar gemacht statt still ignoriert (analog {@link DANGLING_INFO_LINK}); ein
  // aufgeloester Link erzeugt keine Diagnose.
  DANGLING_ENTRY_LINK: 'danglingEntryLink',
  // Der `targetId` eines `categoryLink` verweist auf keine indizierte
  // Kategorie-Definition. Sichtbar gemacht statt still ignoriert (analog
  // {@link DANGLING_ENTRY_LINK}); ein aufgeloester Link erzeugt keine Diagnose.
  DANGLING_CATEGORY_LINK: 'danglingCategoryLink',
  // Ein mitgegebener Katalog nennt eine `gameSystemId`, die nicht zur mitgegebenen
  // Spielsystemdatei (`.gst`) passt — Kohaerenz-Diagnose statt stiller
  // Teil-Auswertung (ADR-0032, Entscheidung 3).
  GAMESYSTEM_MISMATCH: 'gameSystemMismatch',
  // Ein Katalog deklariert per `catalogueLink` eine Abhaengigkeit auf einen
  // Katalog, der nicht unter den mitgegebenen Quellen ist — Kohaerenz-Diagnose
  // statt stiller Teil-Auswertung (ADR-0032, Entscheidung 3).
  MISSING_CATALOGUE_DEPENDENCY: 'missingCatalogueDependency',
  // Eine Regel nennt ueber `limit::<costTypeId>` eine eingestellte Kostengrenze,
  // die sich nicht aufloesen laesst — die Kostenart ist nicht budgetiert oder das
  // Feld traegt einen Scope ungleich `roster` ({@link BudgetLimitUnresolvedReason}).
  // Sichtbar gemacht statt still als Wert 0 angenommen (Main-Issue 70, `design.md`).
  UNRESOLVED_BUDGET_LIMIT: 'unresolvedBudgetLimit',
});

/**
 * Identitaet der **roster-weiten Budget-Verletzung** (Regel „Armee zu teuer",
 * Main-Issue 70, `design.md`). Uebersteigt die verplante Summe einer Kostenart
 * die eingestellte Grenze, meldet die Engine eine Verletzung, die — anders als
 * eine Katalog-Grenze — an keinem realen Baumknoten haengt: die Baumwurzel
 * traegt `def: null` und wird von `allNodes()` nie geliefert. Die Verletzung
 * braucht daher einen **synthetischen** roster-weiten Anker, der die Berichtsform
 * (`anchor.def.id/name`) erfuellt, plus je Kostenart eine synthetische Grenz-ID.
 */
export const ROSTER_BUDGET_ANCHOR_ID = 'roster';
export const ROSTER_BUDGET_ANCHOR_NAME = 'Roster';

/**
 * Der synthetische roster-weite Anker einer Budget-Verletzung: ein Knoten-artiges
 * Objekt, das nur die von der Berichtsprojektion gelesene `def`-Form traegt
 * (`{ def: { id, name } }`). Kein realer Baumknoten — er dient allein dazu, die
 * roster-weite Budget-Verletzung an denselben Berichtspfad wie die uebrigen
 * Verletzungen anzuschliessen.
 */
export const ROSTER_BUDGET_ANCHOR = Object.freeze({
  def: Object.freeze({ id: ROSTER_BUDGET_ANCHOR_ID, name: ROSTER_BUDGET_ANCHOR_NAME }),
});

/**
 * Das Praefix, mit dem eine roster-weite Budget-Verletzung ihre **synthetische**
 * Grenz-ID je Kostenart bildet (`budget::<costTypeId>`). Es haelt diese
 * engine-erzeugte Grenz-ID vom disjunkten GUID-Raum der Katalog-Grenzen getrennt,
 * sodass sie nie mit einer echten Constraint-ID kollidiert.
 */
const ROSTER_BUDGET_LIMIT_ID_PREFIX = 'budget::';

/**
 * Bildet die synthetische Grenz-ID der roster-weiten Budget-Verletzung einer
 * Kostenart ({@link ROSTER_BUDGET_LIMIT_ID_PREFIX}`<costTypeId>`).
 */
export function rosterBudgetLimitId(costTypeId) {
  return `${ROSTER_BUDGET_LIMIT_ID_PREFIX}${costTypeId}`;
}

const SCOPE_KEY_SEPARATOR = '::';
const SCOPE_KEY_NO_TARGET = '*';

/**
 * Kodiert einen Index-Schluessel aus Bezugsrahmen und optionalem Ziel.
 * `null` als Ziel bedeutet "alles in diesem Rahmen" (Index-Schicht §3.4/§4.4).
 */
export function scopeKey(frame, targetId) {
  return `${frame}${SCOPE_KEY_SEPARATOR}${targetId ?? SCOPE_KEY_NO_TARGET}`;
}

/** Erzeugt eine unveraenderliche Diagnose. */
export function diagnostic(kind, detail = {}) {
  return Object.freeze({ kind, ...detail });
}
