/**
 * Diagnosen des Berichts, die die Oberfläche dem Nutzer zeigen muss.
 *
 * Der Bericht trennt Verletzungen (das Roster bricht eine Regel) von Diagnosen
 * (der Datensatz trägt das Roster nicht). Für eine dieser Diagnosen hat der
 * Nutzer eine Handlungsmöglichkeit und braucht deshalb eine Meldung: eine
 * Auswahl, deren Definition der Katalog nicht mehr kennt. Genau das passiert
 * beim stillen Katalog-Update (ADR 0018), wenn ein Eintrag entfällt — die
 * Auswahl steht dann noch im gespeicherten Roster, hat aber keine Definition
 * mehr, wird von der Engine übergangen und würde sonst spurlos verschwinden.
 *
 * Die Diagnose selbst nennt nur die Definitions-Id. Den Namen, den der Nutzer
 * kennt, trägt seine eigene Auswahl — er wird deshalb hier aus dem Roster
 * nachgeschlagen (dieselbe Identitätsregel wie im Adapter: der Verweis zählt,
 * sonst der Eintrag).
 *
 * Ein **Kontingent** kann seine Definition genauso verlieren wie eine Auswahl —
 * es erscheint dann mit seiner Id. Einen Klartextnamen gibt es für diesen Fall
 * nirgends: das App-Force-Modell (`src/domain/types.js`) führt keinen (der `.ros`-Import
 * verwirft das `name`-Attribut), und der Name der Definition ist genau das, was
 * mit ihr fehlt. Die Id ist hier also die ehrliche Auskunft, kein Notbehelf.
 */

const UNRESOLVED_DEFINITION = 'unresolvedDefinition';

function collectNamesByDefId(selections, into) {
  for (const selection of selections ?? []) {
    const defId = selection.entryLinkId || selection.selectionEntryId;
    if (defId && !into.has(defId)) into.set(defId, selection.name ?? defId);
    collectNamesByDefId(selection.selections, into);
  }
  return into;
}

/**
 * Die Auswahlen eines Rosters, deren Definition der Datensatz nicht kennt.
 *
 * @param {ReadonlyArray<object>|null|undefined} diagnostics  `diagnostics` des Berichts.
 * @param {import('../../domain/types.js').Roster|null|undefined} roster  das App-Roster.
 * @returns {Array<{ defId: string, name: string }>} je unauflösbarer Definition
 *   einmal, in der Reihenfolge der Diagnosen; Name aus dem Roster, sonst die Id.
 */
export function unresolvedSelectionsOf(diagnostics, roster) {
  const unresolved = (diagnostics ?? []).filter((d) => d?.kind === UNRESOLVED_DEFINITION);
  if (unresolved.length === 0) return [];

  const namesByDefId = new Map();
  for (const force of roster?.forces ?? []) collectNamesByDefId(force.selections, namesByDefId);

  const seen = new Set();
  const result = [];
  for (const diagnostic of unresolved) {
    if (seen.has(diagnostic.defId)) continue;
    seen.add(diagnostic.defId);
    result.push({ defId: diagnostic.defId, name: namesByDefId.get(diagnostic.defId) ?? diagnostic.defId });
  }
  return result;
}
