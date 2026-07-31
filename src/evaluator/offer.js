/**
 * Angebots-Schicht — *wer ist in welchem Rahmen waehlbar?* (ADR-0035,
 * `docs/evaluator-architecture.md` §3.2).
 *
 * Faehigkeitsdatensaetze entstanden bis Issue 75/05 nur fuer belegte Slots und
 * Pflicht-Anker. Der Editor braucht aber das **Angebot**: jede waehlbare Option,
 * auch die mit Anzahl 0 und ohne Pflicht. Diese Schicht bestimmt genau diese
 * Menge und verankert sie als **Blaetter** im fertigen realen Baum
 * (**Baumphase 2**, {@link attachOfferAnchor}).
 *
 * ── Waehlbar im Bezugsrahmen — die genaue Bestimmung ─────────────────────────
 * Ein Angebots-Anker entsteht fuer ein Paar (Rahmen R, Definition D) genau dann,
 * wenn R ein **realer** Knoten ist und eine der beiden Regeln greift:
 *
 * 1. **R ist eine Kontingent-Instanz.** D gehoert zur Kandidatenmenge auf
 *    Armee-Ebene (`resolved.armyLevelCandidates`) **und** mindestens eine ihrer
 *    **Basis**-Kategorien steht unter den Kategorie-Links der Kontingent-
 *    Definition von R. Traegt D ueberhaupt keine Basis-Kategorie, kann keine
 *    Kategorie sie ausschliessen — sie gilt als waehlbar.
 * 2. **R ist eine belegte Auswahl.** D ist eine Auswahl-Definition in ihrem
 *    Definitionsteilbaum: durch `selectionEntryGroup`s hindurch und ueber
 *    `entryLink` auf das aufgeloeste Ziel beliebig tief absteigend, **aber
 *    anhaltend beim ersten Eintrag** — die Optionen einer geschachtelten Auswahl
 *    gehoeren dieser, nicht dem aeusseren Rahmen.
 *
 * Ausnahmslos gilt zusaetzlich:
 *
 * - **Der Anker ist ein Blatt.** Er ist kein realer Rahmen, erzeugt also selbst
 *   kein Angebot. Das begrenzt den Zuwachs auf *(Kontingente × Wurzeldefinitionen)
 *   + (belegte Auswahlen × direkte Optionen)* statt auf den vollen
 *   Definitionsbaum — die Optionen einer Einheit fragt die Oberflaeche erst, wenn
 *   die Einheit existiert.
 * - **Gesperrtes und Verstecktes wird materialisiert, nicht weggelassen.** Diese
 *   Schicht filtert nichts nach Sichtbarkeit oder ausgeschoepftem Hoechstmass;
 *   beides sind **abgelesene Eigenschaften** des Faehigkeitsdatensatzes
 *   (`report.js`), nicht die Abwesenheit eines Eintrags.
 * - **Entdopplung.** Kein Angebots-Anker, wo im selben Rahmen schon ein Knoten
 *   derselben Definition haengt — real, Pflicht-Phantom, Kategorie- oder
 *   Gruppen-Anker. Ohne diese Regel entstuende ein zweiter Anker fuer dieselbe
 *   Grenze und damit eine doppelt gemeldete Verletzung.
 *
 * **Zuordnung ueber Basis-, Anzeige ueber effektive Kategorien** (bewusst
 * hingenommene Grenze): der Anker muss existieren, *bevor* seine effektiven Werte
 * bestimmt werden koennen. Eine Definition, die ihre einzige Kategorie erst durch
 * einen bedingten Modifikator erhaelt, erscheint deshalb nicht in einem
 * Kontingent, das nur diese Kategorie fuehrt. Gemildert dadurch, dass der
 * Faehigkeitsdatensatz die **effektiven** Kategorien fuehrt.
 *
 * Einzige Verantwortung dieser Schicht ist **die Menge und ihre Verankerung**.
 * Die Modifikator-Anwendung auf die Anker gehoert `modifiers.js` (ueber den
 * Nach-Durchlauf in `fixpoint.js`), die Grenzen-Auswertung `constraints.js`.
 */

import { DefinitionKind, isLinkDefinition } from './model.js';
import { attachOfferAnchor, realNodes, ownerDefinitionOf, linkedCategoryIdsOf } from './evalTree.js';
import { isInCatalogueScope, forceCatalogueReferenceOf } from './catalogSet.js';

/**
 * Die **Basis**-Kategorien einer angebotenen Definition: ihre eigenen
 * `categoryLink`-Ziele und — bei einem Verweis — die ihres aufgeloesten Ziels.
 * Dieselbe Erb-Regel, mit der die Effektiv-Werte-Schicht die Basis-Kategorien
 * eines Knotens bildet; beide muessen dieselbe Menge sehen, sonst wuerde eine
 * Definition anders zugeordnet als spaeter gezaehlt.
 */
function baseCategoryIdsOf(def) {
  const own = def.categoryIds ?? [];
  if (isLinkDefinition(def) && def.resolved) {
    return new Set([...(def.resolved.categoryIds ?? []), ...own]);
  }
  return new Set(own);
}

