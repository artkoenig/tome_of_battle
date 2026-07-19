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
  SAVE_MOUNTS_THICK_SKINNED_KEYWORDS,
  SAVE_BARDING_KEYWORDS,
  SAVE_CAVALRY_KEYWORDS,
  WARD_SAVE_KEYWORDS,
  ARMOUR_SAVE_EXPLICIT_KEYWORDS,
  SCALY_SKIN_KEYWORDS,
  BLESSING_KEYWORDS
} from './constants.js';
import i18n from '../i18n';

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
export function getArmourSave(profiles, selectionName, catalogueName, returnDetails = false) {
  const isChariot = selectionName?.toLowerCase().includes('chariot') || selectionName?.toLowerCase().includes('streitwagen');
  let hasShield = false;
  let armourValue = 7; // 7 means no armour
  let isMounted = false;
  let isThickSkinnedMount = false;
  let isBarded = false;
  let explicitSave = null;
  let scalySkinMod = 0;
  let genericArmourMod = 0;
  const breakdown = [];

  const extractSaveValue = (matchStr) => {
    const val = parseInt(matchStr.replace('+', '').trim());
    return val >= 1 && val <= 6 ? val : null;
  };

  const scanText = (text) => {
    if (!text) return;
    const t = text.toLowerCase();

    // Explicit Armour Save
    const asPattern = ARMOUR_SAVE_EXPLICIT_KEYWORDS.join('|');
    const asRe1 = new RegExp(`((?:\\+\\d)|(?:\\d\\+))\\s*(?:${asPattern})\\b`);
    const asM1 = t.match(asRe1);
    if (asM1) {
      const val = extractSaveValue(asM1[1]);
      if (val && (!explicitSave || val < explicitSave)) {
        explicitSave = val;
        if (text && !breakdown.includes(i18n.t('armourSave.explicit', { value: val }))) breakdown.push(i18n.t('armourSave.explicit', { value: val }));
      }
    }
    const asRe2 = new RegExp(`\\b(?:${asPattern})\\s*(?:of|von)?\\s*\\(?((?:\\+\\d)|(?:\\d\\+))\\)?`);
    const asM2 = t.match(asRe2);
    if (asM2) {
      const val = extractSaveValue(asM2[1]);
      if (val && (!explicitSave || val < explicitSave)) {
        explicitSave = val;
        if (text && !breakdown.includes(i18n.t('armourSave.explicit', { value: val }))) breakdown.push(i18n.t('armourSave.explicit', { value: val }));
      }
    }

    // Scaly Skin
    const ssPattern = SCALY_SKIN_KEYWORDS.join('|');
    const ssRe1 = new RegExp(`((?:\\+\\d)|(?:\\d\\+))\\s*(?:${ssPattern})\\b`);
    const ssM1 = t.match(ssRe1);
    if (ssM1) {
      const val = extractSaveValue(ssM1[1]);
      if (val && (7 - val) > scalySkinMod) {
        scalySkinMod = 7 - val;
        if (text && !breakdown.includes(i18n.t('armourSave.scalySkin', { value: val }))) breakdown.push(i18n.t('armourSave.scalySkin', { value: val }));
      }
    }
    const ssRe2 = new RegExp(`\\b(?:${ssPattern})\\s*(?:of|von)?\\s*\\(?((?:\\+\\d)|(?:\\d\\+))\\)?`);
    const ssM2 = t.match(ssRe2);
    if (ssM2) {
      const val = extractSaveValue(ssM2[1]);
      if (val && (7 - val) > scalySkinMod) {
        scalySkinMod = 7 - val;
        if (text && !breakdown.includes(i18n.t('armourSave.scalySkin', { value: val }))) breakdown.push(i18n.t('armourSave.scalySkin', { value: val }));
      }
    }

    // Shields
    if (SAVE_SHIELD_KEYWORDS.some(k => t.includes(k))) {
      if (!hasShield) breakdown.push(i18n.t('armourSave.shield'));
      hasShield = true;
    }

    // Armours
    if (SAVE_FULL_PLATE_KEYWORDS.some(k => t.includes(k))) {
      if (armourValue > 4) { armourValue = 4; breakdown.push(i18n.t('armourSave.fullPlate')); }
    } else if (SAVE_HEAVY_ARMOUR_KEYWORDS.some(k => t.includes(k))) {
      if (armourValue > 5) { armourValue = 5; breakdown.push(i18n.t('armourSave.heavyArmour')); }
    } else if (SAVE_LIGHT_ARMOUR_KEYWORDS.some(k => t.includes(k))) {
      if (armourValue > 6) { armourValue = 6; breakdown.push(i18n.t('armourSave.lightArmour')); }
    }

    // Mounts
    if (!isChariot && SAVE_MOUNTS_KEYWORDS.some(k => t.includes(k))) {
      if (!SAVE_MOUNTS_EXCLUDED_KEYWORDS.some(k => t.includes(k))) {
        if (!isMounted) {
          if (SAVE_MOUNTS_THICK_SKINNED_KEYWORDS.some(k => t.includes(k))) {
            breakdown.push(i18n.t('armourSave.mountedThickSkinned'));
            isThickSkinnedMount = true;
          } else {
            breakdown.push(i18n.t('armourSave.mounted'));
          }
          isMounted = true;
        }
      }
    }

    // Barding
    if (SAVE_BARDING_KEYWORDS.some(k => t.includes(k))) {
      if (!isBarded) breakdown.push(i18n.t('armourSave.barding'));
      isBarded = true;
    }
  };

  scanText(selectionName);
  scanText(catalogueName);

  if (Array.isArray(profiles)) {
    profiles.forEach(item => {
      if (!item) return;
      scanText(item.name);
      
      if (item.description && !item.isRule) {
        scanText(item.description);
      }

      if (item.characteristics) {
        item.characteristics.forEach(c => {
          const cName = c.name.toLowerCase();
          const cVal = c.value.toLowerCase();
          
          if (cName === 'saving throw modifier' || cName === 'as' || cName === 'armour save') {
            const baseMatch = cVal.match(/(^|\s)(\d)\+/);
            if (baseMatch) {
              const val = parseInt(baseMatch[2]);
              if (val >= 1 && val <= 6) {
                if (explicitSave === null || val < explicitSave) {
                  explicitSave = val;
                  if (!breakdown.includes(i18n.t('armourSave.explicitNamed', { value: val, itemName: item.name }))) breakdown.push(i18n.t('armourSave.explicitNamed', { value: val, itemName: item.name }));
                }
              }
            } else {
              const modMatch = cVal.match(/([+-]\d)/);
              if (modMatch) {
                let mod = Math.abs(parseInt(modMatch[1]));
                let skipModAmount = 0;
                const itemName = item.name.toLowerCase();
                if (SAVE_SHIELD_KEYWORDS.some(k => itemName.includes(k))) skipModAmount += 1;
                if (SAVE_BARDING_KEYWORDS.some(k => itemName.includes(k))) skipModAmount += 1;
                
                if (mod > skipModAmount) {
                  const netMod = mod - skipModAmount;
                  genericArmourMod += netMod;
                  if (!breakdown.includes(i18n.t('armourSave.modifier', { modifier: modMatch[1], itemName: item.name }))) breakdown.push(i18n.t('armourSave.modifier', { modifier: modMatch[1], itemName: item.name }));
                }
              }
            }
          }

          scanText(c.name + ' ' + c.value);
        });
      }

      if (item.profileTypeName) {
        if (SAVE_CAVALRY_KEYWORDS.some(k => item.profileTypeName?.toLowerCase().includes(k))) {
          if (!isMounted && !isChariot) {
            breakdown.push(i18n.t('armourSave.cavalry'));
            isMounted = true;
          }
        }
      }
    });
  }

  // If we have barding, the model must be mounted!
  if (isBarded && !isMounted && !isChariot) {
    breakdown.push(i18n.t('armourSave.mountedImpliedByBarding'));
    isMounted = true;
  }

  let save = 7;
  
  if (explicitSave !== null) {
    save = explicitSave;
  } else if (armourValue < 7) {
    save = armourValue;
  }

  if (isMounted) {
    let mountBonus = isThickSkinnedMount ? 2 : 1;
    if (save === 7) {
      save = 7 - mountBonus;
    } else {
      save = save - mountBonus;
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

  if (scalySkinMod > 0) {
    if (save === 7) {
      save = 7 - scalySkinMod;
    } else {
      save = save - scalySkinMod;
    }
  }

  if (genericArmourMod > 0) {
    if (save === 7) {
      save = 7 - genericArmourMod;
    } else {
      save = save - genericArmourMod;
    }
  }

  if (returnDetails) {
    // Filter duplicates and clarify
    const uniqueBreakdown = [...new Set(breakdown)];
    return { save, breakdown: uniqueBreakdown };
  }

  return save;
}

/**
 * Calculates the ward save for a unit selection in WFB 6th.
 * returns number (e.g. 5 for 5+ save, null for no save)
 */
export function getWardSave(profiles, selectionName, catalogueName, returnDetails = false) {
  let bestWard = null;
  const breakdown = [];

  const scanTextForWardSave = (text) => {
    if (!text) return;
    const t = text.toLowerCase();

    const extractSaveValue = (matchStr) => {
      const val = parseInt(matchStr.replace('+', '').trim());
      return val >= 1 && val <= 6 ? val : null;
    };

    // Full keywords (ward save, rettungswurf, rettung) can match with leading or trailing plus
    const fullKeywords = ['ward save', 'rettungswurf', 'rettung'];
    const fullPattern = fullKeywords.join('|');

    // Look for patterns like "5+ ward save" or "+5 ward save"
    const m1_full = t.match(new RegExp(`((?:\\+\\d)|(?:\\d\\+))\\s*(?:${fullPattern})\\b`));
    if (m1_full) {
      const val = extractSaveValue(m1_full[1]);
      if (val && (!bestWard || val < bestWard)) {
        bestWard = val;
        if (text && !breakdown.includes(i18n.t('armourSave.wardSave', { value: val }))) breakdown.push(i18n.t('armourSave.wardSave', { value: val }));
      }
    }

    // Look for patterns like "ward save of 5+" or "ward save of +5"
    const m2_full = t.match(new RegExp(`\\b(?:${fullPattern})\\s*(?:of|von)?\\s*\\(?((?:\\+\\d)|(?:\\d\\+))\\)?`));
    if (m2_full) {
      const val = extractSaveValue(m2_full[1]);
      if (val && (!bestWard || val < bestWard)) {
        bestWard = val;
        if (text && !breakdown.includes(i18n.t('armourSave.wardSave', { value: val }))) breakdown.push(i18n.t('armourSave.wardSave', { value: val }));
      }
    }

    // Abbreviated keyword "ws" (Ward Save) must only match trailing plus (e.g. "5+ WS")
    // to prevent collision with weapon skill modifiers like "+1 WS"
    const m1_abbr = t.match(/(\d\+)\s*ws\b/);
    if (m1_abbr) {
      const val = extractSaveValue(m1_abbr[1]);
      if (val && (!bestWard || val < bestWard)) {
        bestWard = val;
        if (text && !breakdown.includes(i18n.t('armourSave.wardSave', { value: val }))) breakdown.push(i18n.t('armourSave.wardSave', { value: val }));
      }
    }

    const m2_abbr = t.match(/\bws\s*(?:of|von)?\s*\(?(\d\+)\)?/);
    if (m2_abbr) {
      const val = extractSaveValue(m2_abbr[1]);
      if (val && (!bestWard || val < bestWard)) {
        bestWard = val;
        if (text && !breakdown.includes(i18n.t('armourSave.wardSave', { value: val }))) breakdown.push(i18n.t('armourSave.wardSave', { value: val }));
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

  if (returnDetails) {
    const uniqueBreakdown = [...new Set(breakdown)];
    return { save: bestWard, breakdown: uniqueBreakdown };
  }

  return bestWard;
}
