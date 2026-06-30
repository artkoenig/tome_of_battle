// Model profile type matching
export const MODEL_PROFILE_INCLUDED_KEYWORDS = [
  'profile', 'profil', 'unit', 'einheit', 'creature', 'kreatur',
  'monster', 'charakteristik', 'charakterwerte', 'mount', 'reittier'
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

// Saves calculation keywords
export const SAVE_SHIELD_KEYWORDS = ['shield', 'schild'];

export const SAVE_FULL_PLATE_KEYWORDS = [
  'full plate', 'plattenrüstung', 'gromril', 'chaos armour', 'chaos-rüstung'
];

export const SAVE_HEAVY_ARMOUR_KEYWORDS = ['heavy armour', 'schwere rüstung'];

export const SAVE_LIGHT_ARMOUR_KEYWORDS = ['light armour', 'leichte rüstung'];

export const SAVE_MOUNTS_KEYWORDS = [
  'horse', 'steed', 'ross', 'pony', 'pegasus', 'cold one', 'wolf', 'boar',
  'mount', 'reittier', 'streitross', 'schlachtross', 'nightmare', 'nachtmahr',
  'kampfechse', 'einhorn', 'unicorn', 'hirsch', 'stag', 'wildschwein',
  'chaosross', 'skelettpferd', 'skelettroß'
];

export const SAVE_MOUNTS_EXCLUDED_KEYWORDS = [
  'hippogryph', 'griffon', 'dragon', 'drache', 'manticore', 'wyvern'
];

export const SAVE_BARDING_KEYWORDS = [
  'barded', 'barding', 'harnisch', 'rosharnisch', 'gepanzert', 'gepanzertes'
];

export const SAVE_CAVALRY_KEYWORDS = ['cavalry', 'kavallerie'];

// Ward save and Blessing rules keywords
export const WARD_SAVE_KEYWORDS = ['ward save', 'rettungswurf', 'rettung', 'ws'];

export const ARMOUR_SAVE_EXPLICIT_KEYWORDS = [
  'armour save', 'rüstungswurf', 'rüster', 'as'
];

export const SCALY_SKIN_KEYWORDS = [
  'scaly skin', 'schuppenhaut'
];

export const BLESSING_KEYWORDS = [
  'blessing of the lady', 'segen der herrin', 'grail vow', 'gralsgelübde', 'segen'
];

// Upgrade details check keywords
export const UPGRADE_DETAILS_KEYWORDS = ['weapon', 'magic', 'items', 'rüstung', 'waffe'];

// Commander/General matching keywords
export const GENERAL_EXACT_KEYWORDS = [
  'general', 'armeegeneral', 'army general', 'general der armee'
];

export const GENERAL_SUBSTRING_KEYWORDS = ['warlord'];

export const GENERAL_IDS = ['1b7c-2c90-6d96-28c9'];

// Profile types for model count calculations
export const MODEL_COUNT_PROFILE_TYPES = [
  'unit', 'model', 'monster', 'creature', 'war machine', 'character', 'rider', 'mount'
];

// WFB6-spezifische Kategorie-IDs für Heroes/Characters-Fallback-Logik
// Hintergrund: Im WFB6-System teilen sich Heroes und Characters eine Maximal-Beschränkung,
// die nur auf der Characters-Kategorie definiert ist. Dieser Fallback propagiert den Constraint.
export const WFB6_HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';
export const WFB6_CHARACTERS_CATEGORY_ID = '7a1c-d611-c2dc-def1';

