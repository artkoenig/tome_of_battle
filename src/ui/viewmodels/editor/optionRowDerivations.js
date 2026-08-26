import { countOptionInstances, UPGRADE_DETAILS_KEYWORDS } from '../../../contexts/armylist/model';

/**
 * Die Ableitungen, die sich **jede** Options-Zeile des Editors teilt — der
 * Konfigurator (`useSelectionConfigurator`) für seine gruppenlosen Zeilen, die
 * Gruppe (`useOptionGroup`) für ihre Mitglieder.
 *
 * Alles hier ist rein: Roster-Struktur hinein, Zahl oder Text heraus. Keine
 * Funktion greift auf den Katalog oder das geparste System zurück — was gemessen
 * werden musste, hat die Engine gemessen (ADR-0034).
 */

/**
 * Tiefensuche nach einer Roster-Selektion innerhalb eines Teilbaums.
 * @param {Object|null} rootSelection Teilbaum, in dem gesucht wird
 * @param {string|null} selectionId gesuchte Selektions-Id
 * @returns {Object|null}
 */
export const findSelectionById = (rootSelection, selectionId) => {
  if (!rootSelection || !selectionId) return null;
  if (rootSelection.id === selectionId) return rootSelection;
  for (const child of rootSelection.selections || []) {
    const found = findSelectionById(child, selectionId);
    if (found) return found;
  }
  return null;
};

/**
 * Die Roster-Selektion, für die eine Options-Zeile gerade steht — `null`,
 * solange die Option nicht gewählt ist. Nachgereichte Unteroptionen tragen genau
 * diese Id als `ownerSelectionId`; daraus entsteht die Einrückung.
 *
 * Rein darstellend: sie ändert nie, was gewählt, gezählt, bepreist oder
 * geschrieben wird.
 * @param {Object} rootSelection die Selektion, die der Konfigurator bearbeitet
 * @param {string|null} ownerSelectionId Träger der Gruppe der Zeile (`null` = die Einheit selbst)
 * @param {Object} option die gesammelte Options-Definition der Zeile
 * @param {Object|null} optionRef `{ defId, targetDefId }` des Slots der Zeile
 * @returns {string|null}
 */
export const resolveRowSelectionId = (rootSelection, ownerSelectionId, option, optionRef) => {
  const owner = ownerSelectionId ? findSelectionById(rootSelection, ownerSelectionId) : rootSelection;
  if (!owner) return null;
  const optionKey = option?.id;
  const targetKey = optionRef?.targetDefId || optionRef?.defId;
  const match = (owner.selections || []).find(sel => {
    const key = sel.entryLinkId || sel.selectionEntryId;
    return key === optionKey || key === targetKey || key === optionRef?.defId;
  });
  return match?.id ?? null;
};

/**
 * Wie oft eine Options-Definition im Teilbaum einer Selektion gewählt ist.
 * @param {Object} unitSelection
 * @param {string} optionEntryId
 * @returns {number}
 */
export const subSelectionCountOf = (unitSelection, optionEntryId) =>
  countOptionInstances(unitSelection, optionEntryId);

/** Die Buchquelle eines Info-Eintrags als Anhang eines Beschreibungstextes. */
const sourceSuffixOf = (source) => {
  if (!source) return '';
  const parts = [source.publicationName, source.page != null ? `${source.page}` : null].filter(Boolean);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

/**
 * Der Beschreibungstext einer Options-Zeile — **allein aus der Info-Projektion
 * ihres Slots** (`capability.infoElements`, ADR-0034).
 *
 * Der frühere namensbasierte Regel-Lookup (der Name der Option gegen die
 * geteilten Regeln des Systems und aller Kataloge) ist ersatzlos entfallen: er
 * verwechselte zwei gleichnamige Regeln aus verschiedenen Katalogen, weil er den
 * ersten Treffer nahm. Der Bericht verankert die Regel dagegen am Slot und weiß
 * damit, welche gemeint ist.
 * @param {Object|null|undefined} capability
 * @returns {string}
 */
export const optionDescriptionOf = (capability) => {
  const descriptions = [];
  for (const element of capability?.infoElements ?? []) {
    if (element.kind === 'rule') {
      if (element.text) descriptions.push(`${element.text}${sourceSuffixOf(element.source)}`);
      continue;
    }
    if (element.kind !== 'profile') continue;
    const typeLower = element.profileTypeName?.toLowerCase() || '';
    if (!UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) continue;
    const stats = (element.characteristics ?? [])
      .filter(c => c.value)
      .map(c => `${c.name}: ${c.value}`)
      .join(', ');
    descriptions.push(`${element.name} (${stats})${sourceSuffixOf(element.source)}`);
  }
  return descriptions.join(' | ');
};
