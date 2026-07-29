/**
 * Issue 0102, Punkt 5: Info-Kinder von `categoryLink`s werden gelesen.
 *
 * Vertrag (Issue-Plan, 2026-07-29): eine gelesene `categoryLink`-Definition
 * traegt `infos` (Profile/Regeln/InfoGruppen/InfoLinks unterhalb des Links, wie
 * bei Eintraegen). XSD: `categoryLink` erbt von `ContainerEntryBase` — bisher
 * verwarf der Leser diese Kinder still, eine Regel an einem Kategorie-Link
 * erreichte die Info-Projektion nie.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { DefinitionKind, InfoElementKind, InfoLinkKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const CATEGORY_ID = 'category-core';
const CATEGORY_LINK_ID = 'link-category-core';
const LINK_RULE_ID = 'rule-at-category-link';
const LINK_PROFILE_ID = 'profile-at-category-link';
const LINK_GROUP_ID = 'infogroup-at-category-link';
const LINK_INFOLINK_ID = 'infolink-at-category-link';
const SHARED_RULE_ID = 'shared-rule';

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-catlink-infos" name="CategoryLink Infos Catalogue">
    <categoryEntries>
      <categoryEntry id="${CATEGORY_ID}" name="Core"/>
    </categoryEntries>
    <sharedRules>
      <rule id="${SHARED_RULE_ID}" name="Geteilte Regel"><description>Geteilt.</description></rule>
    </sharedRules>
    <selectionEntries>
      <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
        <categoryLinks>
          <categoryLink id="${CATEGORY_LINK_ID}" name="Core" targetId="${CATEGORY_ID}">
            <profiles>
              <profile id="${LINK_PROFILE_ID}" name="Link-Profil" typeId="pt-unit"/>
            </profiles>
            <rules>
              <rule id="${LINK_RULE_ID}" name="Link-Regel"><description>Regel am Kategorie-Link.</description></rule>
            </rules>
            <infoGroups>
              <infoGroup id="${LINK_GROUP_ID}" name="Link-Gruppe"/>
            </infoGroups>
            <infoLinks>
              <infoLink id="${LINK_INFOLINK_ID}" name="Link-Verweis" type="${InfoLinkKind.RULE}" targetId="${SHARED_RULE_ID}"/>
            </infoLinks>
          </categoryLink>
        </categoryLinks>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Die gelesene categoryLink-Definition unterhalb des Eintrags. */
function parsedCategoryLink(xml) {
  const entry = parseCatalogue(xml).entries.find(def => def.id === ENTRY_ID);
  return entry.children.find(child => child.kind === DefinitionKind.CATEGORY_LINK);
}

describe('parseCatalogue: Info-Kinder eines categoryLink', () => {
  it('liest Profil, Regel, Info-Gruppe und Info-Verweis unterhalb des Links in dessen infos', () => {
    const link = parsedCategoryLink(CATALOGUE_XML);

    expect(link.id).toBe(CATEGORY_LINK_ID);
    expect(link.infos).toEqual([
      expect.objectContaining({ kind: InfoElementKind.PROFILE, id: LINK_PROFILE_ID }),
      expect.objectContaining({ kind: InfoElementKind.RULE, id: LINK_RULE_ID }),
      expect.objectContaining({ kind: InfoElementKind.INFO_GROUP, id: LINK_GROUP_ID }),
      expect.objectContaining({
        kind: InfoElementKind.INFO_LINK,
        id: LINK_INFOLINK_ID,
        targetId: SHARED_RULE_ID,
      }),
    ]);
  });

  it('traegt den unveraenderten Regeltext der Regel am Link', () => {
    const link = parsedCategoryLink(CATALOGUE_XML);
    // Optionale Verkettung: solange `infos` fehlt, faellt der Test als
    // Assertion (undefined statt Text), nicht als TypeError.
    const rule = link.infos?.find(info => info.id === LINK_RULE_ID);

    expect(rule?.text).toBe('Regel am Kategorie-Link.');
  });

  it('liest einen categoryLink ohne Info-Kinder als leere Liste (nie undefined)', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-catlink-empty" name="CategoryLink Empty Catalogue">
        <categoryEntries>
          <categoryEntry id="${CATEGORY_ID}" name="Core"/>
        </categoryEntries>
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <categoryLinks>
              <categoryLink id="${CATEGORY_LINK_ID}" name="Core" targetId="${CATEGORY_ID}"/>
            </categoryLinks>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    expect(parsedCategoryLink(xml).infos).toEqual([]);
  });
});
