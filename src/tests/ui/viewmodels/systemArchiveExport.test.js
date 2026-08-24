import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasRawXmls, downloadSystemArchive } from '../../../ui/viewmodels/systemArchiveExport';

/**
 * Issue 0176 — the archive export of the import shell, cut out of
 * `useImporter.js`. jsdom has no object URLs; they are the seam here.
 */
const SYSTEM = {
  name: 'Warhammer',
  rawXmls: {
    gst: [{ name: 'wh.gst', content: '<gameSystem/>' }],
    cat: [{ name: 'bret.cat', content: '<catalogue/>' }],
  },
};

let click;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:archive');
  URL.revokeObjectURL = vi.fn();
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  click.mockRestore();
});

describe('systemArchiveExport', () => {
  it('knows a system that cannot be given back as it came in', () => {
    expect(hasRawXmls(SYSTEM)).toBe(true);
    expect(hasRawXmls({ name: 'Ohne' })).toBe(false);
    expect(hasRawXmls(undefined)).toBe(false);
  });

  it('hands the packed archive to the browser and releases the object URL again', async () => {
    await downloadSystemArchive(SYSTEM);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:archive');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
