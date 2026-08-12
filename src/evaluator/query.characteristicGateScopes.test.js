/**
 * Issue 81, Increment 2 — jeder Bezugsrahmen (`scope`), den eine `condition` an
 * einem Merkmals-Modifikator (`instanceOf`/`atLeast`) tragen darf, wird gegen den
 * von ihm benannten Knoten ausgewertet statt still verworfen zu werden (Kriterien
 * 5, 6, 7 der Meldung).
 *
 * **Ableitung der geschlossenen Liste** (Kriterium 6) — nicht aus `query.js`,
 * sondern aus der Format-Dokumentation und der XSD:
 * - `Catalogue.xsd:426` typt `scope` als reinen `xs:string` — die XSD selbst
 *   zaehlt keine Werte auf.
 * - `docs/battlescribe-data-format.md` fuehrt die vollstaendige Aufzaehlung in
 *   der Tabellenzeile `constraint`/`condition`/`repeat` → `scope` (Zeile 1449):
 *   `parent`, `roster`, `force`, `category`, `self`, `unit`, `ancestor` (nur bei
 *   `condition`, §7.7), `primary-catalogue` (§7.6), `primary-category` (4× belegt,
 *   `Forces of Chaos`, upstream undokumentiert), `model-or-unit` (2× belegt,
 *   `Lizardmen`, upstream undokumentiert).
 * - Zusaetzlich dokumentiert §7.7 zwei weitere Formen, in denen `scope` selbst
 *   eine reale ID traegt statt eines Schluesselworts: die „selbst-gegatete" Form
 *   (eine `forceEntry`-Id direkt in `scope`) und, verallgemeinert auf beliebige
 *   Eintraege bzw. Kategorien, eine `selectionEntry`- oder `categoryEntry`-Id in
 *   `scope`. Jeder Wert, der keinem der obigen Schluesselwoerter entspricht und
 *   sich auch nicht als reale Id aufloesen laesst, bleibt fail-closed
 *   (`unresolvedScope`, Kriterium 4 in `query.unitScope.test.js`).
 *
 * Zwoelf Faelle decken die Liste vollstaendig ab: `roster`, `force`, `parent`,
 * `self`, `unit` (Kriterium 5), `model-or-unit` (neu), `ancestor`,
 * `primary-catalogue`, `primary-category` (neu), Eintrags-Id als `scope`,
 * Kategorie-Id als `scope`, und ein frei erfundenes Schluesselwort. Das
 * Schluesselwort `category` selbst ist NICHT durch einen eigenen Fall gedeckt:
 * kein Katalog dieses Repositories schreibt es, siehe `issue.md`, Kriterium 7.
 *
 * Beobachtungsstelle wie im gemeldeten Fall: der Merkmalswert eines gegatterten
 * Profil-Modifikators, gelesen ueber die Fassade (`infoElements` des belegten
 * Trägerknotens). Ein Katalog mit einer Einheit „Regiment" (Kategorien RARE
 * primaer, ELITE nicht-primaer), deren Modell „Trooper" die Kategorie SKIRMISHER
 * traegt, und zwei gegatterten Traegern — „Banner" (fuer alle Rahmen ausser
 * `model-or-unit`) und „Crest", unter Trooper haengend (fuer `model-or-unit`,
 * dessen Rahmen von der eines `unit`-Traegers abweichen muss). Jeder Fall
 * variiert nur die Bedingungs-XML durch eine Katalog-Fabrik
 * (`catalogueWithGate`, das `catalogueWith`-Muster aus `offer.hiddenGate.test.js`)
 * und liest den Merkmalswert wie `evaluator.bloodlineProfileFixture.test.js`.
 *
 * Absichtlich nicht getestet, mit Begruendung:
 * - Das Schluesselwort `category` selbst — kein Katalog dieses Repos schreibt es
 *   (`issue.md`, Kriterium 7).
 * - Die Phantom-/Angebots-Anker-Ausnahme fuer `model-or-unit` (keine Diagnose an
 *   einem synthetischen Anker ohne umschliessendes Modell/Einheit) — spiegelt eine
 *   bereits fuer `unit` entschiedene und gepinnte Regel (Issue 086); der Aufwand,
 *   einen Anker ohne umschliessende Einheit durch die Fassade zu konstruieren,
 *   uebersteigt den Wert der Rausch-Unterdrueckungsregel.
 * - Rundenuebergreifendes Durchsickern eines `set-primary` in ein
 *   `primary-category`-Gate — durch Pre-Order-Traversierung ausgeschlossen
 *   (Rahmen ist immer Selbst-oder-Vorfahre); ein Test dafuer koennte nicht
 *   fehlschlagen und pinnte nichts.
 * - Alles unter `docs/testing/` — Szenario-Autorenschaft gehoert dem
 *   `e2e-testcase-author` (ADR 0033).
 * - `src/roster/`-Altpfade und die drei Anzeigepfade, die das Issue explizit
 *   ausserhalb des Umfangs stellt.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, InfoElementKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-scopes';
const PROFILE_TYPE_ID = 'profiletype-fighter';
const WS_TYPE_ID = 'chartype-ws';

const CATALOGUE_ID = 'cat-scopes';
const FORCE_ID = 'force-scopes';
const REGIMENT_ID = 'entry-regiment';
const TROOPER_ID = 'entry-trooper';
const CREST_ID = 'entry-crest';
const BANNER_ID = 'entry-banner';
const CHARM_ID = 'entry-charm';
const RARE_ID = 'cat-rare';
const ELITE_ID = 'cat-elite';
const SKIRMISHER_ID = 'cat-skirmisher';
const UNUSED_CATEGORY_ID = 'cat-unused';
const PROFILE_ID = 'profile-p';
const BANNER_GATE_LINK_ID = 'infolink-banner-gate';
const CREST_GATE_LINK_ID = 'infolink-crest-gate';
const UNKNOWN_CATALOGUE_ID = 'cat-not-in-dataset';

const BASE_WS = '3';
const GATED_WS = '5';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Scopes Game System">
    <profileTypes>
      <profileType id="${PROFILE_TYPE_ID}" name="Fighter">
        <characteristicTypes>
          <characteristicType id="${WS_TYPE_ID}" name="WS"/>
        </characteristicTypes>
      </profileType>
    </profileTypes>
  </gameSystem>`;

/** Umklammert eine `condition`-XML in eine `conditions`-Liste. */
function conditions(conditionXml) {
  return `<conditions>${conditionXml}</conditions>`;
}

