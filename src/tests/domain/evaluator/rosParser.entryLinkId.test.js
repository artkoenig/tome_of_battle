import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rosterFromRos } from '../../test-utils/rosParser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Issue 78, Harness-Bindung: der E2E-Fixture-Parser bindet eine `<selection>`
// bevorzugt ueber ihr Attribut `entryLinkId` (die eigene ID des `<entryLink>`)
// und faellt nur ohne dieses Attribut auf `entryId` zurueck
// (`entryLinkId || entryId`). Nur so ist der Unterschied „direkt vs. verlinkt"
// im E2E-Pfad ueberhaupt darstellbar.
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force-a';
const LINK_ID = 'link-trooper';
const TARGET_ID = 'shared-trooper';
const PLAIN_CHILD_ID = 'entry-ammo';
const NESTED_LINK_ID = 'link-banner';
const NESTED_TARGET_ID = 'shared-banner';

// Eine minimale `.ros`-Datei: die aeussere Auswahl traegt BEIDE Attribute
// (entryLinkId und entryId), ihr erstes Kind nur entryId, ihr zweites Kind
// wieder beide — so sind Vorrang, Rueckfall und Rekursion in einem Baum sichtbar.
const ROS_XML = `<?xml version="1.0" encoding="utf-8"?>
<roster name="Fixture Roster">
  <forces>
    <force entryId="${FORCE_ID}" name="Force A">
      <selections>
        <selection entryId="${TARGET_ID}" entryLinkId="${LINK_ID}" name="Trooper" number="3">
          <selections>
            <selection entryId="${PLAIN_CHILD_ID}" name="Ammo" number="2"/>
            <selection entryId="${NESTED_TARGET_ID}" entryLinkId="${NESTED_LINK_ID}" name="Banner"/>
          </selections>
        </selection>
      </selections>
    </force>
  </forces>
</roster>`;

const dir = mkdtempSync(join(tmpdir(), 'ros-parser-entrylinkid-'));
const rosPath = join(dir, 'fixture.ros');
writeFileSync(rosPath, ROS_XML, 'utf8');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('rosterFromRos bindet Auswahlen ueber entryLinkId || entryId (Issue 78)', () => {
  it('bevorzugt entryLinkId, faellt ohne das Attribut auf entryId zurueck — auch rekursiv', () => {
    const roster = rosterFromRos(rosPath);

    expect(roster.forces).toEqual([
      {
        defId: FORCE_ID,
        count: 1,
        children: [
          {
            // Beide Attribute vorhanden → die eigene ID des entryLink gewinnt.
            defId: LINK_ID,
            count: 3,
            children: [
              // Nur entryId vorhanden → Rueckfall auf entryId.
              { defId: PLAIN_CHILD_ID, count: 2, children: [] },
              // Beide Attribute, geschachtelt und ohne number (Default 1) →
              // dieselbe Vorrangregel gilt rekursiv.
              { defId: NESTED_LINK_ID, count: 1, children: [] },
            ],
          },
        ],
      },
    ]);
  });
});
