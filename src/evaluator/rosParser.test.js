import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

import { rosterFromRos } from './__fixtures__/rosParser.js';

/**
 * Der `.ros`-Adapter (`__fixtures__/rosParser.js`) ist der einzige Erzeuger des
 * Engine-Eingangs und damit die Stelle, an der eine gespeicherte Auswahl an den
 * Katalog gebunden wird. Geprueft wird genau diese Bindung: eine `<selection>`
 * benennt **zwei** Ids — `entryId` das gewaehlte Ziel, `entryLinkId` den Verweis,
 * ueber den es hereinkam —, und massgeblich ist der Verweis, wenn es einen gibt.
 *
 * Die drei Formen des `entryLinkId`-Attributs stammen aus echten
 * BattleScribe-Ausgaben: nicht-leer (ueber einen Verweis gesetzt), leer (direkt
 * gewaehlt) und ganz fehlend (aeltere Ausgaben).
 */

const UNIT_LINK_ID = 'link-unit';
const UNIT_TARGET_ID = 'entry-unit';
const DIRECT_ENTRY_ID = 'entry-direct';
const LEGACY_ENTRY_ID = 'entry-legacy';
const FORCE_ID = 'force-army';
const TROOPER_COUNT = 3;

const ROSTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<roster id="ros-binding" name="Binding" xmlns="http://www.battlescribe.net/schema/rosterSchema">
  <forces>
    <force id="force-1" name="Army" entryId="${FORCE_ID}">
      <selections>
        <selection id="sel-linked" name="Linked" entryId="${UNIT_TARGET_ID}" entryLinkId="${UNIT_LINK_ID}" number="1" type="unit">
          <selections>
            <selection id="sel-direct" name="Direct" entryId="${DIRECT_ENTRY_ID}" entryLinkId="" number="${TROOPER_COUNT}" type="model"/>
            <selection id="sel-legacy" name="Legacy" entryId="${LEGACY_ENTRY_ID}" number="1" type="upgrade"/>
          </selections>
        </selection>
      </selections>
    </force>
  </forces>
</roster>`;

describe('.ros-Adapter: eine Auswahl wird ueber den Verweis gebunden, nicht ueber sein Ziel', () => {
  let force;

  beforeAll(() => {
    const path = join(mkdtempSync(join(tmpdir(), 'ros-parser-')), 'binding.ros');
    writeFileSync(path, ROSTER_XML, 'utf8');
    [force] = rosterFromRos(path).forces;
  });

  it('benennt eine per Verweis gesetzte Auswahl mit der Verweis-Id', () => {
    expect(force.children[0].defId).toBe(UNIT_LINK_ID);
  });

  it('fuehrt die genannte Ziel-Id als Pruefdatum mit', () => {
    expect(force.children[0].expectedTargetDefId).toBe(UNIT_TARGET_ID);
  });

  it('liest ein leeres entryLinkId als "direkt gewaehlt" und benennt den Eintrag', () => {
    const [directSelection] = force.children[0].children;

    expect(directSelection).toMatchObject({ defId: DIRECT_ENTRY_ID, count: TROOPER_COUNT });
    expect(directSelection).not.toHaveProperty('expectedTargetDefId');
  });

  it('behandelt ein fehlendes entryLinkId wie ein leeres', () => {
    const legacySelection = force.children[0].children[1];

    expect(legacySelection).toMatchObject({ defId: LEGACY_ENTRY_ID });
    expect(legacySelection).not.toHaveProperty('expectedTargetDefId');
  });

  it('bindet das Kontingent unveraendert ueber seine entryId', () => {
    expect(force).toMatchObject({ defId: FORCE_ID, count: 1 });
  });
});