/**
 * Der Katalog, dessen Bedingungs-XML sich pro Fall aendert. `bannerCondition`
 * gattert den Traeger „Banner" (fuer alle Rahmen ausser `model-or-unit`),
 * `crestCondition` den Traeger „Crest" (unter Trooper, fuer `model-or-unit`).
 * `regimentPrimaryRare=false` laesst keine Kategorie am Regiment primaer sein —
 * die Fail-closed-Kante fuer `primary-category`.
 */
function catalogueWithGate({ bannerCondition = '', crestCondition = '', regimentPrimaryRare = true } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_ID}" name="Scopes Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
      <categoryEntries>
        <categoryEntry id="${RARE_ID}" name="Rare"/>
        <categoryEntry id="${ELITE_ID}" name="Elite"/>
        <categoryEntry id="${SKIRMISHER_ID}" name="Skirmisher"/>
        <categoryEntry id="${UNUSED_CATEGORY_ID}" name="Unused"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Force"/>
      </forceEntries>
      <sharedProfiles>
        <profile id="${PROFILE_ID}" name="P" typeId="${PROFILE_TYPE_ID}">
          <characteristics>
            <characteristic name="WS" typeId="${WS_TYPE_ID}">${BASE_WS}</characteristic>
          </characteristics>
        </profile>
      </sharedProfiles>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <categoryLinks>
            <categoryLink id="catlink-rare" targetId="${RARE_ID}" primary="${regimentPrimaryRare}"/>
            <categoryLink id="catlink-elite" targetId="${ELITE_ID}" primary="false"/>
          </categoryLinks>
          <selectionEntries>
            <selectionEntry id="${TROOPER_ID}" name="Trooper" type="model">
              <categoryLinks>
                <categoryLink id="catlink-skirmisher" targetId="${SKIRMISHER_ID}" primary="false"/>
              </categoryLinks>
              <selectionEntries>
                <selectionEntry id="${CREST_ID}" name="Crest" type="upgrade">
                  <infoLinks>
                    <infoLink id="${CREST_GATE_LINK_ID}" name="Crest Gate" type="profile" targetId="${PROFILE_ID}">
                      <modifiers>
                        <modifier type="increment" field="${WS_TYPE_ID}" value="2">${crestCondition}</modifier>
                      </modifiers>
                    </infoLink>
                  </infoLinks>
                </selectionEntry>
              </selectionEntries>
            </selectionEntry>
            <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade">
              <infoLinks>
                <infoLink id="${BANNER_GATE_LINK_ID}" name="Banner Gate" type="profile" targetId="${PROFILE_ID}">
                  <modifiers>
                    <modifier type="increment" field="${WS_TYPE_ID}" value="2">${bannerCondition}</modifier>
                  </modifiers>
                </infoLink>
              </infoLinks>
              <selectionEntries>
                <selectionEntry id="${CHARM_ID}" name="Charm" type="upgrade"/>
              </selectionEntries>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueXml] }), roster);
}

