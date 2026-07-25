/**
 * Tests der reinen **Info-Elemente** (Slice 03, `design.md` Kontrakte
 * `ProfileDef`/`RuleDef`/`InfoGroupDef`/`InfoLinkDef`).
 *
 * Der Reader liest `profile`/`rule`/`infoGroup`/`infoLink` strukturell in
 * `entry.infos`, ohne Grenzen-/Modifikator-Logik. Der Resolver indiziert die
 * Info-Definitionen in die ID-Karte und loest jeden `infoLink` ueber
 * `lookup(targetId)` auf sein Ziel auf. Keines dieser Elemente erzeugt eine
 * UNSUPPORTED-Diagnose, bricht das Parsen oder veraendert effektive Werte.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { evaluate } from './evaluator.js';
import { InfoElementKind, InfoLinkKind, DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const PROFILE_ID = 'shared-profile-warrior';
const PROFILE_TYPE_ID = 'profile-type-unit';
const RULE_ID = 'shared-rule-fear';
const GROUP_ID = 'shared-group-abilities';

/**
 * Katalog mit einem Eintrag, der ein eigenes Profil, eine eigene Regel und einen
 * `infoLink` traegt, sowie katalogweit geteilten Profil/Regel/Info-Gruppe als
 * Link-Zielen. `linkType`/`linkTargetId` steuern den Link des Eintrags.
 */
function catalogueWithInfos(linkType, linkTargetId) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-info" name="Info Catalogue">
      <sharedProfiles>
        <profile id="${PROFILE_ID}" name="Warrior" typeId="${PROFILE_TYPE_ID}">
          <characteristics>
            <characteristic name="Move" typeId="char-move">6"</characteristic>
            <characteristic name="Wounds" typeId="char-wounds">1</characteristic>
          </characteristics>
        </profile>
      </sharedProfiles>
      <sharedRules>
        <rule id="${RULE_ID}" name="Fear">
          <description>Enemies must test.</description>
        </rule>
      </sharedRules>
      <sharedInfoGroups>
        <infoGroup id="${GROUP_ID}" name="Abilities">
          <profiles>
            <profile id="nested-profile" name="Charge" typeId="${PROFILE_TYPE_ID}"/>
          </profiles>
        </infoGroup>
      </sharedInfoGroups>
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
          <profiles>
            <profile id="own-profile" name="Own" typeId="${PROFILE_TYPE_ID}"/>
          </profiles>
          <rules>
            <rule id="own-rule" name="Own Rule"/>
          </rules>
          <infoLinks>
            <infoLink id="link-1" name="Linked" type="${linkType}" targetId="${linkTargetId}"/>
          </infoLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Findet das Info-Element gegebener Art in einer Info-Liste. */
function infoOfKind(infos, kind) {
  return infos.find(info => info.kind === kind);
}

describe('catalogReader: Info-Elemente strukturell lesen', () => {
  it('liest profile mit typeId und characteristics in entry.infos', () => {
    const catalogue = parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID));
    const entry = catalogue.entries[0];
    const profile = infoOfKind(entry.infos, InfoElementKind.PROFILE);

    expect(profile).toEqual({
      kind: InfoElementKind.PROFILE,
      id: 'own-profile',
      name: 'Own',
      typeId: PROFILE_TYPE_ID,
      characteristics: [],
    });
  });

  it('liest die characteristics eines geteilten Profils mit Wert (Textinhalt)', () => {
    const catalogue = parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID));
    const sharedProfile = infoOfKind(catalogue.infos, InfoElementKind.PROFILE);

    expect(sharedProfile.characteristics).toEqual([
      { name: 'Move', typeId: 'char-move', value: '6"' },
      { name: 'Wounds', typeId: 'char-wounds', value: '1' },
    ]);
  });

  it('liest rule mit id und name in entry.infos', () => {
    const catalogue = parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID));
    const rule = infoOfKind(catalogue.entries[0].infos, InfoElementKind.RULE);

    expect(rule).toEqual({ kind: InfoElementKind.RULE, id: 'own-rule', name: 'Own Rule' });
  });

  it('liest infoGroup rekursiv mit ihren verschachtelten infos', () => {
    const catalogue = parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID));
    const group = infoOfKind(catalogue.infos, InfoElementKind.INFO_GROUP);

    expect(group.id).toBe(GROUP_ID);
    expect(group.name).toBe('Abilities');
    expect(group.infos).toEqual([
      { kind: InfoElementKind.PROFILE, id: 'nested-profile', name: 'Charge', typeId: PROFILE_TYPE_ID, characteristics: [] },
    ]);
  });

  it('liest infoLink mit SSOT-Typ und targetId', () => {
    const catalogue = parseCatalogue(catalogueWithInfos(InfoLinkKind.RULE, RULE_ID));
    const link = infoOfKind(catalogue.entries[0].infos, InfoElementKind.INFO_LINK);

    expect(link).toMatchObject({
      kind: InfoElementKind.INFO_LINK,
      id: 'link-1',
      type: InfoLinkKind.RULE,
      targetId: RULE_ID,
    });
  });

  it('normalisiert einen infoLink-Typ ausserhalb des SSOT-Enums zu null', () => {
    const catalogue = parseCatalogue(catalogueWithInfos('nonsense', RULE_ID));
    const link = infoOfKind(catalogue.entries[0].infos, InfoElementKind.INFO_LINK);

    expect(link.type).toBeNull();
  });
});

