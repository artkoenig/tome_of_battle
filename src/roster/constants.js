// Model profile type matching
export const MODEL_PROFILE_INCLUDED_KEYWORDS = [
  'profile', 'profil', 'unit', 'einheit', 'creature', 'kreatur',
  'monster', 'charakteristik', 'charakterwerte', 'mount', 'reittier', 'model'
];

export const MODEL_PROFILE_EXCLUDED_KEYWORDS = [
  'magic item', 'equipment', 'ausrüstung', 'magic weapon', 'armour', 'rüstung',
  'weapon', 'waffe', 'virtue', 'talisman', 'item', 'special rule', 'banner',
  'standarte', 'runes', 'runen'
];

// Upgrade classification keywords
export const UPGRADE_CLASSIFICATION_KEYWORDS = [
  'magic item', 'weapon', 'armour', 'enchanted item', 'arcane item', 'talisman',
  'magic weapon', 'magic armour', 'virtue', 'runes', 'special rule', 'gegenstand',
  'virtues', 'tugend'
];

// Upgrade details check keywords
export const UPGRADE_DETAILS_KEYWORDS = ['weapon', 'magic', 'items', 'rüstung', 'waffe'];

// Profile types for model count calculations
export const MODEL_COUNT_PROFILE_TYPES = [
  'unit', 'model', 'monster', 'creature', 'war machine', 'character', 'rider', 'mount'
];

// Systemspezifische IDs (General-Einträge, Kategorie-Vererbung etc.) lagen als
// Daten in systemQuirks.js. Die Datei ist mit Issue 0121 entfallen: ADR-0034
// ordnet systemgebundene Sonderfälle und Stichwort-Heuristiken weder der Engine
// noch dem Bericht zu — sie werden am Datenfehler im Katalog-Fork behoben.

