import { UPGRADE_DETAILS_KEYWORDS } from '../../../contexts/armylist/model';

/**
 * Der Detailblock einer Aufwertung als **fertige Elementliste** (ADR-0038):
 * Beschreibung, Sonderregeln, Profilwerte und Quelle, jeweils schon entschieden,
 * welche Beschriftung gilt und welche Buchquelle daran haengt. Die Komponente
 * (`components/editor/upgradeDetails.jsx`) rendert diese Liste und leitet nichts
 * mehr ab.
 *
 * Die Quelle ist die **Info-Projektion des Slots** (`capability.infoElements`,
 * ADR-0034) samt seiner eigenen Buchquelle (`capability.source`) — und sonst
 * nichts: hier wird keine Regel mehr ueber ihren Namen gesucht. Weder die
 * frueher hier haengende Namens*aehnlichkeit* noch der Rueckfall auf die
 * *gleichnamige* Regel des eigenen Katalogs stehen noch in der Oberflaeche. Den
 * Rueckfall traegt der Bericht (`infoProjection.js` der Engine,
 * Issue 0173), damit Detailblock und Chips ihn aus derselben Quelle bekommen.
 */

/** Die Beschriftungen einer Zeile des Detailblocks, als i18n-Schluessel. */
const LabelKey = Object.freeze({
  DESCRIPTION: 'editor.details.description',
  DESCRIPTION_NAMED: 'editor.details.descriptionNamed',
  SPECIAL_RULES: 'editor.details.specialRules',
  PROFILE: 'editor.details.profile',
  PROFILE_NAMED: 'editor.details.profileNamed',
  SOURCE: 'editor.details.source',
});

/** Die Merkmalsnamen, die als „Sonderregeln" gelten. */
const SPECIAL_RULES_NAMES = new Set(['special rules', 'special-rules', 'sonderregeln']);

const isSpecialRulesCharacteristic = (characteristic) =>
  SPECIAL_RULES_NAMES.has((characteristic.name || '').toLowerCase().trim());

/**
 * Ein Name auf seine Buchstaben und Ziffern heruntergebrochen — nur damit ein
 * Ausrufezeichen oder ein Bindestrich zwei gleiche Namen nicht trennt. Es ist
 * kein Aehnlichkeitsmass: verglichen wird auf Gleichheit.
 */
const normalizeName = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Die Buchquelle eines Eintrags in der Schreibweise, die die Oberflaeche seit je
 * zeigt: `[Buch, S. 44]`, `[Buch]` oder `[S. 44]`. `null`, wo keine steht.
 * @param {{ publicationName: string|null, page: string|null }|null|undefined} source
 * @returns {string|null}
 */
export const publicationRefOf = (source) => {
  if (!source) return null;
  const name = source.publicationName || '';
  const page = source.page ?? null;
  if (name && page) return `[${name}, S. ${page}]`;
  if (name) return `[${name}]`;
  if (page) return `[S. ${page}]`;
  return null;
};

/** Die Profil-Eintraege, die als Aufwertung gelten (Profilart per Schlagwort). */
const isUpgradeProfile = (element) => {
  const typeLower = element.profileTypeName?.toLowerCase() || '';
  return UPGRADE_DETAILS_KEYWORDS.some(keyword => typeLower.includes(keyword));
};

/**
 * Der Detailblock eines Slots als Liste von Zeilen.
 *
 * @param {Object|null|undefined} capability der Faehigkeitsdatensatz des Slots.
 * @returns {Array<{ key: string, kind: 'entry'|'source', labelKey: string,
 *   labelParams: Object|undefined, text: string|null, source: string|null }>|null}
 *   `null`, wo es gar keinen Slot gibt — dann gibt es auch keinen Block.
 */
export const upgradeDetailElementsOf = (capability) => {
  if (!capability) return null;
  const infoElements = capability.infoElements ?? [];
  const slotName = normalizeName(capability.name);
  /** @type {Array<{ key: string, kind: 'entry'|'source', labelKey: string,
   *   labelParams: Object|undefined, text: string|null, source: string|null }>} */
  const elements = [];
  const shownRefs = new Set();
  let hasElementSource = false;

  // 1. Beschreibung (Regeltexte)
  infoElements
    .filter(element => element.kind === 'rule')
    .forEach((rule, index) => {
      const ref = publicationRefOf(rule.source);
      if (ref) hasElementSource = true;
      if (!rule.text) return;
      const isOwnName = normalizeName(rule.name) === slotName;
      elements.push({
        key: `rule-${index}`,
        kind: 'entry',
        labelKey: isOwnName ? LabelKey.DESCRIPTION : LabelKey.DESCRIPTION_NAMED,
        labelParams: isOwnName ? undefined : { name: rule.name },
        text: rule.text,
        source: ref,
      });
      if (ref) shownRefs.add(ref);
    });

  // 2. Sonderregeln & Profilwerte
  infoElements
    .filter(element => element.kind === 'profile')
    .forEach((profile, index) => {
      const ref = publicationRefOf(profile.source);
      if (ref) hasElementSource = true;
      if (!isUpgradeProfile(profile)) return;
      // Eine Quelle, die schon an einem Regeltext steht, wird nicht wiederholt.
      const profileRef = ref && !shownRefs.has(ref) ? ref : null;
      const characteristics = profile.characteristics ?? [];

      const specialRules = characteristics.find(isSpecialRulesCharacteristic);
      if (specialRules?.value?.trim()) {
        elements.push({
          key: `special-rules-${index}`,
          kind: 'entry',
          labelKey: LabelKey.SPECIAL_RULES,
          labelParams: undefined,
          text: specialRules.value.trim(),
          source: profileRef,
        });
      }

      const stats = characteristics
        .filter(characteristic => !isSpecialRulesCharacteristic(characteristic))
        .filter(characteristic => characteristic.value && characteristic.value.trim() &&
          characteristic.value.trim() !== '-')
        .map(characteristic => `${characteristic.name}: ${characteristic.value}`);
      if (stats.length > 0) {
        const isOwnName = normalizeName(profile.name) === slotName;
        elements.push({
          key: `profile-${index}`,
          kind: 'entry',
          labelKey: isOwnName ? LabelKey.PROFILE : LabelKey.PROFILE_NAMED,
          labelParams: isOwnName ? undefined : { name: profile.name },
          text: stats.join(', '),
          source: profileRef,
        });
      }
    });

  // 3. Quelle — nur wo kein Info-Element schon eine nennt.
  const ownRef = publicationRefOf(capability.source);
  if (ownRef && !hasElementSource) {
    elements.push({
      key: 'source',
      kind: 'source',
      labelKey: LabelKey.SOURCE,
      labelParams: undefined,
      text: null,
      source: ownRef,
    });
  }

  return elements;
};
