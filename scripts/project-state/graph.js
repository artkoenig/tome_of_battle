/**
 * Reine Auswertung des Importgraphen (ohne Prozess- oder Dateizugriff, damit sie
 * testbar bleibt). Eingabe sind die Module des von `cast scan` geschriebenen
 * Graphen (ADR 0041), Ausgabe sind Zyklen und Schichtverstoesse.
 *
 * Warum die Auswertung hier noch einmal stattfindet, obwohl der Strukturpruefer
 * das ebenfalls kann: sein Vorgaenger war der Anlass des Vorhabens, weil er auf
 * einer nicht unterstuetzten Node-Version abbrach, ohne je eine Regel zu
 * pruefen. Ein Graph ist eine robustere Eingabe als ein Regelurteil -- er laesst
 * sich auch aus einer anderen Quelle beschaffen.
 */

/**
 * Die Schichtung der App. Eine tiefere Schicht darf nicht auf eine hoehere
 * zugreifen. Seit Issue 0121 steht in der Mitte das App-Schreibmodell
 * `src/domain/roster/` (frueher `src/solver/`, abgerissen).
 */
export const DEFAULT_LAYERS = Object.freeze([
  { name: 'parser', prefix: 'src/data/parser/' },
  { name: 'roster', prefix: 'src/domain/roster/' },
  { name: 'components', prefix: 'src/ui/components/' },
]);

const SMALLEST_CYCLE_NODE_COUNT = 2;

/**
 * @typedef {Record<string, string[]>} ImportGraph
 *   Adjazenzliste: Modulpfad -> Pfade der von ihm importierten Module.
 */

/**
 * Normalisiert die Module aus `cast scan` zu einer Adjazenzliste. Gezaehlt wird
 * nur, was auf einem Modul des Projekts gelandet ist (`resolution: "module"`):
 * externe Pakete, nicht aufloesbare und undurchsichtige Importe sind keine
 * Kanten im Graphen des Projekts.
 *
 * @param {ReadonlyArray<{ id: string, edges?: ReadonlyArray<{ to: string|null, resolution: string }> }>} castModules
 * @returns {ImportGraph}
 */
export function buildImportGraph(castModules) {
  /** @type {ImportGraph} */
  const graph = {};

  for (const module of castModules ?? []) {
    const targets = (module.edges ?? [])
      .filter((edge) => edge.resolution === 'module' && edge.to)
      .map((edge) => edge.to);
    graph[module.id] = [...new Set(targets)].sort();
  }

  return graph;
}

/**
 * Findet die Zyklen im Importgraphen.
 *
 * Ermittelt werden die starken Zusammenhangskomponenten (Tarjan): jede Gruppe
 * von mindestens zwei Modulen, die sich gegenseitig erreichen, sowie jeder
 * Selbstimport. Diese Sicht ist vollstaendig -- kein Zyklus entgeht ihr, weil
 * jeder Zyklus vollstaendig in genau einer Komponente liegt -- und sie
 * beantwortet die eigentliche Frage: welche Module haengen unaufloesbar
 * aneinander.
 *
 * @param {ImportGraph} graph
 * @returns {string[][]}  je Zyklus die beteiligten Module, sortiert
 */
export function findCycles(graph) {
  const adjacency = graph ?? {};
  const index = new Map();
  const lowLink = new Map();
  const onStack = new Set();
  /** @type {string[]} */
  const stack = [];
  /** @type {string[][]} */
  const cycles = [];
  let nextIndex = 0;

  const strongConnect = (node) => {
    index.set(node, nextIndex);
    lowLink.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const neighbour of adjacency[node] ?? []) {
      if (!index.has(neighbour)) {
        strongConnect(neighbour);
        lowLink.set(node, Math.min(lowLink.get(node), lowLink.get(neighbour)));
      } else if (onStack.has(neighbour)) {
        lowLink.set(node, Math.min(lowLink.get(node), index.get(neighbour)));
      }
    }

    if (lowLink.get(node) !== index.get(node)) return;

    /** @type {string[]} */
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);

    if (isCyclic(component, adjacency)) cycles.push(component.sort());
  };

  for (const node of Object.keys(adjacency).sort()) {
    if (!index.has(node)) strongConnect(node);
  }

  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}

/** Eine Komponente ist zyklisch, wenn sie mehrere Module umfasst oder sich selbst importiert. */
function isCyclic(component, adjacency) {
  if (component.length >= SMALLEST_CYCLE_NODE_COUNT) return true;
  const [only] = component;
  return (adjacency[only] ?? []).includes(only);
}

/**
 * @typedef {object} LayerViolation
 * @property {string} from
 * @property {string} to
 * @property {string} fromLayer
 * @property {string} toLayer
 */

/**
 * Findet Importe, die der Schichtung widersprechen: ein Modul einer tieferen
 * Schicht, das auf eine hoehere zugreift.
 *
 * @param {ImportGraph} graph
 * @param {ReadonlyArray<{ name: string, prefix: string }>} [layers]  von tief nach hoch
 * @returns {LayerViolation[]}
 */
export function findLayerViolations(graph, layers = DEFAULT_LAYERS) {
  /** @type {LayerViolation[]} */
  const violations = [];

  for (const from of Object.keys(graph ?? {}).sort()) {
    const fromLayer = layerIndexOf(from, layers);
    if (fromLayer === -1) continue;

    for (const to of graph[from]) {
      const toLayer = layerIndexOf(to, layers);
      if (toLayer === -1 || toLayer <= fromLayer) continue;
      violations.push({
        from,
        to,
        fromLayer: layers[fromLayer].name,
        toLayer: layers[toLayer].name,
      });
    }
  }

  return violations;
}

function layerIndexOf(modulePath, layers) {
  return layers.findIndex((layer) => modulePath.startsWith(layer.prefix));
}