/**
 * True, wenn das Kontingent die Definition seiner Kategorienliste nach fuehrt.
 * Eine Definition **ohne** Basis-Kategorie kann von keiner Kategorie
 * ausgeschlossen werden und gilt damit als waehlbar.
 */
function isCarriedByForce(def, forceCategoryIds) {
  const baseCategoryIds = baseCategoryIdsOf(def);
  if (baseCategoryIds.size === 0) return true;
  for (const categoryId of baseCategoryIds) {
    if (forceCategoryIds.has(categoryId)) return true;
  }
  return false;
}

/**
 * Die IDs, unter denen eine Definition als „schon vorhanden" gelten kann: ihre
 * eigene, die Ziel-ID eines Verweises und die ID des aufgeloesten Ziels. Ein
 * Roster kann dieselbe Auswahl unter der Link- **oder** unter der Ziel-ID fuehren;
 * ohne alle drei entstuende neben dem realen Knoten ein zweiter Anker.
 */
function identityIdsOf(def) {
  const ids = [def.id];
  if (def.targetId !== null && def.targetId !== undefined) ids.push(def.targetId);
  if (def.resolved !== null && def.resolved !== undefined) ids.push(def.resolved.id);
  return ids;
}

/** Die Identitaets-IDs aller Knoten, die im Rahmen bereits haengen (Entdopplungs-Basis). */
function occupiedIdsOf(frame) {
  const ids = new Set();
  for (const child of frame.children) {
    for (const id of identityIdsOf(child.def)) ids.add(id);
  }
  return ids;
}

/**
 * Die **direkten Optionen** einer belegten Auswahl: die Auswahl-Definitionen ihres
 * Definitionsteilbaums, absteigend durch `selectionEntryGroup`s und ueber einen
 * `entryLink` auf eine Gruppe, aber **anhaltend beim ersten Eintrag**.
 *
 * Ein `entryLink` auf einen *Eintrag* ist selbst der Auswahlpunkt und wird
 * geliefert (der Anker traegt den Link, damit die am Link deklarierten Grenzen
 * gelten); ein `entryLink` auf eine *Gruppe* ist nur die Klammer um deren Member
 * und wird durchschritten. `visited` haelt eine zyklische Verweiskette endlich.
 *
 * Geliefert wird jede Option zusammen mit den **Sichtbarkeits-Klammern**, durch die
 * der Abstieg zu ihr fuehrte (`gates`, aeusserste zuerst): die durchschrittenen
 * Gruppen und Gruppen-Verweise. Weil der Anker ein Blatt am Rahmen ist, ist diese
 * Kette die einzige Stelle, an der die Sichtbarkeit der Klammer den Member noch
 * erreicht — eine versteckte Gruppe versteckt ihre Optionen (Issue 0132/0135).
 * Ein Gruppen-Verweis steht dabei fuer sich **und** sein Ziel: die Basisregel
 * (`effectiveState.js`) liest beide.
 */
function* optionDefinitionsUnder(ownerDef, visited = new Set(), gates = []) {
  if (ownerDef === null || ownerDef === undefined || visited.has(ownerDef.id)) return;
  visited.add(ownerDef.id);
  for (const child of ownerDef.children ?? []) {
    if (child.kind === DefinitionKind.ENTRY) {
      yield { def: child, gates };
    } else if (child.kind === DefinitionKind.GROUP) {
      yield* optionDefinitionsUnder(child, visited, [...gates, child]);
    } else if (child.kind === DefinitionKind.ENTRY_LINK) {
      if (child.resolved?.kind === DefinitionKind.GROUP) {
        yield* optionDefinitionsUnder(child.resolved, visited, [...gates, child]);
      } else {
        yield { def: child, gates };
      }
    }
  }
}

/**
 * Die im Rahmen `frame` angebotenen Definitionen — Regel 1 fuer ein Kontingent,
 * Regel 2 fuer eine belegte Auswahl. Die Wurzel selbst ist kein Rahmen des
 * Angebots: sie ist keine Auswahl, und das Armee-Angebot haengt am Kontingent.
 *
 * Fuer ein Kontingent gilt zusaetzlich der **Katalog-Bezugsrahmen** (Issue
 * 0098): ein eigenstaendiger Wurzel-Eintrag (`ENTRY`) wird nur angeboten,
 * wenn seine Herkunft zum Katalog-Fussabdruck **dieses** Kontingents gehoert
 * ({@link isInCatalogueScope}) — ein Wurzel-Eintrag eines fremden Katalogs im
 * selben Datensatz bleibt aussen vor — ein Eintrag des Spielsystems dagegen
 * nie, und ein Eintrag eines **Bibliothekskatalogs** dann nicht, wenn das
 * Armeebuch dieses Kontingents aus der Angabe des Rosters stammt und die
 * Bibliothek nicht selbst benennt ({@link isInCatalogueScope}, Issue 0140):
 * ein geteilter Vorrat ist kein fremdes Armeebuch.
 * Welches Armeebuch das Kontingent hat, beantwortet
 * {@link forceCatalogueReferenceOf}: der Herkunftsindex aus den Katalogdaten, und nur
 * wo der schweigt die Angabe des Rosters am Kontingent-Knoten (Issue 0140) —
 * nur so hat ein in der Spielsystemdatei deklariertes Kontingent ueberhaupt
 * ein Armeebuch, gegen das gefiltert werden kann. Ein Wurzel-**`entryLink`** ist davon
 * ausgenommen: er verweist auf eine geteilte Definition (typischerweise
 * einer Bibliothek) und ist der etablierte, mit echten Katalogdaten belegte
 * Weg, wie Katalogautoren katalogübergreifende Inhalte anbieten (z. B.
 * „Regiments of Renown"/Söldner, die jede Armee ueber ihre eigene, geteilte
 * Kategorie nehmen darf) — unabhaengig davon, welcher Katalog den Link
 * deklariert. Die belegte-Auswahl-Regel (2) betrifft nur Optionen unter
 * einer schon verankerten Definition und bleibt unveraendert.
 */
