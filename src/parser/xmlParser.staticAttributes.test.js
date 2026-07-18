import { test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseGameSystemXML, parseCatalogueXML } from './xmlParser';
import { groupProfilesByType } from '../solver/rulesEvaluator';
import { getExtraResourceTotals } from '../solver/rosterCounter';

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

// --- Profile type via typeId/typeName (schema-valid; not profileTypeId/Name) ---

const catWithProfileType = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Faction" gameSystemId="sys-1">
  <sharedProfiles>
    <profile id="prof-1" name="Longsword" typeId="type-weapon" typeName="Weapon">
      <characteristics>
        <characteristic name="Strength" typeId="char-str">4</characteristic>
      </characteristics>
    </profile>
  </sharedProfiles>
</catalogue>`;

test('profile type is read from typeId/typeName, not the nonexistent profileTypeId/Name', () => {
  const profile = parseCatalogueXML(catWithProfileType).sharedProfiles[0];
  expect(profile.profileTypeId).toBe('type-weapon');
  expect(profile.profileTypeName).toBe('Weapon');
});

test('the parsed typeName surfaces as a group heading in the profile display', () => {
  const profiles = parseCatalogueXML(catWithProfileType).sharedProfiles;
  const groups = groupProfilesByType(profiles);
  expect(groups.map(g => g.typeName)).toContain('Weapon');
});

// --- catalogueLink@importRootEntries ---

const catWithCatalogueLinks = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Faction" gameSystemId="sys-1">
  <catalogueLinks>
    <catalogueLink id="link-1" name="Library A" targetId="cat-lib-a" type="catalogue" importRootEntries="true" />
    <catalogueLink id="link-2" name="Library B" targetId="cat-lib-b" type="catalogue" />
  </catalogueLinks>
</catalogue>`;

test('catalogueLink@importRootEntries is parsed as a boolean, defaulting to false', () => {
  const links = parseCatalogueXML(catWithCatalogueLinks).catalogueLinks;
  const importing = links.find(l => l.id === 'link-1');
  const plain = links.find(l => l.id === 'link-2');
  expect(importing.importRootEntries).toBe(true);
  expect(plain.importRootEntries).toBe(false);
});

// --- costType@hidden ---

const gstWithHiddenCostType = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test System">
  <costTypes>
    <costType id="pts" name="Points" defaultCostLimit="2000" />
    <costType id="secret" name="Secret Resource" hidden="true" />
  </costTypes>
</gameSystem>`;

test('costType@hidden is parsed as a boolean, defaulting to false', () => {
  const costTypes = parseGameSystemXML(gstWithHiddenCostType).costTypes;
  expect(costTypes.find(ct => ct.id === 'pts').hidden).toBe(false);
  expect(costTypes.find(ct => ct.id === 'secret').hidden).toBe(true);
});

test('a hidden cost type is excluded from the displayed extra resources', () => {
  const system = parseGameSystemXML(gstWithHiddenCostType);
  const roster = { costLimitType: 'pts' };
  const costs = { pts: 1500, secret: 7 };

  const resources = getExtraResourceTotals(system, roster, costs);

  expect(resources.some(r => r.id === 'secret')).toBe(false);
});

// --- publication@publisherUrl (not the nonexistent website) ---

const catWithPublication = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Faction" gameSystemId="sys-1">
  <publications>
    <publication id="pub-1" name="Core Rulebook" shortName="CRB" publisher="Some Publisher" publisherUrl="https://example.com/crb" />
  </publications>
</catalogue>`;

const gstWithPublication = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test System">
  <publications>
    <publication id="pub-1" name="Core Rulebook" publisherUrl="https://example.com/crb" />
  </publications>
</gameSystem>`;

test('publication@publisherUrl is parsed on a catalogue publication', () => {
  const publication = parseCatalogueXML(catWithPublication).publications[0];
  expect(publication.publisherUrl).toBe('https://example.com/crb');
});

test('publication@publisherUrl is parsed on a game system publication', () => {
  const publication = parseGameSystemXML(gstWithPublication).publications[0];
  expect(publication.publisherUrl).toBe('https://example.com/crb');
});
