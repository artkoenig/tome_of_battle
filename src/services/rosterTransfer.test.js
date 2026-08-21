import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeToDataChanges } from './dataEvents';
import { readRosterFile, buildRosterFile, MissingSystemError } from './rosterTransfer';
import * as serialization from '../utils/rosterSerialization';

vi.mock('../utils/rosterSerialization', () => {
  class MissingSystemErrorStub extends Error {}
  return {
    MissingSystemError: MissingSystemErrorStub,
    exportRosterToXml: vi.fn(),
    importRosterFromXml: vi.fn(),
    compressXmlToRosz: vi.fn(),
    decompressRoszToXml: vi.fn(),
  };
});

describe('rosterTransfer', () => {
  const ROSTER = { id: 'r1', name: 'Bretonnia' };
  const SYSTEM = { id: 's1' };
  const unsubscribers = [];

  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()();
  });

  it('unpacks and parses a roster file', async () => {
    serialization.decompressRoszToXml.mockResolvedValue('<roster/>');
    serialization.importRosterFromXml.mockReturnValue(ROSTER);

    await expect(readRosterFile({ name: 'a.rosz' }, [SYSTEM])).resolves.toBe(ROSTER);
    expect(serialization.importRosterFromXml).toHaveBeenCalledWith('<roster/>', [SYSTEM]);
  });

  it('hands the missing-system case through as its own error type', async () => {
    serialization.decompressRoszToXml.mockResolvedValue('<roster/>');
    serialization.importRosterFromXml.mockImplementation(() => { throw new MissingSystemError('no system'); });

    await expect(readRosterFile({ name: 'a.rosz' }, [])).rejects.toBeInstanceOf(MissingSystemError);
  });

  it('builds a downloadable file with a filesystem-safe name', async () => {
    const blob = { size: 1 };
    serialization.exportRosterToXml.mockReturnValue('<roster/>');
    serialization.compressXmlToRosz.mockResolvedValue(blob);

    await expect(buildRosterFile({ ...ROSTER, name: 'A/B: "C"' }, SYSTEM))
      .resolves.toEqual({ blob, fileName: 'A_B_ _C_.rosz' });
    expect(serialization.exportRosterToXml).toHaveBeenCalledWith({ ...ROSTER, name: 'A/B: "C"' }, SYSTEM);
  });

  // Weder Lesen noch Erzeugen legt etwas ab; bleibend wird ein Import erst
  // durch rosterStore.saveRoster, und der meldet sich dort.
  it('announces nothing: neither direction writes to the store', async () => {
    const events = [];
    unsubscribers.push(subscribeToDataChanges(event => events.push(event)));
    serialization.decompressRoszToXml.mockResolvedValue('<roster/>');
    serialization.importRosterFromXml.mockReturnValue(ROSTER);
    serialization.exportRosterToXml.mockReturnValue('<roster/>');
    serialization.compressXmlToRosz.mockResolvedValue({ size: 1 });

    await readRosterFile({ name: 'a.rosz' }, [SYSTEM]);
    await buildRosterFile(ROSTER, SYSTEM);

    expect(events).toEqual([]);
  });
});
