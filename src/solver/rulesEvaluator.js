import {
  MODEL_PROFILE_INCLUDED_KEYWORDS,
  MODEL_PROFILE_EXCLUDED_KEYWORDS,
  UPGRADE_CLASSIFICATION_KEYWORDS
} from './constants.js';

/**
 * Filters a list of profiles to include only unit models/creatures.
 */
export function extractModelProfiles(profiles) {
  if (!Array.isArray(profiles)) return [];
  return profiles.filter(p => {
    const typeLower = p.profileTypeName?.toLowerCase() || '';
    return MODEL_PROFILE_INCLUDED_KEYWORDS.some(t => typeLower.includes(t)) && 
           !MODEL_PROFILE_EXCLUDED_KEYWORDS.some(t => typeLower.includes(t));
  });
}

/**
 * Filters a list of profiles to include only upgrades/magic items/weapons.
 */
export function extractUpgradeProfiles(profiles) {
  if (!Array.isArray(profiles)) return [];
  return profiles.filter(p => {
    const typeLower = p.profileTypeName?.toLowerCase() || '';
    return UPGRADE_CLASSIFICATION_KEYWORDS.some(t => typeLower.includes(t));
  });
}

/**
 * Filters a list of profiles to include only weapons.
 */
export function extractWeaponProfiles(profiles) {
  if (!Array.isArray(profiles)) return [];
  return profiles.filter(p => {
    const typeLower = p.profileTypeName?.toLowerCase() || '';
    return typeLower.includes('weapon') || typeLower.includes('waffe');
  });
}

/**
 * Filters a list of profiles to include only armours.
 */
export function extractArmourProfiles(profiles) {
  if (!Array.isArray(profiles)) return [];
  return profiles.filter(p => {
    const typeLower = p.profileTypeName?.toLowerCase() || '';
    return typeLower.includes('armour') || typeLower.includes('rüstung');
  });
}

/**
 * Groups profiles generically by their profileTypeName for tabular display.
 * The unit/model stat block (see extractModelProfiles) is aggregated into a
 * single group returned first; every remaining profile type becomes its own
 * group in collection order. This is data-driven — no hardcoded weapon/armour/
 * magic-item handling — so any profile type shows up as its own table.
 * @returns {{ typeName: string, profiles: object[], isModel: boolean }[]}
 */
export function groupProfilesByType(profiles) {
  if (!Array.isArray(profiles)) return [];

  const modelProfiles = extractModelProfiles(profiles);
  const modelSet = new Set(modelProfiles);

  const groups = [];
  if (modelProfiles.length > 0) {
    groups.push({ typeName: modelProfiles[0].profileTypeName || '', profiles: modelProfiles, isModel: true });
  }

  const groupsByType = new Map();
  profiles.forEach(p => {
    if (modelSet.has(p)) return;
    const key = p.profileTypeName || '';
    let group = groupsByType.get(key);
    if (!group) {
      group = { typeName: key, profiles: [], isModel: false };
      groupsByType.set(key, group);
      groups.push(group);
    }
    group.profiles.push(p);
  });

  return groups;
}
