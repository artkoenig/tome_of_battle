/**
 * Uebersetzt eine Battlescribe-`.ros`-Roster-Datei in den Instanzbaum
 * `{ forces: [{ defId, count, children }] }`, den die Fassade `evaluate` erwartet.
 *
 * Die Uebersetzung ist rein strukturell (Black-Box): jede `<selection>` wird ueber
 * die Id, unter der sie im Katalog steht, zur Definitions-Id, `number` zur Anzahl
 * (Default 1), und ihre verschachtelten `<selections>` werden rekursiv zu Kindern.
 * Kein Evaluator-Wissen fliesst ein — genau die Naht, die ein Black-Box-Testautor
 * braucht.
 *
 * Eine `<selection>` benennt **zwei** Ids: `entryId` den gewaehlten Eintrag und
 * `entryLinkId` den Verweis, ueber den er hereinkam (leer bei direkter Auswahl).
 * Massgeblich ist der **Verweis**, wenn es einen gibt: an ihm haengen eigene
 * Grenzen, Modifikatoren und Kosten, und aus ihm laesst sich sein Ziel ableiten —
 * umgekehrt nie, denn ein Eintrag hat beliebig viele Verweise. Die vom Roster
 * mitgefuehrte Ziel-Id reist als reines **Pruefdatum** mit
 * (`expectedTargetDefId`): nur die Engine kennt den Katalog und kann feststellen,
 * ob Verweis und genanntes Ziel noch zusammenpassen.
 *
 * Ausgelagert aus den handgeschriebenen `e2e.*.ros.test.js`, damit der
 * generalisierte, manifest-getriebene Runner (`e2e.testcatalog.test.js`) dieselbe
 * `.ros`-Semantik teilt statt sie neu zu erfinden.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();

/** Das Attribut einer `<selection>`, das den gewaehlten **Eintrag** benennt. */
const ENTRY_ID_ATTRIBUTE = 'entryId';

/**
 * Das Attribut einer `<selection>`, das den **Verweis** benennt, ueber den der
 * Eintrag hereinkam. BattleScribe schreibt es auch bei direkter Auswahl — dann
 * leer, was „kein Verweis" heisst und nicht „Angabe fehlt".
 */
const ENTRY_LINK_ID_ATTRIBUTE = 'entryLinkId';

/** Das Attribut einer `<selection>`, das ihre Anzahl traegt (fehlend: eine). */
const COUNT_ATTRIBUTE = 'number';

/** Die Anzahl einer `<selection>` ohne eigenes `number`-Attribut. */
const DEFAULT_COUNT = 1;

/**
 * Die Bindung einer `<selection>` an den Katalog: die Id, unter der sie dort
 * steht, und — nur wenn sie ueber einen Verweis gesetzt wurde — die vom Roster
 * mitgefuehrte Ziel-Id als Pruefdatum.
 *
 * Ein leeres oder fehlendes `entryLinkId` heisst „direkt gewaehlt": dann benennt
 * `entryId` die Definition selbst und es gibt nichts zu pruefen.
 *
 * @param {Element} selection Ein `<selection>`-Element.
 * @returns {{ defId: string | null, expectedTargetDefId?: string }}
 */
function bindingOf(selection) {
  const entryId = selection.getAttribute(ENTRY_ID_ATTRIBUTE);
  const entryLinkId = selection.getAttribute(ENTRY_LINK_ID_ATTRIBUTE);
  if (!entryLinkId) return { defId: entryId };
  return entryId === null
    ? { defId: entryLinkId }
    : { defId: entryLinkId, expectedTargetDefId: entryId };
}

/**
 * Die verschachtelten `<selection>`-Kinder eines Elements als Instanzbaum-Knoten.
 *
 * @param {Element} element Ein `<force>`- oder `<selection>`-Element.
 * @returns {Array<{ defId: string | null, expectedTargetDefId?: string, count: number, children: object[] }>}
 *   Die direkten Auswahl-Kinder, jeweils rekursiv aufgeloest.
 */
function childSelections(element) {
  const out = [];
  for (const child of [...element.children]) {
    if (child.tagName !== 'selections') continue;
    for (const selection of [...child.children]) {
      if (selection.tagName !== 'selection') continue;
      out.push({
        ...bindingOf(selection),
        count: Number(selection.getAttribute(COUNT_ATTRIBUTE) || String(DEFAULT_COUNT)),
        children: childSelections(selection),
      });
    }
  }
  return out;
}

/**
 * Die eingestellten Kostengrenzen (`<costLimits>`) des Rosters als Liste je
 * Kostenart. Fehlt der Block, ist die Liste leer — verhaltensgleich zu einem
 * Roster ohne eingestelltes Budget. Rein strukturell (Black-Box), wie der Rest.
 *
 * @param {Document} doc Das geparste `.ros`-Dokument.
 * @returns {Array<{ costTypeId: string, value: number }>}
 *   Das eingestellte Budget je Kostenart.
 */
function costLimitsFromRoster(doc) {
  const out = [];
  const rosterEl = doc.getElementsByTagName('roster')[0];
  if (!rosterEl) return out;
  for (const child of [...rosterEl.children]) {
    if (child.tagName !== 'costLimits') continue;
    for (const limit of [...child.children]) {
      if (limit.tagName !== 'costLimit') continue;
      const costTypeId = limit.getAttribute('typeId');
      const value = Number(limit.getAttribute('value'));
      if (costTypeId && Number.isFinite(value)) out.push({ costTypeId, value });
    }
  }
  return out;
}

/**
 * Liest eine `.ros`-Datei und liefert das Roster als Instanzbaum inklusive der
 * eingestellten Kostengrenzen.
 *
 * @param {string} path Pfad zur `.ros`-Datei, relativ zum Projekt-Wurzelverzeichnis
 *   (dem cwd des Testlaufs) aufgeloest — wie die uebrigen fixture-lesenden Tests.
 * @returns {{ forces: Array<{ defId: string | null, count: number, children: object[] }>,
 *            costLimits: Array<{ costTypeId: string, value: number }> }}
 *   Das Roster in der von `evaluate` erwarteten Form.
 */
export function rosterFromRos(path) {
  const xml = readFileSync(resolve(path), 'utf8');
  const doc = new dom.window.DOMParser().parseFromString(xml, 'application/xml');
  const forces = [...doc.getElementsByTagName('force')].map(forceEl => ({
    defId: forceEl.getAttribute(ENTRY_ID_ATTRIBUTE),
    count: DEFAULT_COUNT,
    children: childSelections(forceEl),
  }));
  return { forces, costLimits: costLimitsFromRoster(doc) };
}
