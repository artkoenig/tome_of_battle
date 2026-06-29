import {
  MODEL_PROFILE_INCLUDED_KEYWORDS,
  MODEL_PROFILE_EXCLUDED_KEYWORDS,
  UPGRADE_CLASSIFICATION_KEYWORDS,
  SAVE_SHIELD_KEYWORDS,
  SAVE_FULL_PLATE_KEYWORDS,
  SAVE_HEAVY_ARMOUR_KEYWORDS,
  SAVE_LIGHT_ARMOUR_KEYWORDS,
  SAVE_MOUNTS_KEYWORDS,
  SAVE_MOUNTS_EXCLUDED_KEYWORDS,
  SAVE_BARDING_KEYWORDS,
  SAVE_CAVALRY_KEYWORDS,
  WARD_SAVE_KEYWORDS,
  BLESSING_KEYWORDS
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
 * Helper to check if blessing is present in the profiles, rules or names.
 */
export function hasBlessing(profiles, selectionName, catalogueName) {
  let foundBlessing = false;
  const scanText = (text) => {
    if (!text) return;
    const t = text.toLowerCase();
    if (BLESSING_KEYWORDS.some(k => t.includes(k))) {
      foundBlessing = true;
    }
  };

  scanText(selectionName);
  scanText(catalogueName);

  if (Array.isArray(profiles)) {
    profiles.forEach(item => {
      if (!item) return;
      scanText(item.name);
      if (item.description) {
        scanText(item.description);
      }
      if (item.characteristics) {
        item.characteristics.forEach(c => {
          scanText(c.name + ' ' + c.value);
        });
      }
    });
  }

  return foundBlessing;
}

/**
 * Calculates the combined armour save for a unit selection in WFB 6th.
 * returns number (e.g. 4 for 4+ save, 7 for no save)
 */
export function getArmourSave(profiles, selectionName, catalogueName) {
  let hasShield = false;
  let armourValue = 7; // 7 means no armour
  let isMounted = false;
  let isBarded = false;

  const scanText = (text) => {
    if (!text) return;
    const t = text.toLowerCase();

    // Shields
    if (SAVE_SHIELD_KEYWORDS.some(k => t.includes(k))) {
      hasShield = true;
    }

    // Armours
    if (SAVE_FULL_PLATE_KEYWORDS.some(k => t.includes(k))) {
      armourValue = Math.min(armourValue, 4);
    } else if (SAVE_HEAVY_ARMOUR_KEYWORDS.some(k => t.includes(k))) {
      armourValue = Math.min(armourValue, 5);
    } else if (SAVE_LIGHT_ARMOUR_KEYWORDS.some(k => t.includes(k))) {
      armourValue = Math.min(armourValue, 6);
    }

    // Mounts
    if (SAVE_MOUNTS_KEYWORDS.some(k => t.includes(k))) {
      if (!SAVE_MOUNTS_EXCLUDED_KEYWORDS.some(k => t.includes(k))) {
        isMounted = true;
      }
    }

    // Barding
    if (SAVE_BARDING_KEYWORDS.some(k => t.includes(k))) {
      isBarded = true;
    }
  };

  scanText(selectionName);
  scanText(catalogueName);

  if (Array.isArray(profiles)) {
    profiles.forEach(item => {
      if (!item) return;
      scanText(item.name);
      
      if (item.description) {
        scanText(item.description);
      }

      if (item.characteristics) {
        item.characteristics.forEach(c => {
          scanText(c.name + ' ' + c.value);
        });
      }

      if (item.profileTypeName) {
        if (SAVE_CAVALRY_KEYWORDS.some(k => item.profileTypeName?.toLowerCase().includes(k))) {
          isMounted = true;
        }
      }
    });
  }

  // If we have barding, the model must be mounted!
  if (isBarded) {
    isMounted = true;
  }

  let save = 7;
  if (armourValue < 7) {
    save = armourValue;
  }

  if (isMounted) {
    if (save === 7) {
      save = 6;
    } else {
      save = save - 1;
    }
  }

  if (hasShield) {
    if (save === 7) {
      save = 6;
    } else {
      save = save - 1;
    }
  }

  if (isBarded && save < 7) {
    save = save - 1;
  }

  return save;
}

/**
 * Calculates the ward save for a unit selection in WFB 6th.
 * returns number (e.g. 5 for 5+ save, null for no save)
 */
export function getWardSave(profiles, selectionName, catalogueName) {
  let bestWard = null;

  const scanTextForWardSave = (text) => {
    if (!text) return;
    const t = text.toLowerCase();

    const wardPattern = WARD_SAVE_KEYWORDS.join('|');
    // Look for patterns like "5+ ward save", "5+ rettungswurf"
    const m1 = t.match(new RegExp(`(\\d)\\+\\s*(?:${wardPattern})`));
    if (m1) {
      const val = parseInt(m1[1]);
      if (val >= 1 && val <= 6) {
        bestWard = bestWard ? Math.min(bestWard, val) : val;
      }
    }

    // Look for patterns like "ward save of 5+", "rettungswurf von 5+"
    const m2 = t.match(new RegExp(`(?:${wardPattern})\\s*(?:of|von)?\\s*(\\d)\\+`));
    if (m2) {
      const val = parseInt(m2[1]);
      if (val >= 1 && val <= 6) {
        bestWard = bestWard ? Math.min(bestWard, val) : val;
      }
    }
  };

  scanTextForWardSave(selectionName);
  scanTextForWardSave(catalogueName);

  if (Array.isArray(profiles)) {
    profiles.forEach(item => {
      if (!item) return;
      scanTextForWardSave(item.name);
      
      if (item.description) {
        scanTextForWardSave(item.description);
      }

      if (item.characteristics) {
        item.characteristics.forEach(c => {
          scanTextForWardSave(c.name + ' ' + c.value);
        });
      }
    });
  }

  return bestWard;
}
