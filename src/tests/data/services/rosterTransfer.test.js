import { describe, it, expect, afterEach } from 'vitest';
import JSZip from 'jszip';
import { subscribeToDataChanges } from '../../../domain/services/dataEvents';
import { readRosterText, buildRosterFile } from '../../../domain/services/rosterTransfer';

const ROSTER_XML = '<?xml version="1.0"?><roster name="Bretonnia"></roster>';

describe('rosterTransfer', () => {
  const unsubscribers = [];

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
  });

  it('unpacks a .rosz archive back to its roster XML', async () => {
    const { blob } = await buildRosterFile('my_test_roster', ROSTER_XML);

    await expect(readRosterText(blob)).resolves.toBe(ROSTER_XML);
  });

  it('reads a raw .ros file as text', async () => {
    const blob = new Blob([ROSTER_XML], { type: 'text/xml' });

    await expect(readRosterText(blob)).resolves.toBe(ROSTER_XML);
  });

  // A truncated .rosz used to be mistaken for "this was never a ZIP", read as text and
  // then fail as "invalid file format" — a message pointing away from the real cause.
  it('reports a damaged archive as damaged instead of reading it as raw text', async () => {
    const { blob } = await buildRosterFile('my_test_roster', ROSTER_XML);
    const truncatedZip = blob.slice(0, Math.floor(blob.size / 2));

    await expect(readRosterText(truncatedZip)).rejects.toMatchObject({
      messageKey: 'serialization.damagedArchive',
    });
  });

  it('reports an archive without a .ros entry instead of reading it as raw text', async () => {
    const zip = new JSZip();
    zip.file('notes.txt', 'kein Roster');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    await expect(readRosterText(zipBlob)).rejects.toMatchObject({
      messageKey: 'serialization.missingRosterEntry',
    });
  });

  // Die Schicht formuliert keinen Nutzertext (ADR-0037, `keine-i18n-unter-ui`):
  // sie reicht den Schlüssel heraus, die Oberfläche übersetzt ihn.
  it('carries a message key instead of a translated text', async () => {
    const zip = new JSZip();
    zip.file('notes.txt', 'kein Roster');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    await expect(readRosterText(zipBlob)).rejects.toThrow('serialization.missingRosterEntry');
  });

  it('builds a downloadable file with a filesystem-safe name', async () => {
    const { blob, fileName } = await buildRosterFile('A/B: "C"', ROSTER_XML);

    expect(fileName).toBe('A_B_ _C_.rosz');
    expect(blob.size).toBeGreaterThan(0);
  });

  // Weder Lesen noch Erzeugen legt etwas ab; bleibend wird ein Import erst
  // durch rosterStore.saveRoster, und der meldet sich dort.
  it('announces nothing: neither direction writes to the store', async () => {
    const events = [];
    unsubscribers.push(subscribeToDataChanges(event => events.push(event)));

    const { blob } = await buildRosterFile('Bretonnia', ROSTER_XML);
    await readRosterText(blob);

    expect(events).toEqual([]);
  });
});
