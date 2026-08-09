/**
 * Belegung eines Slots (`docs/evaluator-architecture.md` §4.8, Issue 0147).
 *
 * Der aktuelle Stand eines Slots (`SlotCapability.current`) ist seine
 * **Belegung**: wie viel im eigenen Rahmen unter seinem gezaehlten Ziel steht.
 * Bislang kam diese Zahl ausschliesslich aus dem Ergebnis einer Grenze — und ein
 * Slot ohne auswertbare Grenze meldete deshalb 0, gleichgueltig was unter ihm
 * ausgewaehlt war. Eine fehlende Grenze ist aber kein Beleg fuer einen leeren
 * Slot: ein Katalogautor, der keine (oder nur eine unbegrenzte) Grenze
 * hinschreibt, sagt damit nichts ueber den Bestand, sondern nur, dass er ihn
 * nicht beschraenkt.
 *
 * Diese Schicht liefert die Zahl, die dort einspringt: eine **traege** Sonde ueber
 * den fertigen Zaehlindex, je Slot einmal gerufen und nur dort, wo keine Grenze
 * ein Ergebnis geliefert hat. Wo eine Grenze feuert, bleibt deren `actual`
 * massgeblich — der Rahmen, den der Autor gewaehlt hat (`roster`, `force`,
 * `parent`, …), ist die Aussage, die er getroffen hat, und wird hier nicht
 * ueberschrieben.
 *
 * Gezaehlt wird im **Elternrahmen** des Slots unter seiner gezaehlten Ziel-Id.
 * Beides ist genau die Leseart der Constraint-Schicht (`constraints.js`,
 * {@link evaluateLimit}) fuer eine Grenze mit `scope="parent"`: bei einem Verweis
 * — `entryLink` wie `categoryLink` — zaehlt die aufgeloeste Ziel-Id, sonst die
 * eigene. Damit gibt es eine Quelle dieser Regel und keine zweite, die
 * auseinanderlaufen kann.
 */

import { SELECTION_COUNT, ScopeKeyword, isLinkDefinition } from './model.js';
import { query, createQueryContext } from './query.js';

/**
 * Die **gezaehlte Ziel-Id** eines Slots — dieselbe Regel, mit der eine Grenze am
 * selben Anker ihr Ziel bestimmt (`constraints.js`): bei einem Verweis das
 * aufgeloeste Ziel, sonst die eigene Definition. Verschiedene Verweise koennen
 * auf dasselbe Ziel zeigen; zaehlte die Sonde die Id des Verweises, fiele jede
 * Auswahl, die ueber einen anderen Verweis desselben Ziels hereinkam, aus ihrer
 * Zaehlung heraus.
 */
function countedTargetIdOf(node) {
  return isLinkDefinition(node.def) ? node.def.targetId : node.def.id;
}

/**
 * Baut die Belegungs-Sonde: eine Funktion, die je Knoten dessen Belegung im
 * eigenen Elternrahmen zaehlt.
 *
 * Sie ist bewusst **traege** — ein Verschluss, der je Slot gerufen wird, keine
 * vorab berechnete Tabelle ueber alle Slots: nur die Slots ohne Grenz-Ergebnis
 * bezahlen sie.
 *
 * @param {object} parts
 * @param {object} parts.root  Wurzel des Evaluationsbaums (der ROSTER-Rahmen).
 * @param {{ get: Function }} parts.index  der fertige Zaehlindex.
 * @param {import('./effectiveState.js').EffectiveState} parts.effective  der
 *   konvergierte effektive Zustand. Er entscheidet, unter welchen **effektiven**
 *   Kategorien ein Knoten zaehlt — eine allein per `set-primary` erworbene
 *   Mitgliedschaft zaehlt damit genauso mit wie eine per `categoryLink`
 *   hingeschriebene (`docs/battlescribe-data-format.md` §8).
 * @param {Set<string>} [parts.categoryIds]  die bekannten Kategorie-IDs.
 * @param {object[]} parts.diagnostics  Sammelliste fuer Auswertungsprobleme. Auf
 *   diesem Pfad kann keine entstehen — `parent` loest ohne Index-Arbeit auf den
 *   Elternknoten auf, den jeder Slot hat, und `selectionCount` ist ein
 *   unterstuetztes Feld —, sie reist trotzdem mit, damit nichts still
 *   verschluckt wird, falls der Pfad sich weitet.
 * @param {import('./rosterBudget.js').RosterBudget} [parts.budget]  nur an den
 *   Query-Kontext durchgereicht.
 * @param {Map<string, string>} [parts.primaryCatalogueByForceDefId]  ebenfalls
 *   nur durchgereicht.
 * @returns {(node: object) => number} die Belegung eines Slots.
 */
export function buildOccupancyProbe({
  root, index, effective, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId,
}) {
  return function occupancyOf(node) {
    const ctx = createQueryContext({
      node, root, index, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId, effective,
    });
    // Ohne Flags: gezaehlt wird der Elternrahmen selbst, ohne Unter-Auswahlen und
    // ohne Unter-Kontingente — dieselbe Voreinstellung, die eine hingeschriebene
    // Grenze ohne Flags haette.
    return query(ctx, SELECTION_COUNT, ScopeKeyword.PARENT, countedTargetIdOf(node));
  };
}
