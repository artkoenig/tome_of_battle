import { describe, it, expect, vi, afterEach } from 'vitest';
import { processImportedData } from './xmlParser';

const GST_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="sys-1" name="System One" revision="1"></gameSystem>`;

const catalogueXml = (id, name) => `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="${id}" name="${name}" gameSystemId="sys-1" revision="1"></catalogue>`;

// A catalogue whose root element is not <catalogue> is rejected by the parser and stands
// in for any unreadable file: truncated download, wrong file, damaged archive entry.
const BROKEN_CATALOGUE_XML = '<?xml version="1.0" encoding="utf-8"?><notACatalogue />';

describe('processImportedData — unreadable catalogues', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports the readable catalogues and reports the failed one by file name', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { system, failedCatalogues } = processImportedData(
      [{ name: 'rules.gst', content: GST_XML }],
      [
        { name: 'good.cat', content: catalogueXml('cat-good', 'Good') },
        { name: 'broken.cat', content: BROKEN_CATALOGUE_XML },
      ]
    );

    expect(system.catalogues.map((catalogue) => catalogue.id)).toEqual(['cat-good']);
    expect(failedCatalogues).toHaveLength(1);
    expect(failedCatalogues[0].fileName).toBe('broken.cat');
    expect(failedCatalogues[0].message).toBeTruthy();
  });

  it('reports no failures when every catalogue could be read', () => {
    const { system, failedCatalogues } = processImportedData(
      [{ name: 'rules.gst', content: GST_XML }],
      [{ name: 'good.cat', content: catalogueXml('cat-good', 'Good') }]
    );

    expect(system.catalogues).toHaveLength(1);
    expect(failedCatalogues).toEqual([]);
  });

  it('still fails outright when no game system file is present', () => {
    expect(() => processImportedData([], [])).toThrow(/Game System/);
  });
});