describe('resolver: infoLink auf sein Ziel aufloesen', () => {
  it('loest einen Link auf ein geteiltes Profil auf (resolved am Eintrag verfuegbar)', () => {
    const resolved = resolveCatalogue(parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID)));
    const link = infoOfKind(resolved.lookup(ENTRY_ID).infos, InfoElementKind.INFO_LINK);

    expect(link.resolved).toBe(resolved.lookup(PROFILE_ID));
    expect(link.resolved.kind).toBe(InfoElementKind.PROFILE);
  });

  it('loest einen Link auf eine geteilte Regel auf', () => {
    const resolved = resolveCatalogue(parseCatalogue(catalogueWithInfos(InfoLinkKind.RULE, RULE_ID)));
    const link = infoOfKind(resolved.lookup(ENTRY_ID).infos, InfoElementKind.INFO_LINK);

    expect(link.resolved).toBe(resolved.lookup(RULE_ID));
    expect(link.resolved.kind).toBe(InfoElementKind.RULE);
  });

  it('loest einen Link auf eine geteilte Info-Gruppe auf', () => {
    const resolved = resolveCatalogue(parseCatalogue(catalogueWithInfos(InfoLinkKind.INFO_GROUP, GROUP_ID)));
    const link = infoOfKind(resolved.lookup(ENTRY_ID).infos, InfoElementKind.INFO_LINK);

    expect(link.resolved).toBe(resolved.lookup(GROUP_ID));
    expect(link.resolved.kind).toBe(InfoElementKind.INFO_GROUP);
  });

  it('meldet einen baumelnden Link als Diagnose und traegt kein Ziel', () => {
    const resolved = resolveCatalogue(parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, 'no-such-target')));
    const link = infoOfKind(resolved.lookup(ENTRY_ID).infos, InfoElementKind.INFO_LINK);

    expect(link.resolved).toBeNull();
    expect(resolved.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.DANGLING_INFO_LINK, targetId: 'no-such-target' })
    );
  });
});

describe('Info-Elemente sind rein strukturell', () => {
  it('erzeugen keine UNSUPPORTED-Diagnose bei einem gueltigen Katalog', () => {
    const resolved = resolveCatalogue(parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID)));
    const allDiagnostics = [...parseCatalogue(catalogueWithInfos(InfoLinkKind.PROFILE, PROFILE_ID)).diagnostics, ...resolved.diagnostics];
    const unsupported = allDiagnostics.filter(d => String(d.kind).startsWith('unsupported'));

    expect(unsupported).toEqual([]);
  });

  it('veraendern weder Grenzen noch effektive Werte des Berichts', () => {
    const LIMIT_ID = 'max-warriors';
    const withoutInfos = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-plain" name="Plain">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <constraints>
              <constraint id="${LIMIT_ID}" type="max" value="2" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const withInfos = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-plain" name="Plain">
        <sharedRules>
          <rule id="${RULE_ID}" name="Fear"/>
        </sharedRules>
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <profiles>
              <profile id="own-profile" name="Own" typeId="${PROFILE_TYPE_ID}"/>
            </profiles>
            <infoLinks>
              <infoLink id="link-1" name="Linked" type="${InfoLinkKind.RULE}" targetId="${RULE_ID}"/>
            </infoLinks>
            <constraints>
              <constraint id="${LIMIT_ID}" type="max" value="2" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const roster = { forces: [{ defId: ENTRY_ID, count: 3, children: [] }] };

    const plainReport = evaluate(withoutInfos, roster);
    const infoReport = evaluate(withInfos, roster);

    expect(infoReport.violations).toEqual(plainReport.violations);
    expect(infoReport.violations).toHaveLength(1);
  });
});
