/**
 * Uebersetzt eine Battlescribe-`.ros`-Roster-Datei in den Instanzbaum
 * `{ forces: [{ defId, count, children }] }`, den die Fassade `evaluate` erwartet.
 *
 * Die Uebersetzung ist rein strukturell (Black-Box): jede `<selection>` wird ueber
 * `entryLinkId || entryId` zur Definitions-Id — Battlescribe schreibt bei einer
 * ueber einen `<entryLink>` gesetzten Auswahl `entryId` = Ziel-ID **und**
 * `entryLinkId` = eigene ID des Links; die Link-ID ist dann die gesetzte
 * Definition. `number` wird zur Anzahl (Default 1), und die verschachtelten
 * `<selections>` werden rekursiv zu Kindern. Kein Evaluator-Wissen fliesst ein —
 * genau die Naht, die ein Black-Box-Testautor braucht.
 *
 * Ausgelagert aus den handgeschriebenen `e2e.*.ros.test.js`, damit der
 * generalisierte, manifest-getriebene Runner (`e2e.testcatalog.test.js`) dieselbe
 * `.ros`-Semantik teilt statt sie neu zu erfinden.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();

/**
 * Die verschachtelten `<selection>`-Kinder eines Elements als Instanzbaum-Knoten.
 *
 * @param {Element} element Ein `<force>`- oder `<selection>`-Element.
 * @returns {Array<{ defId: string | null, count: number, children: object[] }>}
 *   Die direkten Auswahl-Kinder, jeweils rekursiv aufgeloest.
 */
function childSelections(element) {
  const out = [];
  for (const child of [...element.children]) {
    if (child.tagName !== 'selections') continue;
    for (const selection of [...child.children]) {
      if (selection.tagName !== 'selection') continue;
      out.push({
        defId: selection.getAttribute('entryLinkId') || selection.getAttribute('entryId'),
        count: Number(selection.getAttribute('number') || '1'),
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
    defId: forceEl.getAttribute('entryId'),
    count: 1,
    children: childSelections(forceEl),
  }));
  return { forces, costLimits: costLimitsFromRoster(doc) };
}
