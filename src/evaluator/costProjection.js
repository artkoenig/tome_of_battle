/**
 * Kostenprojektion des Berichts (Issue 0121, Task 1; ADR-0034: was in den
 * Katalogdaten steht, beantwortet die Engine — die Oberflaeche rechnet keine
 * Kosten nach).
 *
 * Ein Durchlauf ueber den fertigen Auswertungsbaum projiziert die **effektiven**
 * Kosten (nach allen Kosten-Modifikatoren, `effectiveState.js`) auf drei Sichten:
 *
 * - je Slot die **Eigenkosten einer Instanz** (`costs`) — der Wert, den EINE
 *   Instanz kostet bzw. beim Waehlen kosten wuerde (auch an Angebots-Ankern,
 *   ADR-0035). Ein `entryLink`-Slot traegt die Kosten des Verweises vor denen
 *   des Ziels (`docs/battlescribe-data-format.md` §9.3) — das erledigt bereits
 *   die Effektiv-Werte-Schicht (`baseValuesOf`), hier wird nur gelesen;
 * - je Slot die **Gesamtkosten im aktuellen Zustand** (`totalCosts`):
 *   Eigenkosten × Anzahl plus die `totalCosts` aller Kind-Slots. Die Anzahl ist
 *   die **absolute** Gesamtstueckzahl der Instanz (Roster-Vertrag der Fassade,
 *   §7.5 „Zahlenbasis" — keine Elternketten-Multiplikation); ein synthetischer
 *   Anker hat keine Instanz und zaehlt mit 0;
 * - roster-weit die **Kostensumme je Kostenart** (`costTotals`): die Summe der
 *   Beitraege aller **belegten** Slots (Kosten je Instanz × Anzahl). Jede im
 *   Datensatz deklarierte Kostenart erscheint darin — ohne Vorkommen mit 0
 *   (Vertragsentscheidung Issue 0121: BattleScribe zeigt jede Kostenart des
 *   Spielsystems mit „0", und `describeDataset` fuehrt die Deklarationen
 *   bereits vollstaendig). Angebots-Anker und die uebrigen synthetischen Anker
 *   zaehlen nicht: sie tragen keine Instanz.
 *
 * Die Projektion **liest** ausschliesslich — den Baum und die Effektiv-Werte —
 * und rechnet nichts zweites her: dieselben effektiven Kosten speisen auch den
 * Zaehlindex (`countIndex.js`, `contributionOf`).
 */

/** Die leere Kostensicht eines Knotens, den die Projektion nicht kennt. */
const NO_COSTS = Object.freeze({});

/** Addiert einen Betrag auf eine Kostenart eines Kosten-Records. */
function addTo(record, costTypeId, value) {
  record[costTypeId] = (record[costTypeId] ?? 0) + value;
}

/**
 * Baut die Kostenprojektion eines Auswertungsbaums: je Slot die Eigenkosten
 * einer Instanz und die Gesamtkosten des Teilbaums, dazu die roster-weite
 * Kostensumme je Kostenart.
 *
 * @param {{ children: object[] }} root  Wurzel des Auswertungsbaums (nach
 *   Baumphase 2 — die Angebots-Anker haengen bereits).
 * @param {import('./effectiveState.js').EffectiveState} effective  der
 *   konvergierte Effektiv-Zustand (Kosten nach Modifikatoren).
 * @param {readonly string[]} declaredCostTypeIds  die im Datensatz deklarierten
 *   Kostenarten — sie erscheinen in `costTotals` auch ohne Vorkommen (mit 0).
 * @returns {{ costsOf: (node: object) => Record<string, number>, totalCostsOf: (node: object) => Record<string, number>, costTotals: Record<string, number> }}
 */
export function buildCostProjection(root, effective, declaredCostTypeIds) {
  const costsByNode = new Map();
  const totalCostsByNode = new Map();
  /** @type {Record<string, number>} */
  const costTotals = {};
  for (const costTypeId of declaredCostTypeIds) {
    costTotals[costTypeId] = 0;
  }

  function projectNode(node) {
    /** @type {Record<string, number>} */
    const costs = {};
    for (const [costTypeId, perInstance] of effective.costEntriesOf(node)) {
      costs[costTypeId] = perInstance;
    }
    // Ein synthetischer Anker (Phantom, Gruppen-/Kategorie-/Angebots-Anker)
    // traegt keine Instanz: seine Anzahl ist 0, seine Gesamtkosten damit die
    // seiner Kind-Slots (Anker sind Blaetter oder tragen nur weitere Anker).
    const count = node.instance?.count ?? 0;
    /** @type {Record<string, number>} */
    const totals = {};
    for (const [costTypeId, perInstance] of Object.entries(costs)) {
      totals[costTypeId] = perInstance * count;
      // In die roster-weite Summe geht nur ein **belegter** Slot ein — ein
      // Angebot ist keine Auswahl (Kriterium 4, Issue 0121).
      if (node.instance !== null) {
        addTo(costTotals, costTypeId, perInstance * count);
      }
    }
    for (const child of node.children) {
      for (const [costTypeId, value] of Object.entries(projectNode(child))) {
        addTo(totals, costTypeId, value);
      }
    }
    costsByNode.set(node, Object.freeze(costs));
    totalCostsByNode.set(node, Object.freeze(totals));
    return totals;
  }

  for (const child of root.children) {
    projectNode(child);
  }

  return {
    costsOf: node => costsByNode.get(node) ?? NO_COSTS,
    totalCostsOf: node => totalCostsByNode.get(node) ?? NO_COSTS,
    costTotals: Object.freeze(costTotals),
  };
}
