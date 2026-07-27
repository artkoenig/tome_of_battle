/**
 * Zaehl-Identitaet einer Definition (`docs/evaluator-architecture.md` §4.3/§4.4) —
 * die **eine** Stelle, die beantwortet: *unter welchen Ids ist ein Vorkommen
 * dieser Definition zaehlbar?* — und, als zweite Haelfte derselben Frage:
 * *welche Eintragsart hat es?* ({@link entryTypeOf}).
 *
 * Ein Eintrag kann an einer Stelle direkt stehen oder ueber einen `entryLink`
 * hereingezogen werden. Beide Wege benennen dasselbe Vorkommen, aber unter
 * verschiedenen Ids — der Verweis hat eine eigene, das Ziel eine eigene — und
 * Regeln koennen an beiden haengen. Wer ein Vorkommen zaehlt, muss deshalb seine
 * **Menge** von Ids kennen, nicht nur eine davon.
 *
 * Die Regel ist bewusst **einseitig**: nennt eine Regel die Ziel-Id, trifft sie
 * das Vorkommen ueber **jeden** Verweis und auch das direkt gesetzte; nennt sie
 * eine Verweis-Id, trifft sie nur die Vorkommen ueber genau diesen Verweis — eine
 * echte Teilmenge. Gefragt wird darum immer „ist dieser Knoten ein Vorkommen der
 * gesuchten Definition", nie umgekehrt.
 *
 * Und sie ist **Mengenzugehoerigkeit, keine Summierung je Id**: ein Vorkommen
 * zaehlt fuer eine Regel hoechstens einmal, auch wenn mehrere seiner Ids
 * zutreffen. Die gelieferte Liste ist deshalb entdoppelt, und jede Zaehlstelle
 * fragt je Regel genau einmal.
 *
 * Rein und roster-unabhaengig: das Modul kennt nur Definitionen, keinen Baum,
 * keinen Zustand.
 */

import { DefinitionKind } from './model.js';

/**
 * Die Bestandteile der Identitaet, als **eine** Quelle fuer beide Abfrageformen
 * ({@link identityIdsOf} und {@link isOccurrenceOf}) — sonst waere die Regel
 * zweimal geschrieben und koennte auseinanderlaufen:
 *
 * - die **eigene** Id (der Eintrag selbst, oder der Verweis),
 * - die **genannte Ziel-Id** eines Verweises (`targetId`, roh aus dem Katalog),
 * - die Id des **aufgeloesten Ziels** (`resolved.id`). Sie faellt nur dann mit
 *   `targetId` auseinander, wenn der Verweis ueber ein Zwischenglied aufgeloest
 *   wurde; die Identitaet endet in jedem Fall am aufgeloesten Ziel und laeuft
 *   keine Kette ab.
 */
const IDENTITY_ID_READERS = Object.freeze([
  def => def.id,
  def => def.targetId,
  def => def.resolved?.id,
]);

/** True fuer eine tatsaechlich vorhandene Id (weder `null` noch `undefined`). */
function isPresentId(id) {
  return id !== null && id !== undefined;
}

/** True, wenn die Definition ueberhaupt eine Identitaet tragen kann. */
function isDefinition(def) {
  return def !== null && def !== undefined;
}

/**
 * Die Ids, unter denen ein Vorkommen dieser Definition zaehlbar ist: ihre eigene,
 * die Ziel-Id eines Verweises und die Id des aufgeloesten Ziels — entdoppelt und
 * ohne fehlende Angaben.
 *
 * Ein Vorkommen ist unter **jeder** dieser Ids zaehlbar, aber je Regel nur
 * **einmal**: die Liste ist eine Menge, keine Aufzaehlung mit Vielfachheit.
 *
 * @param {object|null|undefined} def  eine Katalogdefinition (Eintrag, Gruppe,
 *   Kategorie, Verweis) oder nichts (die Baumwurzel traegt keine Definition).
 * @returns {string[]} die Identitaets-Ids; leer, wenn keine Definition vorliegt.
 */