function node(defId, count, children = []) {
  return { defId, count, children };
}

/** Regiment[ Trooper(2)[Crest?], Banner(1)[Charm?] ] unter einem Kontingent. */
function rosterTree({ withCrest = false, withCharm = true } = {}) {
  const trooperChildren = withCrest ? [node(CREST_ID, 1)] : [];
  const bannerChildren = withCharm ? [node(CHARM_ID, 1)] : [];
  return {
    forces: [
      node(FORCE_ID, 1, [
        node(REGIMENT_ID, 1, [
          node(TROOPER_ID, 2, trooperChildren),
          node(BANNER_ID, 1, bannerChildren),
        ]),
      ]),
    ],
  };
}

/** Der volle Baum: Trooper traegt Crest, Banner traegt Charm. */
const ROSTER_FULL = rosterTree({ withCrest: true, withCharm: true });
/** Wie `ROSTER_FULL`, aber ohne Charm unter Banner. */
const ROSTER_NO_CHARM = rosterTree({ withCrest: true, withCharm: false });

/** Banner haengt direkt am Kontingent — keine umschliessende Einheit. */
const ROSTER_FREESTANDING_BANNER = {
  forces: [node(FORCE_ID, 1, [node(BANNER_ID, 1)])],
};
/** Crest haengt direkt am Kontingent — weder Modell noch Einheit darueber. */
const ROSTER_FREESTANDING_CREST = {
  forces: [node(FORCE_ID, 1, [node(CREST_ID, 1)])],
};

/** Der belegte Faehigkeitsdatensatz einer Definitions-ID (genau ein Vorkommen). */
function occupiedSlot(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) return capability;
  }
  return null;
}

/** Der effektive WS-Wert des gegatterten Profil-Vorkommens an einem Traeger. */
function wsOf(report, carrierDefId, linkId) {
  const capability = occupiedSlot(report, carrierDefId);
  expect(capability, `Traeger ${carrierDefId} hat keinen belegten Slot`).not.toBeNull();
  const entry = capability.infoElements.find(
    (element) => element.kind === InfoElementKind.PROFILE && element.id === linkId,
  );
  expect(entry, `infoElements von ${carrierDefId} traegt keinen Eintrag ${linkId}`).toBeDefined();
  const characteristic = entry.characteristics.find((c) => c.typeId === WS_TYPE_ID);
  expect(characteristic, `WS fehlt im Profil-Eintrag ${linkId}`).toBeDefined();
  return characteristic.value;
}

/** Die `unresolvedScope`-Diagnosen des Berichts zu einem Bezugsrahmen. */
function unresolvedScopeOf(report, scope) {
  return (report.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.kind === 'unresolvedScope' && diagnostic.scope === scope,
  );
}

