import React from 'react';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';

// Shared renderer for the rich detail block of an upgrade/rule/magic item,
// used by the editor chips, the SelectionConfigurator and the OptionGroup.
// Kept in one place so all catalogue-derived detail views stay identical.
// The `t` translator is injected by the calling component (which owns the
// react-i18next hook) so this plain render helper stays framework-agnostic
// while its chrome labels remain translatable (ADR-0022).
export const renderUpgradeDetails = (res, system, t) => {
  if (!res) return null;
  const elements = [];

  const isNameSimilar = (nameA, nameB) => {
    if (!nameA || !nameB) return false;
    const cleanA = nameA.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanB = nameB.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanA === cleanB ||
           cleanA.includes(cleanB) ||
           cleanB.includes(cleanA) ||
           (cleanA.includes('waaagh') && cleanB.includes('waaagh')) ||
           cleanA.slice(-10) === cleanB.slice(-10);
  };

  let rules = res.rules || [];
  if (rules.length === 0 && res.name) {
    const lowerName = res.name.toLowerCase().trim();
    let foundRule = system.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
    if (!foundRule) {
      for (const cat of system.catalogues || []) {
        foundRule = cat.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
        if (foundRule) break;
      }
    }
    if (foundRule) {
      rules = [foundRule];
    }
  }

  // 1. Beschreibung (Rules / Lore)
  if (rules.length > 0) {
    rules.forEach((r, idx) => {
      if (r.description) {
        const label = isNameSimilar(r.name, res.name)
          ? t('editor.details.description')
          : t('editor.details.descriptionNamed', { name: r.name });

        elements.push(
          <div key={`rule-${idx}`} style={{ marginTop: '4px' }}>
            <span className="text-gold" style={{ fontWeight: 600 }}>{label}: </span>
            {r.description}
            {r.publicationRef && (
              <span className="publication-ref">
                {r.publicationRef}
              </span>
            )}
          </div>
        );
      }
    });
  }

  // 2. Sonderregeln & Profilwerte (from Profiles)
  if (res.profiles && res.profiles.length > 0) {
    const profileElements = [];
    res.profiles.forEach((p, idx) => {
      const typeLower = p.profileTypeName?.toLowerCase() || '';
      if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
        // Find "Special Rules" or "Sonderregeln" characteristic
        const specialRulesChar = p.characteristics?.find(c => {
          const nameLower = (c.name || '').toLowerCase().trim();
          return nameLower === 'special rules' || nameLower === 'special-rules' || nameLower === 'sonderregeln';
        });

        const otherChars = p.characteristics?.filter(c => {
          const nameLower = (c.name || '').toLowerCase().trim();
          return nameLower !== 'special rules' && nameLower !== 'special-rules' && nameLower !== 'sonderregeln';
        }) || [];

        // If there is special rules text, show it under "Sonderregeln:" label
        if (specialRulesChar && specialRulesChar.value && specialRulesChar.value.trim()) {
          profileElements.push(
            <div key={`special-rules-${idx}`} style={{ marginTop: '4px' }}>
              <span className="text-gold" style={{ fontWeight: 600 }}>{t('editor.details.specialRules')}: </span>
              {specialRulesChar.value.trim()}
              {p.publicationRef && !res.rules?.some(r => r.publicationRef === p.publicationRef) && (
                <span className="publication-ref">
                  {p.publicationRef}
                </span>
              )}
            </div>
          );
        }

        // If there are other non-empty characteristics, show them under "Profil:" label
        const nonBigEmptyChars = otherChars.filter(c => c.value && c.value.trim() && c.value.trim() !== '-');
        if (nonBigEmptyChars.length > 0) {
          const stats = nonBigEmptyChars.map(c => `${c.name}: ${c.value}`).join(', ');
          const label = isNameSimilar(p.name, res.name)
            ? t('editor.details.profile')
            : t('editor.details.profileNamed', { name: p.name });

          profileElements.push(
            <div key={`profile-${idx}`} style={{ marginTop: '4px' }}>
              <span className="text-gold" style={{ fontWeight: 600 }}>{label}: </span>
              {stats}
              {p.publicationRef && !res.rules?.some(r => r.publicationRef === p.publicationRef) && (
                <span className="publication-ref">
                  {p.publicationRef}
                </span>
              )}
            </div>
          );
        }
      }
    });
    elements.push(...profileElements);
  }

  // 3. Quelle
  if (res.publicationRef) {
    const hasRuleOrProfileRefs = (res.rules && res.rules.some(r => r.publicationRef)) || (res.profiles && res.profiles.some(p => p.publicationRef));
    if (!hasRuleOrProfileRefs) {
      elements.push(
        <div key="source" style={{ marginTop: '6px' }}>
          <span className="text-gold" style={{ fontWeight: 600 }}>{t('editor.details.source')}: </span>
          <span className="publication-ref">
            {res.publicationRef}
          </span>
        </div>
      );
    }
  }

  return (
    <div style={{ textAlign: 'left', lineHeight: '1.4' }}>
      {elements.length > 0 ? elements : <span className="text-dim">{t('editor.details.none')}</span>}
    </div>
  );
};
