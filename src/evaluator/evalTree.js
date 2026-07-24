/**
 * Join-Schicht (`docs/evaluator-architecture.md` §3.2), Skeleton-Umfang.
 *
 * Verheiratet Instanz- und Definitionsbaum: jeder Instanzknoten erhaelt seine
 * aufgeloeste Definition. Phantomknoten (Anker fuer Grenzen ohne Instanz) sind
 * bewusst noch nicht Teil dieser Scheibe — alle Knoten hier sind reale Knoten.
 */

import { DiagnosticKind, diagnostic } from './model.js';

/** Haengt einen Instanzknoten samt Kindern unter einen Elternknoten. */
function attachInstance(parent, instance, resolved, diagnostics) {
  const def = resolved.lookup(instance.defId);
  if (def === null) {
    diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_DEFINITION, { defId: instance.defId }));
    return;
  }
  const node = {
    def,
    instance,
    parent,
    children: [],
    isPhantom: false,
  };
  parent.children.push(node);
  for (const childInstance of instance.children ?? []) {
    attachInstance(node, childInstance, resolved, diagnostics);
  }
}

/**
 * Baut den Evaluationsbaum aus aufgeloesten Definitionen und Roster-Instanzen.
 * Die Wurzel ist ein synthetischer Ankerknoten ohne eigene Definition.
 *
 * @param {{ lookup: (id: string) => object|null }} resolved
 * @param {{ forces?: object[] }} roster
 * @returns {{ root: object, diagnostics: object[] }}
 */
export function buildEvalTree(resolved, roster) {
  const diagnostics = [];
  const root = {
    def: null,
    instance: null,
    parent: null,
    children: [],
    isPhantom: false,
  };
  for (const forceInstance of roster.forces ?? []) {
    attachInstance(root, forceInstance, resolved, diagnostics);
  }
  return { root, diagnostics };
}

/** Rekursiver Generator ueber einen Knoten und alle seine Nachfahren. */
function* nodeAndDescendants(node) {
  yield node;
  for (const child of node.children) {
    yield* nodeAndDescendants(child);
  }
}

/**
 * Reale Knoten des Baums (die synthetische Wurzel ausgenommen). Phantomknoten
 * gaebe es hier keine — sie zaehlen in spaeteren Scheiben ohnehin nie mit.
 */
export function* realNodes(root) {
  for (const child of root.children) {
    yield* nodeAndDescendants(child);
  }
}
