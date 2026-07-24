/**
 * Join-Schicht (`docs/evaluator-architecture.md` §3.2/§4.3).
 *
 * Verheiratet Instanz- und Definitionsbaum: jeder Instanzknoten erhaelt seine
 * aufgeloeste Definition. Ab Issue 03 traegt jeder Knoten die Struktur, die das
 * Query-Primitiv fuer die Bezugsrahmen-Aufloesung braucht: eine stabile
 * Rahmen-Identitaet (`frameId`), den Elternzeiger (`parent`), das umschliessende
 * Kontingent (`forceRoot`) und die Markierung, ob der Knoten selbst ein
 * Kontingent ist (`isForce`). Phantomknoten (Anker fuer Grenzen ohne Instanz)
 * bleiben bewusst spaeteren Scheiben vorbehalten — alle Knoten hier sind real.
 */

import { DefinitionKind, DiagnosticKind, ScopeKeyword, diagnostic } from './model.js';

/** Praefix der Rahmen-Identitaet eines realen Knotens (die Wurzel ist `roster`). */
const NODE_FRAME_PREFIX = 'node:';

/**
 * Die Rahmen-Identitaet eines Knotens als String-Schluessel: die Wurzel ist der
 * ROSTER-Rahmen, jeder andere Knoten seine eigene, instanz-eindeutige Identitaet
 * (zwei Instanzen derselben Definition sind **verschiedene** Rahmen).
 */
export function frameKeyOf(node) {
  return node.isRoot ? ScopeKeyword.ROSTER : `${NODE_FRAME_PREFIX}${node.frameId}`;
}

/** Vergibt fortlaufende, instanz-eindeutige Rahmen-Identitaeten waehrend des Aufbaus. */
function createFrameIdSource() {
  let next = 0;
  return () => next++;
}

/** Haengt einen Instanzknoten samt Kindern (Auswahlen wie geschachtelte Kontingente) an. */
function attachInstance(parent, instance, resolved, diagnostics, nextFrameId) {
  const def = resolved.lookup(instance.defId);
  if (def === null) {
    diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_DEFINITION, { defId: instance.defId }));
    return;
  }
  const isForce = def.kind === DefinitionKind.FORCE;
  const node = {
    def,
    instance,
    parent,
    children: [],
    isPhantom: false,
    isRoot: false,
    isForce,
    frameId: nextFrameId(),
    // Das umschliessende Kontingent: der Knoten selbst, wenn er ein Kontingent
    // ist, sonst das seines Elternknotens. Steht ueber keinem Kontingent (z. B.
    // ein Wurzel-Eintrag ohne Force-Huelle), bleibt es null.
    forceRoot: null,
  };
  node.forceRoot = isForce ? node : parent.forceRoot;
  parent.children.push(node);
  for (const childInstance of instance.children ?? []) {
    attachInstance(node, childInstance, resolved, diagnostics, nextFrameId);
  }
}

/**
 * Baut den Evaluationsbaum aus aufgeloesten Definitionen und Roster-Instanzen.
 * Die Wurzel ist ein synthetischer Ankerknoten ohne eigene Definition; sie
 * traegt den ROSTER-Rahmen und liegt ueber keinem Kontingent.
 *
 * @param {{ lookup: (id: string) => object|null }} resolved
 * @param {{ forces?: object[] }} roster
 * @returns {{ root: object, diagnostics: object[] }}
 */
export function buildEvalTree(resolved, roster) {
  const diagnostics = [];
  const nextFrameId = createFrameIdSource();
  const root = {
    def: null,
    instance: null,
    parent: null,
    children: [],
    isPhantom: false,
    isRoot: true,
    isForce: false,
    frameId: nextFrameId(),
    forceRoot: null,
  };
  for (const forceInstance of roster.forces ?? []) {
    attachInstance(root, forceInstance, resolved, diagnostics, nextFrameId);
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
 * Reale Knoten des Baums (die synthetische Wurzel ausgenommen). Kontingent-Knoten
 * sind reale Knoten: sie leiten Beitraege ihrer Nachfahren weiter, tragen aber
 * selbst keine Selektion bei (siehe Index-Schicht). Phantomknoten gaebe es hier
 * keine — sie folgen in einer spaeteren Scheibe.
 */
export function* realNodes(root) {
  for (const child of root.children) {
    yield* nodeAndDescendants(child);
  }
}