describe('scope="roster": zaehlt armeeweit ueber alle Kontingente', () => {
  it('KONTROLLE: haelt WS bei "5", wenn der gesuchte Traeger irgendwo im Roster steht', () => {
    const hitCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="roster" childId="${TROOPER_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3", wenn der gesuchte Traeger fehlt', () => {
    const missCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="roster" childId="${CHARM_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_NO_CHARM);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });
});

describe('scope="force": zaehlt innerhalb des eigenen Kontingents', () => {
  it('KONTROLLE: haelt WS bei "5", wenn der gesuchte Traeger im eigenen Kontingent steht', () => {
    const hitCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="force" childId="${TROOPER_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3", wenn der gesuchte Traeger fehlt', () => {
    const missCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="force" childId="${CHARM_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_NO_CHARM);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });
});

describe('scope="parent": zaehlt die direkten Kinder des uebergeordneten Knotens', () => {
  it('KONTROLLE: haelt WS bei "5" fuer einen direkten Geschwisterknoten unter demselben Elternteil', () => {
    const hitCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="parent" childId="${TROOPER_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" fuer ein Kind, das unter dem Traeger selbst haengt statt unter dessen Elternteil', () => {
    const missCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="parent" childId="${CHARM_ID}" shared="true" includeChildSelections="false"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });
});

describe('scope="self": zaehlt die eigenen Kinder des Traegers', () => {
  it('KONTROLLE: haelt WS bei "5" fuer ein Kind, das direkt unter dem Traeger selbst haengt', () => {
    const hitCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="self" childId="${CHARM_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" fuer ein Ziel, das nicht unter dem Traeger selbst haengt', () => {
    const missCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="self" childId="${TROOPER_ID}" shared="true" includeChildSelections="true"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });
});

describe('scope="unit": zaehlt gegen die umschliessende Einheit (Kriterium 5 der Meldung)', () => {
  it('KONTROLLE: haelt WS bei "5", wenn die umschliessende Einheit die gesuchte Kategorie traegt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="${ELITE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3", wenn die umschliessende Einheit die gesuchte Kategorie nicht traegt', () => {
    const missCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="${UNUSED_CATEGORY_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });

  it('bleibt fail-closed (Basiswert + unresolvedScope), wenn der Traeger keine umschliessende Einheit hat', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="${ELITE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FREESTANDING_BANNER);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, 'unit')).not.toEqual([]);
  });
});

describe('scope="model-or-unit": zaehlt gegen das naechste Modell ODER die naechste Einheit (neu)', () => {
  it('haelt WS bei "5", wenn das umschliessende MODELL die gesuchte Kategorie traegt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="model-or-unit" childId="${SKIRMISHER_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ crestCondition: hitCondition }), rosterTree({ withCrest: true }));

    expect(wsOf(report, CREST_ID, CREST_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" fuer eine Kategorie, die erst an der Einheit UEBER dem naechsten Modell sitzt', () => {
    const missCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="model-or-unit" childId="${ELITE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ crestCondition: missCondition }), rosterTree({ withCrest: true }));

    expect(wsOf(report, CREST_ID, CREST_GATE_LINK_ID)).toBe(BASE_WS);
  });

  it('die Gegenprobe: dieselbe Bedingung mit scope="unit" statt "model-or-unit" trifft am selben Traeger, weil dort die Einheit der Rahmen ist', () => {
    const controlCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="unit" childId="${ELITE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ crestCondition: controlCondition }), rosterTree({ withCrest: true }));

    expect(wsOf(report, CREST_ID, CREST_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('bleibt fail-closed (Basiswert + unresolvedScope), wenn der Traeger weder Modell noch Einheit ueber sich hat', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="model-or-unit" childId="${SKIRMISHER_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ crestCondition: hitCondition }), ROSTER_FREESTANDING_CREST);

    expect(wsOf(report, CREST_ID, CREST_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, 'model-or-unit')).not.toEqual([]);
  });
});

describe('scope="ancestor": prueft die Vorfahrenkette (Mitgliedschaft, kein Zaehlrahmen)', () => {
  it('KONTROLLE: haelt WS bei "5", wenn ein Vorfahre die gesuchte Kategorie traegt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="ancestor" childId="${ELITE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3", wenn nur ein Geschwisterknoten (kein Vorfahre) die Kategorie traegt', () => {
    const missCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="ancestor" childId="${SKIRMISHER_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });
});

describe('scope="primary-catalogue": Identitaetspruefung gegen das Armeebuch des Kontingents', () => {
  it('KONTROLLE: haelt WS bei "5", wenn `childId` den eigenen Katalog benennt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="primary-catalogue" childId="${CATALOGUE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" fuer einen Katalog, der im Datensatz nicht geladen ist — ein schlichter Nicht-Treffer, keine Diagnose', () => {
    const missCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="primary-catalogue" childId="${UNKNOWN_CATALOGUE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, 'primary-catalogue')).toEqual([]);
  });
});

describe('scope="primary-category": Identitaetspruefung gegen die PRIMAERE Kategorie der Einheit (neu)', () => {
  it('haelt WS bei "5", wenn `childId` die primaere Kategorie der Einheit benennt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="primary-category" childId="${RARE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" fuer eine Kategorie, die die Einheit traegt, aber nicht primaer — "primaer" darf nicht zu "irgendeine" verwaessern', () => {
    const missCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="primary-category" childId="${ELITE_ID}"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
  });

  it('bleibt fail-closed (Basiswert + unresolvedScope), wenn kein Knoten der Kette eine primaere Kategorie traegt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="primary-category" childId="${RARE_ID}"/>`,
    );
    const report = evaluate(
      catalogueWithGate({ bannerCondition: hitCondition, regimentPrimaryRare: false }),
      ROSTER_FULL,
    );

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, 'primary-category')).not.toEqual([]);
  });

  it('haelt WS weiterhin bei "5" mit `shared="false"` — eine primaere Kategorie wird durch eine Instanz nicht enger', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="primary-category" childId="${RARE_ID}" shared="false"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });
});

describe('Eintrags-Id als scope: die "selbst-gegatete" Form, verallgemeinert auf selectionEntry-Ids', () => {
  it('KONTROLLE: haelt WS bei "5" — die Form, die der gemeldete Blutlinien-Fall nutzt', () => {
    const hitCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="${REGIMENT_ID}" childId="any"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" mit unresolvedScope, wenn die Id einen realen Eintrag benennt, der kein Vorfahre des Traegers ist', () => {
    const missCondition = conditions(
      `<condition type="instanceOf" value="1" field="selections" scope="${TROOPER_ID}" childId="any"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, TROOPER_ID)).not.toEqual([]);
  });
});

describe('Kategorie-Id als scope', () => {
  it('KONTROLLE: haelt WS bei "5" — der naechste Vorfahre mit der gesuchten Kategorie wird zum Zaehlrahmen', () => {
    const hitCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="${ELITE_ID}" childId="model"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: hitCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(GATED_WS);
  });

  it('haelt WS bei Basiswert "3" mit unresolvedScope, wenn keine Vorfahre die gesuchte Kategorie traegt', () => {
    const missCondition = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="${SKIRMISHER_ID}" childId="model"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: missCondition }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, SKIRMISHER_ID)).not.toEqual([]);
  });
});

describe('ein frei erfundenes Schluesselwort bleibt fail-closed diagnostiziert', () => {
  it('KONTROLLE: haelt WS bei Basiswert "3" mit unresolvedScope — kein stilles Raten (spiegelt query.unitScope.test.js)', () => {
    const invented = conditions(
      `<condition type="atLeast" value="1" field="selections" scope="flock-of-seagulls" childId="model"/>`,
    );
    const report = evaluate(catalogueWithGate({ bannerCondition: invented }), ROSTER_FULL);

    expect(wsOf(report, BANNER_ID, BANNER_GATE_LINK_ID)).toBe(BASE_WS);
    expect(unresolvedScopeOf(report, 'flock-of-seagulls')).not.toEqual([]);
  });
});
