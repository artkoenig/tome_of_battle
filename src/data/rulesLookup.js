import RULES_INDEX from './rules-index.json';
import { SYNONYMS } from './synonyms.js';

const index = new Map();
const synonymIndex = new Map();
const BASE_URL = 'https://6th.whfb.app';

for (const [name, path] of Object.entries(RULES_INDEX)) {
  index.set(name.toLowerCase(), path);
}

// Synonyms are matched case-insensitively too, so a BSData name that differs only
// in casing from a synonym key still resolves to its canonical rule.
for (const [from, to] of Object.entries(SYNONYMS)) {
  synonymIndex.set(from.toLowerCase(), to);
}

export function getRuleUrl(name) {
  if (!name) return null;
  const canonical = synonymIndex.get(name.toLowerCase()) || name;
  const path = index.get(canonical.toLowerCase());
  return path ? `${BASE_URL}${path}` : null;
}