function candidatesFor(frame, armyLevelCandidates, catalogueScope, primaryCatalogueByForceDefId) {
  if (frame.isForce) {
    const forceCategoryIds = linkedCategoryIdsOf(frame.def);
    const forceReference = forceCatalogueReferenceOf(frame, primaryCatalogueByForceDefId);
    const catalogueReferences = forceReference === null ? [] : [forceReference];
    // Ein Wurzel-Angebot steht unmittelbar im Kontingent — es gibt keine
    // durchschrittene Gruppe, die es klammern koennte.
    return armyLevelCandidates.filter(def => isCarriedByForce(def, forceCategoryIds)
      && (def.kind === DefinitionKind.ENTRY_LINK || isInCatalogueScope(def.id, catalogueReferences, catalogueScope)))
      .map(def => ({ def, gates: [] }));
  }
  return [...optionDefinitionsUnder(ownerDefinitionOf(frame))];
}

/**
 * **Baumphase 2**: haengt an jeden realen Rahmen die Angebots-Anker seiner
 * waehlbaren, dort noch nicht vertretenen Definitionen — als Blaetter hinter alle
 * bestehenden Kinder, sodass die Pfade vorhandener Slots unveraendert bleiben.
 *
 * Laeuft **nach** der Fixpunktschleife: ein Anker traegt keine Instanz, geht in
 * keinen Zaehlschluessel ein und kann den ausgewerteten Stand deshalb nicht
 * veraendern. Seine effektiven Werte bestimmt der einmalige Nach-Durchlauf
 * (`fixpoint.js`, `applyAnchorPostPass`).
 *
 * @param {object} root  Wurzel des Auswertungsbaums nach Baumphase 1.
 * @param {{ armyLevelCandidates?: object[] }} resolved  die aufgeloeste Katalogsicht.
 * @param {{ sourceIdByDefId: Map<string, string>, catalogueRootEntryClosureById: Map<string, Set<string>>, gameSystemId: string|null, libraryCatalogueIds?: Set<string>, linkedCatalogueIdsById?: Map<string, Set<string>> }} [catalogueScope]
 *   Der Katalog-Bezugsrahmen (Issue 0098, siehe {@link candidatesFor}). Ohne ihn
 *   (`undefined`) ungefiltertes, unveraendertes Verhalten.
 * @param {Map<string, string>} [primaryCatalogueByForceDefId]  Der Herkunftsindex
 *   der Kontingente — die erste Quelle des Armeebuchs eines Kontingents, vor
 *   der Angabe des Rosters am Knoten ({@link forceCatalogueReferenceOf}); ohne beide
 *   ist `catalogueScope` je Kontingent nicht auszuwerten.
 * @returns {object[]} die angehaengten Anker, in Anhaenge-Reihenfolge. Der Aufrufer
 *   traegt sie in die Effektiv-Werte-Schicht nach (`extendBaseEffectiveState`),
 *   bevor der Nach-Durchlauf laeuft.
 */
export function attachOfferAnchors(root, resolved, catalogueScope, primaryCatalogueByForceDefId) {
  const armyLevelCandidates = resolved.armyLevelCandidates ?? [];
  // Die Rahmen **vor** dem Anhaengen festhalten: ein Anker ist selbst kein Rahmen,
  // und eine laufende Traversierung waehrend des Anhaengens waere nicht definiert.
  const frames = [...realNodes(root)];
  const anchors = [];
  for (const frame of frames) {
    const occupiedIds = occupiedIdsOf(frame);
    for (const { def, gates } of candidatesFor(frame, armyLevelCandidates, catalogueScope, primaryCatalogueByForceDefId)) {
      if (identityIdsOf(def).some(id => occupiedIds.has(id))) continue;
      anchors.push(attachOfferAnchor(root, frame, def, gates));
      // Der frische Anker belegt seine Definition im Rahmen: erscheint dieselbe
      // Definition in der Kandidatenliste ein zweites Mal (etwa als Eintrag und
      // als Verweis auf ihn), entsteht kein zweiter Anker.
      for (const id of identityIdsOf(def)) occupiedIds.add(id);
    }
  }
  return anchors;
}