export function identityIdsOf(def) {
  if (!isDefinition(def)) return [];
  const ids = [];
  for (const readId of IDENTITY_ID_READERS) {
    const id = readId(def);
    if (isPresentId(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * True, wenn ein Vorkommen dieser Definition unter `wantedId` zaehlt — also
 * gleichbedeutend mit „{@link identityIdsOf} enthaelt `wantedId`", nur ohne die
 * Zwischenliste (die Anwesenheitspruefung der Ankersynthese fragt das je Knoten
 * und Definition).
 *
 * @param {object|null|undefined} def  die Definition des zu pruefenden Vorkommens.
 * @param {string|null|undefined} wantedId  die von einer Regel genannte Id.
 * @returns {boolean}
 */
export function isOccurrenceOf(def, wantedId) {
  if (!isDefinition(def) || !isPresentId(wantedId)) return false;
  for (const readId of IDENTITY_ID_READERS) {
    if (readId(def) === wantedId) return true;
  }
  return false;
}

/**
 * Woher die **Eintragsart** eines Vorkommens stammt, je Definitionsart — die
 * zweite Haelfte der Zaehl-Identitaet, denn eine Bedingung kann statt einer Id
 * eine Eintragsart zaehlen (`childId="model"`, BSData §7.7).
 *
 * - Ein **Eintrag** traegt seine Art selbst (`selectionEntry/@type`).
 * - Ein **Verweis** hat keine eigene: seine Art kommt vom **aufgeloesten Ziel**.
 *   Sein gleichnamiges Attribut wird bewusst **nicht** gelesen — es stammt aus
 *   einer anderen, laut Schema disjunkten Wertemenge (`EntryLinkKind`:
 *   `selectionEntry` | `selectionEntryGroup`) als die Eintragsart
 *   (`SelectionEntryKind`: `upgrade` | `model` | `unit`) und sagt, *worauf* der
 *   Verweis zeigt, nicht *was* das Ziel ist. Als Zaehlziel waere es ein
 *   bedeutungsloser Wert. Der Katalogleser liest es deshalb gar nicht erst
 *   (ADR-0016/0031: roh und schema-treu).
 * - Jede andere Definitionsart (Gruppe, Kontingent, Kategorie, Kategorie-Verweis)
 *   hat keine Eintragsart und steht unter keiner.
 *
 * Das aufgeloeste Ziel ist bereits das **Ende** einer etwaigen Verweiskette
 * (`resolver.js`, `followEntryLink`), hier wird also keine Kette abgelaufen.
 */
const ENTRY_TYPE_READERS = Object.freeze({
  [DefinitionKind.ENTRY]: def => def.type,
  [DefinitionKind.ENTRY_LINK]: def => def.resolved?.type,
});

/**
 * Die Eintragsart, unter der ein Vorkommen dieser Definition zaehlt — bei einem
 * Verweis die seines aufgeloesten Ziels, sonst die eigene.
 *
 * Damit zaehlt ein ueber einen Verweis hereingezogener Eintrag unter derselben
 * Eintragsart wie derselbe Eintrag direkt gesetzt: die Art gehoert zum Ziel, nicht
 * zum Weg dorthin.
 *
 * @param {object|null|undefined} def  eine Katalogdefinition oder nichts.
 * @returns {string|null} die Eintragsart (ein Wert von `SelectionEntryKind`:
 *   `upgrade` | `model` | `unit`); `null`, wenn die Definition keine traegt —
 *   etwa eine Gruppe, ein Kontingent oder ein Verweis mit baumelndem Ziel.
 */
export function entryTypeOf(def) {
  if (!isDefinition(def)) return null;
  const readEntryType = ENTRY_TYPE_READERS[def.kind];
  if (readEntryType === undefined) return null;
  return readEntryType(def) ?? null;
}
