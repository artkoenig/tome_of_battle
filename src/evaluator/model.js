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
 * SELF, UNIT, ANCESTOR, PRIMARY_CATALOGUE }`). Ein Scope, der keines dieser
 * Woerter ist, wird als **ID** gelesen: eine Eintrags-ID (naechster Vorfahre mit
 * dieser ID) oder eine Kategorie-ID (armeeweiter Kategorierahmen).
 *
 * `UNIT` ist ein regulaerer Zaehlrahmen: die **umschliessende Einheit**, also der
 * naechste Vorfahre — den Knoten selbst eingeschlossen — mit rohem `type="unit"`
 * (`query.js`, Issue 086, BSData §7.7).
 *
 * Zwei Werte fallen aus der Reihe, weil sie **keine Zaehlrahmen** sind:
 * `PRIMARY_CATALOGUE` — ein Katalog ist kein Knoten des Instanzbaums, die Frage
 * lautet „ist das Armeebuch des umschliessenden Kontingents dieses hier?" und
 * wird als Identitaetspruefung beantwortet (`query.js`, Issue 077) — und
 * `ANCESTOR`, die Mitgliedschaftspruefung ueber die strikte Vorfahrenkette der
 * tragenden Auswahl (`query.js`, Issue 086).
 */
export const ScopeKeyword = Object.freeze({
  ROSTER: 'roster',
  FORCE: 'force',
  PARENT: 'parent',
  SELF: 'self',
  UNIT: 'unit',
  ANCESTOR: 'ancestor',
  PRIMARY_CATALOGUE: 'primary-catalogue',
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
 * **Ankerart** eines Slots — woher er im Auswertungsbaum stammt. Genau eine je
 * Knoten; sie ist die einzige Stelle, an der die Oberflaeche die Herkunft eines
 * Slots unterscheiden koennen muss, und ersetzt jedes Raten ueber Namen oder
 * Pfadform (`design.md`, Kontrakt „Faehigkeitsdatensatz").
 *
 * - `OCCUPIED` — ein **belegter** Slot: ein realer Knoten mit Instanz.
 * - `MANDATORY_PHANTOM` — Anker fuer eine Pflichtdefinition (`min > 0`), die im
 *   Bezugsrahmen keine Instanz hat.
 * - `GROUP_ANCHOR` — Anker fuer die Grenzen einer `selectionEntryGroup`.
 * - `CATEGORY_ANCHOR` — Anker fuer eine Kategorie als Zaehlrahmen: vom
 *   Kontingent per `categoryLink` gefuehrt (der Anker traegt den Link) oder
 *   unverlinkt mit eigenen Grenzen (der Anker traegt die `categoryEntry`).
 * - `OFFER_ANCHOR` — **Angebots-Anker**: eine im Bezugsrahmen waehlbare
 *   Definition, die im Roster (noch) nicht vorkommt (ADR-0035).
 */
export const AnchorKind = Object.freeze({
  OCCUPIED: 'occupied',
  MANDATORY_PHANTOM: 'mandatoryPhantom',
  GROUP_ANCHOR: 'groupAnchor',
  CATEGORY_ANCHOR: 'categoryAnchor',
  OFFER_ANCHOR: 'offerAnchor',
});

/**
 * True, wenn ein Grenzen-Ergebnis an einem Anker dieser Art **berichtsfaehig**
 * ist, also als Verletzung in die Meldungsliste gehoert.
 *
 * Ein **Angebots-Anker** ist die eine Ausnahme: er speist nur einen
 * Faehigkeitsdatensatz. Andernfalls laese eine armee- oder kontingentweit
 * skopierte Grenze an ihm denselben Wert wie am realen Knoten und meldete
 * dieselbe Verletzung ein zweites Mal — und jede nicht gewaehlte Option mit einer
 * Mindestgrenze flutete die Meldungsliste mit „nicht gewaehlt" (`design.md`,
 * Kernentscheidung „Angebots-Anker erzeugen keine Verletzungen").
 */
export function isReportableAnchorKind(anchorKind) {
  return anchorKind !== AnchorKind.OFFER_ANCHOR;
}

/**
 * True, wenn eine **Autor-Meldung** an einem Anker dieser Art in die
 * Meldungsliste gehoert (Issue 0139).
 *
 * Sie ist enger als {@link isReportableAnchorKind}, weil sie eine andere Frage
 * beantwortet. Eine abgeleitete Meldung spricht ueber eine **Grenze** — die gilt
 * auch fuer etwas Abwesendes („mindestens 1 gefordert, 0 vorhanden"), und genau
 * dafuer gibt es das Pflicht-Phantom. Eine Autor-Meldung spricht dagegen ueber
 * den **Eintrag selbst**; steht der nicht in der Liste, spricht sie ueber etwas,
 * das es in dieser Armee gar nicht gibt. Ausgeschlossen sind deshalb beide
 * Anker abwesender Definitionen:
 *
 * - der **Angebots-Anker** (dieselbe Begruendung wie oben), und
 * - das **Pflicht-Phantom**. Es entsteht schon, wenn eine Definition ueberhaupt
 *   eine `min`-Grenze im Rahmen traegt — auch mit Wert 0, denn ein Modifier kann
 *   den Wert erst in der Fixpunktschleife anheben. Eine Sonderfigur mit
 *   `min value="0" scope="force"` bekommt so in jedem Kontingent ihr Phantom,
 *   und die bedingte Autor-Meldung an ihr („Please enable …") erschiene an einer
 *   leeren Liste als blockierender Fehler. BattleScribe wertet die Modifier
 *   eines nicht gewaehlten Eintrags nie aus; es kennt kein Phantom und zeigt
 *   dort folglich auch keine Meldung.
 *
 * Der Faehigkeitsdatensatz beider Ankerarten fuehrt seine Autor-Meldungen
 * weiterhin — die Oberflaeche kann sie am Slot zeigen, wo sie im Zusammenhang
 * steht.
 */
export function isAuthorMessageAnchorKind(anchorKind) {
  return isReportableAnchorKind(anchorKind) && anchorKind !== AnchorKind.MANDATORY_PHANTOM;
}

/**
 * Die **Ankerart einer Berichtsmeldung**: jede Slot-Ankerart aus {@link AnchorKind}
 * und zusaetzlich der `ROSTER` — der Anker der engine-eigenen Budget-Regel
 * („Armee zu teuer", `budget.js`), die an keinem Slot des Auswertungsbaums haengt,
 * sondern an der Armee als Ganzem.
 *
 * Sie ist bewusst eine **Obermenge** von {@link AnchorKind} und keine Kopie: der
 * Spread haelt beide ohne Drift zusammen, und jede Ankerart eines
 * Faehigkeitsdatensatzes ist damit zugleich eine gueltige Meldungs-Ankerart
 * (`design.md`, Kontrakt „Eingeordnete Verletzung": „dieselbe Aufzaehlung wie im
 * Faehigkeitsdatensatz"). Umgekehrt bleibt `AnchorKind` die Aufzaehlung der
 * **Baumknoten** — ein Roster ist kein Slot und taucht in keiner Slot-Statistik auf.
 */
export const MessageAnchorKind = Object.freeze({
  ...AnchorKind,
  ROSTER: 'roster',
});

/**
 * True, wenn die Ankerart einen **Slot des Auswertungsbaums** benennt und damit
 * einen stabilen Pfad hat. Nur der roster-weite Anker der Budget-Regel hat keinen:
 * er ist kein Baumknoten, also traegt seine Meldung `path: null` statt eines
 * erfundenen Pfads.
 */
export function isSlotAnchorKind(anchorKind) {
  return anchorKind !== MessageAnchorKind.ROSTER;
}

/**
 * **Herkunft** einer Berichtsmeldung — der Diskriminator der einen Meldungsliste
 * (`design.md`, Kontrakt „Eingeordnete Verletzung"). Er bestimmt, welche der
 * uebrigen Felder besetzt sind; die Oberflaeche muss nichts raten.
 *
 * - `DERIVED_LIMIT` — von der Engine **aus einer Grenze abgeleitet**: aus einer
 *   Katalog-Grenze oder aus der engine-eigenen Budget-Regel. Traegt Grenz-Id,
 *   Einordnung der Grenze, Ist-Wert, Grenzwert, Differenz, Herleitungskette und
 *   — sofern benennbar — die Ursachen (ADR-0027).
 * - `AUTHOR_MESSAGE` — eine **Meldung des Katalog-Autors** (`field="error"`/
 *   `"warning"`/`"info"`). Traegt den Katalogtext mit aufgeloesten Text-Tokens
 *   (ADR-0028) und keines der Grenzen-Felder.
 *
 * Zwei getrennte Listen waeren zwei Wege zur selben Frage („was stimmt an dieser
 * Liste nicht?") — genau das schliesst ADR-0034 aus.
 */
export const MessageOrigin = Object.freeze({
  DERIVED_LIMIT: 'derivedLimit',
  AUTHOR_MESSAGE: 'authorMessage',
});

/**
 * **Was eine Grenze misst** — die „Art der Grenze" der Einordnung, sprachfrei.
 * Zusammen mit {@link ConstraintKind} (Mindest- oder Hoechstmass) und dem
 * Prozent-Kennzeichen bestimmt sie eindeutig, welchen Satz die Oberflaeche waehlt
 * (ADR-0034: die Engine ordnet ein, die Oberflaeche formuliert).
 *
 * Die ersten vier Werte sind die Messgroessen der Katalog-Grenzen — je genau eine
 * Auspraegung von {@link CountedFieldKind}, abgebildet durch
 * {@link limitMeasureOfCountedField}. `ROSTER_BUDGET` ist die engine-eigene Regel
 * „Armee zu teuer" (`budget.js`): sie stammt aus keiner Katalog-Grenze und haengt
 * an keinem Slot, ist also eine eigene Art und nicht bloss eine weitere
 * Kostensummen-Grenze.
 */
export const LimitMeasure = Object.freeze({
  SELECTION_COUNT: 'selectionCount',
  FORCE_COUNT: 'forceCount',
  COST_SUM: 'costSum',
  BUDGET_LIMIT: 'budgetLimit',
  ROSTER_BUDGET: 'rosterBudget',
});

/**
 * Die Messgroesse je gezaehltem Feld. Total ueber {@link CountedFieldKind} — die
 * Zweiweg-Vollstaendigkeit ist als Modultest festgehalten, damit ein neues Feld
 * nicht still ohne Einordnung durchrutscht.
 */
/** @type {Map<string, string>} */
const LIMIT_MEASURE_BY_COUNTED_FIELD = new Map([
  [CountedFieldKind.SELECTION_COUNT, LimitMeasure.SELECTION_COUNT],
  [CountedFieldKind.FORCE_COUNT, LimitMeasure.FORCE_COUNT],
  [CountedFieldKind.COST_SUM, LimitMeasure.COST_SUM],
  [CountedFieldKind.LIMIT_VALUE, LimitMeasure.BUDGET_LIMIT],
]);

/**
 * Die {@link LimitMeasure Messgroesse} eines gezaehlten Feldes. Ein Feld ohne
 * Messgroesse ist ein Bruch der Zweiweg-Vollstaendigkeit oben und wird laut
 * gemeldet statt als `undefined` in den Bericht zu sickern — eine Meldung, deren
 * Art die Oberflaeche raten muesste, waere schlimmer als keine.
 *
 * @param {{ kind: string }} field  ein Feld aus `SELECTION_COUNT` / `FORCE_COUNT` /
 *   {@link costSumField} / {@link limitValueField}.
 * @returns {string} der {@link LimitMeasure}-Wert.
 */
export function limitMeasureOfCountedField(field) {
  const measure = LIMIT_MEASURE_BY_COUNTED_FIELD.get(field?.kind);
  if (measure === undefined) {
    throw new Error(`Gezaehltes Feld ohne Messgroesse: ${JSON.stringify(field)}`);
  }
  return measure;
}

/**
 * **Art des Bezugsrahmens** einer Grenze. Der rohe `scope` einer Grenze ist
 * entweder ein Schluesselwort **oder** eine ID — welches von beidem, sieht man ihm
 * nicht an. Genau dieses Ansehen waere der Rateschritt, den die Oberflaeche nicht
 * tun soll; die Einordnung nimmt ihn ihr ab.
 *
 * Die Schluesselwort-Werte sind die aus {@link ScopeKeyword} (dieselbe eine
 * Quelle, kein zweiter Wertevorrat); `ENTRY_ID` und `CATEGORY_ID` benennen die
 * beiden ID-Faelle, die das Query-Primitiv unterscheidet: eine Eintrags-ID loest
 * auf den naechsten Vorfahren mit dieser ID auf, eine Kategorie-ID auf den
 * armeeweiten Kategorierahmen (`query.js`, §3.3).
 *
 * `PRIMARY_CATALOGUE` und `ANCESTOR` sind dabei die beiden Rahmen, die auf
 * keinen Baumknoten zeigen: der eine benennt das Armeebuch des umschliessenden
 * Kontingents (Issue 077), der andere die Vorfahrenkette der tragenden Auswahl
 * (Issue 086). Die Oberflaeche unterscheidet beide wie jeden anderen Wert dieser
 * geschlossenen Aufzaehlung — sie muss sie nur nicht als Slot-Pfad lesen.
 */
export const ScopeKind = Object.freeze({
  ROSTER: ScopeKeyword.ROSTER,
  FORCE: ScopeKeyword.FORCE,
  PARENT: ScopeKeyword.PARENT,
  SELF: ScopeKeyword.SELF,
  UNIT: ScopeKeyword.UNIT,
  ANCESTOR: ScopeKeyword.ANCESTOR,
  PRIMARY_CATALOGUE: ScopeKeyword.PRIMARY_CATALOGUE,
  ENTRY_ID: 'entryId',
  CATEGORY_ID: 'categoryId',
});

/**
 * Sentinel fuer einen suspendierten Grenzwert: eine Prozentgrenze mit leerem
 * Bezugsrahmen (Nenner 0) wird weder erfuellt noch verletzt, sondern
 * ausgesetzt (`docs/evaluator-architecture.md` §4.7, Annahme A4).
 */
export const SUSPENDED = Symbol('suspended');

/**
 * Der BattleScribe-Katalogwert, mit dem ein **hingeschriebener** Grenz- oder
 * Vorgabewert „unbegrenzt" bedeutet (`docs/battlescribe-data-format.md` §15,
 * Issue 079). Er gilt an genau vier Stellen: am Roh-`value` einer Grenze
 * (`constraint`), am Wert eines `set`-Modifikators auf eine Grenze, an
 * `defaultCostLimit` (XSD-Vorgabe, Catalogue.xsd:89) und am eingestellten
 * Roster-`costLimit` (Issue 0096). Ein **errechneter**
 * negativer Wert (increment/decrement/multiply) ist nie unbegrenzt — deshalb
 * wird der Sentinel ausschliesslich ueber {@link unlimitedFromSentinel} beim
 * Lesen des hingeschriebenen Werts gedeutet, nie am wirksamen Endwert. Das
 * Literal `-1` lebt nur hier; kein anderes Modul vergleicht dagegen.
 */
const UNLIMITED_SENTINEL = -1;

/**
 * Interne Repraesentation einer **unbegrenzten** Grenze: `Infinity`, bewusst
 * weder `null` noch `undefined` (beides kollidierte mit „kein Modifikator
 * vorhanden" und dem `??`-Fallback der Constraint-Schicht) und kein Symbol —
 * denn auf einer unbegrenzten Grenze wird weitergerechnet: increment/
 * decrement/multiply lassen `Infinity` unbegrenzt, ohne dass die
 * Modifikator-Handler den Fall kennen muessen; ein spaeterer `set`
 * ueberschreibt ihn. Auch die Herleitungskette (ADR-0027) fuehrt diesen Wert
 * als Basis- bzw. Zwischenwert.
 */
export const UNLIMITED = Infinity;

/**
 * Deutet den Sentinel {@link UNLIMITED_SENTINEL} eines **hingeschriebenen**
 * Katalogwerts auf {@link UNLIMITED} um; jeder andere Wert (auch `NaN`)
 * passiert unveraendert. Die **eine** Stelle, an der das Literal `-1` als
 * „unbegrenzt" gelesen wird — Aufrufer sind der Katalog-Leser (Roh-`value`
 * einer Grenze, `defaultCostLimit`), der `set`-Handler auf Grenzen und der
 * Roster-Budget-Konstruktor (eingestelltes `costLimit`, Issue 0096).
 *
 * @param {number} value  der hingeschriebene, bereits geparste Zahlwert.
 * @returns {number}
 */
export function unlimitedFromSentinel(value) {
  return value === UNLIMITED_SENTINEL ? UNLIMITED : value;
}

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
  // Eine Katalogquelle (`.cat`/`.gst`) ist als Katalog nicht lesbar: das XML ist
  // nicht wohlgeformt (`DOMParser` liefert ein `parsererror`-Dokument) oder die
  // Wurzel ist weder `catalogue` noch `gameSystem` (z. B. eine versehentlich
  // uebergebene `.ros`). Frueher wurde so eine Datei still zum leeren, ID-losen
  // Katalog; jetzt traegt sie diese Diagnose statt `diagnostics: []` (Issue 0097,
  // „Fehlerpfade sind explizit; nichts wird still verschluckt", §4). Die beiden
  // Ursachen unterscheidet {@link CatalogueUnreadableReason}.
  UNREADABLE_CATALOGUE: 'unreadableCatalogue',
});

/**
 * Grund, aus dem eine Katalogquelle unlesbar ist — zwei distinkte Ursachen unter
 * derselben Diagnose {@link DiagnosticKind.UNREADABLE_CATALOGUE}, damit ein
 * Berichts-Leser sie trennen kann (analog {@link BudgetLimitUnresolvedReason}).
 */
export const CatalogueUnreadableReason = Object.freeze({
  // Das XML ist nicht wohlgeformt (unverschlossener Tag, abgeschnittener
  // Download, leere Eingabe): `DOMParser` liefert ein `parsererror`-Dokument.
  MALFORMED_XML: 'malformedXml',
  // Wohlgeformtes XML, aber die Wurzel ist weder `catalogue` noch `gameSystem` —
  // etwa eine versehentlich als Katalog uebergebene `.ros` (`<roster>`).
  UNEXPECTED_ROOT: 'unexpectedRoot',
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
 * (`{ def: { id, name } }`) plus seine {@link MessageAnchorKind Ankerart}. Kein
 * realer Baumknoten — er dient allein dazu, die roster-weite Budget-Verletzung an
 * denselben Berichtspfad wie die uebrigen Verletzungen anzuschliessen.
 *
 * Die Ankerart steht ausdruecklich hier, damit die Einordnung sie **ablesen** und
 * nicht aus einem fehlenden Feld schliessen muss — dieselbe Begruendung, aus der
 * die Budget-Verletzung ihr `isReportable` explizit setzt.
 */
export const ROSTER_BUDGET_ANCHOR = Object.freeze({
  def: Object.freeze({ id: ROSTER_BUDGET_ANCHOR_ID, name: ROSTER_BUDGET_ANCHOR_NAME }),
  anchorKind: MessageAnchorKind.ROSTER,
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
