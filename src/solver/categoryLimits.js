import { ConstraintKind } from '../parser/schema/battlescribeSchema.generated.js';
import { getInheritedCategoryMaxSource } from './systemQuirks.js';
import { getEffectiveModifiers, getModifiedConstraintValue } from '../roster/modifierEvaluator.js';
import '../types.js';

/**
 * Anzeige-Grenzen einer Force-Kategorie — die **eine** Stelle, an der die
 * Oberfläche das wirksame Min/Max eines Kategorie-Links herleitet (ADR 0029).
 *
 * Sidebar (`RosterSidebar`) und Sektions-Kopf (`RosterCategorySection`) zeigen
 * dieselbe Kategorie an; würde jede ihr Maximum selbst berechnen, könnten die
 * Werte auseinanderdriften. Beide leiten es deshalb hier ab. Der system­gebundene
 * Vererbungs-Quirk (eine Kategorie erbt ein fehlendes max von einer anderen —
 * ADR 0003 §2, deklariert in `systemQuirks.js`) wird ausschließlich über das
 * Quirk-Muster beantwortet, nie über im UI festgeschriebene Kategorie-IDs.
 */

// Synthetische ID des per System-Quirk von einer anderen Kategorie geerbten max-Constraints.
export const QUIRK_INHERITED_MAX_ID = 'quirk-inherited-max';

// Ein fehlender/negativer (BattleScribe: -1) max-Wert bedeutet „unbegrenzt".
const UNBOUNDED_MAX = Infinity;
const NO_MIN = 0;

/**
 * Der max-Constraint, den eine Kategorie über den system­gebundenen Quirk von einer
 * anderen Kategorie erbt (ADR 0003 §2), oder `null`. Die **einzige** Stelle, die das
 * `inheritedCategoryMax`-Quirk-Datum in einen echten max-Constraint übersetzt — von
 * Roster-Validierung (`rosterValidator.js`) wie Kategorie-Anzeige gemeinsam genutzt,
 * damit beide nie uneins sein können.
 *
 * Greift nur, wenn die Kategorie **keinen** eigenen max-Constraint trägt; sonst gilt
 * ihr eigener. Der geerbte Constraint übernimmt Wert und Feld der Quell-Kategorie,
 * bekommt aber eine eigene synthetische ID.
 *
 * @param {Object} args
 * @param {Object} args.system                das geparste Spielsystem (trägt die Quirk-Bindung).
 * @param {Object|null|undefined} args.forceDef  das Kontingent, dessen categoryLinks die Quelle liefern.
 * @param {string} args.targetCatId           die Ziel-Kategorie, die erben könnte.
 * @param {Object[]|null|undefined} args.ownConstraints  die eigenen Constraints der Ziel-Kategorie.
 * @returns {{constraint: Object, modifiers: Object[]}|null}
 */
export function getInheritedCategoryMaxConstraint({ system, forceDef, targetCatId, ownConstraints }) {
  if ((ownConstraints || []).some(con => con.type === ConstraintKind.MAX)) {
    return null;
  }
  const inheritFromCatId = getInheritedCategoryMaxSource(system, targetCatId);
  if (!inheritFromCatId) {
    return null;
  }
  const sourceCatLink = forceDef?.categoryLinks?.find(catLink => catLink.targetId === inheritFromCatId);
  const sourceMaxConstraint = sourceCatLink?.constraints?.find(con => con.type === ConstraintKind.MAX);
  if (!sourceMaxConstraint) {
    return null;
  }
  return {
    constraint: { ...sourceMaxConstraint, id: QUIRK_INHERITED_MAX_ID, type: ConstraintKind.MAX },
    modifiers: getEffectiveModifiers(sourceCatLink)
  };
}

/**
 * Das wirksame, modifikator-aufgelöste Min/Max, das ein Kategorie-Link anzeigt.
 * Fehlt der max-Constraint, greift der system­gebundene Vererbungs-Quirk; bleibt auch
 * er ohne Quelle, ist die Kategorie unbegrenzt. Ein negativer max-Wert (-1) zählt als
 * unbegrenzt, ein Min wird auf ≥ 0 normalisiert.
 *
 * @param {Object} categoryLink                der Kategorie-Link des Kontingents.
 * @param {Object} args
 * @param {Object} args.system                 das Spielsystem.
 * @param {Object|null|undefined} args.forceDef  das Kontingent (Quelle des geerbten max).
 * @param {Object} args.displayContext         Kontext, der die Modifier-Bedingungen prüft.
 * @returns {{minValue: number, maxValue: number, minConstraint: Object|null, maxConstraint: Object|null}}
 */
export function getCategoryDisplayLimits(categoryLink, { system, forceDef, displayContext }) {
  const ownConstraints = categoryLink.constraints || [];
  const linkModifiers = getEffectiveModifiers(categoryLink);

  const minConstraint = ownConstraints.find(con => con.type === ConstraintKind.MIN) || null;
  const minValue = minConstraint
    ? Math.max(NO_MIN, getModifiedConstraintValue(minConstraint, linkModifiers, displayContext))
    : NO_MIN;

  let maxConstraint = ownConstraints.find(con => con.type === ConstraintKind.MAX) || null;
  let maxModifiers = linkModifiers;
  if (!maxConstraint) {
    const inherited = getInheritedCategoryMaxConstraint({
      system, forceDef, targetCatId: categoryLink.targetId, ownConstraints
    });
    if (inherited) {
      maxConstraint = inherited.constraint;
      maxModifiers = inherited.modifiers;
    }
  }

  let maxValue = UNBOUNDED_MAX;
  if (maxConstraint) {
    const resolved = getModifiedConstraintValue(maxConstraint, maxModifiers, displayContext);
    maxValue = resolved < 0 ? UNBOUNDED_MAX : resolved;
  }

  return { minValue, maxValue, minConstraint, maxConstraint };
}
