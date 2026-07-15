import RULES_INDEX from './rules-index.json';
import { SYNONYMS } from './synonyms.js';

const BASE_URL = 'https://6th.whfb.app';

// A suffix the crawled site appends to disambiguate names that collide across
// army books, e.g. "Power Familiar (Hordes of Chaos)" vs.
// "Power Familiar (Vampire Counts)". Catalog names never carry this suffix.
const FACTION_SUFFIX_PATTERN = /^(.*) \([^)]+\)$/;

// Case-insensitive and resilient to typographic differences between catalog
// names and crawled page titles: missing accents (e.g. "Chalons" vs.
// "Châlons"), straight vs. curly apostrophes, and any other whitespace or
// punctuation difference (e.g. "Bull gut" vs. "Bullgut", "Waaagh" vs.
// "Waaagh!") by comparing only the letters and digits.
function normalizeName(name) {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const index = new Map();
// Faction-suffixed entries grouped by their unsuffixed base name, so a bare
// catalog name can still resolve when exactly one faction variant exists. A
// genuine collision (multiple factions sharing a name) is left unresolved
// rather than guessed.
const suffixGroups = new Map();

for (const [name, path] of Object.entries(RULES_INDEX)) {
  index.set(normalizeName(name), path);

  const match = name.match(FACTION_SUFFIX_PATTERN);
  if (match) {
    const baseKey = normalizeName(match[1]);
    if (!suffixGroups.has(baseKey)) {
      suffixGroups.set(baseKey, []);
    }
    suffixGroups.get(baseKey).push(path);
  }
}

export function getRuleUrl(name) {
  if (!name) return null;
  const canonical = SYNONYMS[name] || name;
  const key = normalizeName(canonical);

  const directPath = index.get(key);
  if (directPath) return `${BASE_URL}${directPath}`;

  const suffixPaths = suffixGroups.get(key);
  if (suffixPaths && suffixPaths.length === 1) {
    return `${BASE_URL}${suffixPaths[0]}`;
  }

  return null;
}
