import RULES_INDEX from './rules-index.json';
import { SYNONYMS } from './synonyms.js';

const index = new Map();
const BASE_URL = 'https://6th.whfb.app';

for (const [name, path] of Object.entries(RULES_INDEX)) {
  index.set(name.toLowerCase(), path);
}

export function getRuleUrl(name) {
  if (!name) return null;
  const canonical = SYNONYMS[name] || name;
  const path = index.get(canonical.toLowerCase());
  return path ? `${BASE_URL}${path}` : null;
}
