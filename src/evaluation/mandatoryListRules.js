/**
 * Die **eindeutigen Pflicht-Listenregeln eines Kontingents, gelesen aus dem
 * Bericht** (Issue 0157, ADR-0034).
 *
 * Welche Listenregeln §9.9 einem frischen Kontingent ohne jede Nutzerwahl
 * mitgibt, entschied bislang ein zweiter Katalog-Durchlauf
 * (`src/roster/listRules.js`): Wurzel-Pools, `min`-Constraints mit
 * geschriebenem `scope`, Modifikatoren und die `hidden`-Auswertung, alles noch
 * einmal neben dem Evaluator. Der Bericht beantwortet dieselbe Frage bereits:
 * er zaehlt unter dem Kontingent genau die Definitionen auf, die dort
 * ueberhaupt erreichbar sind, sagt je Slot ob er eine Listenregel ist
 * (`isListRule`), ob diese Regel eine eindeutige armeeweite Pflicht ist
 * (`isMandatoryListRule`), ob sie ausgeblendet ist (`isHidden`) und ob sie
 * schon belegt ist (Ankerart bzw. Slot-Pfad einer Selektion).
 *
 * Das Modul liest nur. Der Katalog-Eintrag, aus dem das Schreibmodell die
 * Selektion baut, wird von aussen ueber `entryOf` beigesteuert — das ist
 * Schreibpfad, kein Anzeigepfad.
 */
/** Der Trenner, mit dem ein Slot-Pfad seine Ebenen schreibt. */
const PATH_SEPARATOR = '/';

/**
 * Die Ankerarten, die eine **noch nicht getroffene** Wahl bezeichnen: ein
 * Angebot des Kontingents und das Pflicht-Phantom, das der Evaluator fuer eine
 * unerfuellte Wurzel-Pflicht synthetisiert. Ein `occupied`-Slot ist die Regel
 * bereits — er fehlt per Definition nicht.
 */
const MISSING_ANCHOR_KINDS = new Set(['offerAnchor', 'mandatoryPhantom']);

/** Die Definitions-Id, unter der eine Regel wiedererkannt und entdoppelt wird. */
const resolvedIdOf = (capability) => capability.targetDefId ?? capability.defId;

/**
 * @typedef {Object} MissingMandatoryListRule
 * @property {Object|null} entry   der Katalog-Eintrag/-Link der Regel (fuer das Schreibmodell).
 * @property {?string} categoryId  ihre effektive Primaerkategorie laut Bericht.
 * @property {string} defId        die Definitions-Id des Slots.
 * @property {string} resolvedId   die aufgeloeste Id (stabiler Abgleich).
 * @property {string} name         ihr Anzeigename laut Bericht.
 * @property {ReadonlyArray<object>} mandatoryMembers  ihre Pflicht-Mitglieder laut
 *   Bericht (`capability.raiseMembers`), fuer die Selektions-Fabrik.
 */

/**
 * Die eindeutigen Pflicht-Listenregeln, die dieses Kontingent noch nicht fuehrt.
 *
 * Beruecksichtigt wird ausschliesslich, was der Bericht unter dem Kontingent
 * anbietet — damit gilt die Katalog-Reichweite des Evaluators (ADR-0032: eigenes
 * Buch, seine `catalogueLink`-Huelle, das Spielsystem; ein geteilter Eintrag ist
 * kein Wurzel-Angebot) ohne eine zweite Lesart daneben. Eine Regel, die schon
 * belegt ist, faellt ueber ihre aufgeloeste Id heraus, auch wenn daneben noch
 * ein Angebots-Anker derselben Definition steht.
 *
 * @param {Map<string, object>|null|undefined} capabilities  Slot-Map des Berichts.
 * @param {string|null|undefined} forcePath  Slot-Pfad des Kontingents.
 * @param {{ entryOf?: (capability: object) => object|null, skipResolvedIds?: Set<string> }} [context]
 *   `skipResolvedIds`: Regeln, die ein frueher behandeltes Kontingent desselben
 *   Durchlaufs schon uebernommen hat — eine armeeweite Pflicht wird genau
 *   einmal gesetzt, nicht je Kontingent erneut.
 * @returns {MissingMandatoryListRule[]}
 */
export function findMissingMandatoryListRules(capabilities, forcePath, context = {}) {
  const { entryOf = () => null, skipResolvedIds = new Set() } = context;
  if (!capabilities || capabilities.size === 0) return [];

  // Was der Roster bereits fuehrt: eine armeeweite Pflicht (§9.9 misst in
  // `force`/`roster`) ist gefuehrt, sobald **irgendein** belegter Slot ihre
  // Definition traegt — deshalb der roster-weite Abgleich statt eines
  // Geschwister-Vergleichs.
  const presentIds = new Set();
  for (const capability of capabilities.values()) {
    if (capability.anchorKind === 'occupied') presentIds.add(resolvedIdOf(capability));
  }

  // Die Slots, die fuer dieses Kontingent zaehlen: sein eigenes Angebot und die
  // **Wurzel-Pflicht-Phantome** des Berichts. Letztere haengen an der Wurzel,
  // nicht am Kontingent (`synthesizeMandatoryPhantoms`): eine Wurzel-Pflicht ist
  // eine Aussage ueber die Armee, nicht ueber ein einzelnes Kontingent. Genau
  // sie sind der Fall, den §9.9 meint — der Aushebe-Dialog bietet eine solche
  // Regel gar nicht erst an.
  const candidates = [];
  for (const [path, capability] of capabilities) {
    if (isRootLevelPath(path) || (forcePath && isChildPath(path, forcePath))) {
      candidates.push(capability);
    }
  }

  const missing = [];
  const seen = new Set();
  for (const capability of candidates) {
    if (!MISSING_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (capability.isMandatoryListRule !== true) continue;
    if (capability.isHidden) continue;

    const resolvedId = resolvedIdOf(capability);
    if (presentIds.has(resolvedId) || seen.has(resolvedId) || skipResolvedIds.has(resolvedId)) continue;
    seen.add(resolvedId);

    missing.push({
      entry: entryOf(capability),
      categoryId: capability.primaryCategoryId ?? null,
      defId: capability.defId,
      resolvedId,
      name: capability.name,
      // Die Pflicht-Mitglieder der Regel selbst — dieselbe Auskunft des
      // Berichts, aus der die Fabrik den Teilbaum anlegt (Issue 0157).
      mandatoryMembers: capability.raiseMembers ?? [],
    });
  }
  return missing;
}

/** Ein Slot der obersten Ebene: sein Pfad traegt keinen Trenner. */
function isRootLevelPath(path) {
  return !path.includes(PATH_SEPARATOR);
}

/** Ein direktes Kind von `parentPath`. */
function isChildPath(path, parentPath) {
  return path.startsWith(parentPath + PATH_SEPARATOR)
    && !path.slice(parentPath.length + 1).includes(PATH_SEPARATOR);
}
