import { describe, it, expect } from 'vitest';
import {
  CrawlEvent,
  EMPTY_SECTION_MESSAGE,
  BASE_URL,
  crawlRulesIndex,
  extractLinks,
  addEntry,
  mergeRetainingFailedSections,
} from './rules-crawler.js';

const SECTIONS = ['special-rules', 'weapons'];

function linkMarkup(section, slug, label) {
  return `<a href="/${section}/${slug}" class="rule">${label}</a>`;
}

function fakeFetchFrom(pagesBySection) {
  return async url => {
    const section = url === BASE_URL ? '' : url.split('/').pop();
    const page = pagesBySection[section];
    if (page instanceof Error) throw page;
    return page;
  };
}

function collectEvents() {
  const events = [];
  return { events, onEvent: event => events.push(event) };
}

function eventsOfType(events, type) {
  return events.filter(event => event.type === type);
}

describe('extractLinks', () => {
  it('extracts slug and name and decodes escaped apostrophes', () => {
    const html = linkMarkup('weapons', 'gromril-axe', 'Gromril Axe') +
      linkMarkup('weapons', 'grudge-thrower', 'Grudge&#x27;s Thrower');

    expect(extractLinks(html, 'weapons')).toEqual([
      { slug: 'gromril-axe', name: 'Gromril Axe' },
      { slug: 'grudge-thrower', name: "Grudge's Thrower" },
    ]);
  });

  it('ignores duplicate names and links of other sections', () => {
    const html = linkMarkup('weapons', 'halberd', 'Halberd') +
      linkMarkup('weapons', 'halberd-again', 'Halberd') +
      linkMarkup('magic-items', 'sword', 'Sword');

    expect(extractLinks(html, 'weapons')).toEqual([{ slug: 'halberd', name: 'Halberd' }]);
  });

  it('decodes HTML entities beyond the apostrophe, so keys match the literal BSData name', () => {
    const html = linkMarkup('weapons', 'cloak-and-dagger', 'Cloak &amp; Dagger') +
      linkMarkup('special-rules', 'my-will-be-done', '&quot;My Will Be Done!&quot;');

    expect(extractLinks(html, 'weapons')).toEqual([{ slug: 'cloak-and-dagger', name: 'Cloak & Dagger' }]);
    expect(extractLinks(html, 'special-rules')).toEqual([
      { slug: 'my-will-be-done', name: '"My Will Be Done!"' },
    ]);
  });
});

describe('crawlRulesIndex on a successful run', () => {
  const pages = {
    'special-rules': linkMarkup('special-rules', 'killing-blow', 'Killing Blow'),
    weapons: linkMarkup('weapons', 'halberd', 'Halberd'),
  };

  it('indexes every link under its section path with the tracking query', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: SECTIONS,
      derivations: [],
    });

    expect(failures).toEqual([]);
    expect(index).toEqual({
      'Killing Blow': '/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral',
      Halberd: '/weapons/halberd?minimal=true&utm_source=6th-builder&utm_medium=referral',
    });
  });

  it('reports progress per section as it advances', async () => {
    const { events, onEvent } = collectEvents();

    await crawlRulesIndex({ fetchHTML: fakeFetchFrom(pages), sections: SECTIONS, derivations: [], onEvent });

    expect(events[0]).toMatchObject({ type: CrawlEvent.RunStarted, sectionCount: 2 });
    expect(eventsOfType(events, CrawlEvent.SectionStarted)).toMatchObject([
      { section: 'special-rules', sectionNumber: 1, sectionCount: 2 },
      { section: 'weapons', sectionNumber: 2, sectionCount: 2 },
    ]);
    expect(eventsOfType(events, CrawlEvent.SectionCompleted)).toMatchObject([
      { section: 'special-rules', linkCount: 1, entryCount: 1, sectionNumber: 1 },
      { section: 'weapons', linkCount: 1, entryCount: 2, sectionNumber: 2 },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: CrawlEvent.RunCompleted,
      entryCount: 2,
      failedSections: [],
      ok: true,
    });
  });
});

describe('crawlRulesIndex when a section fails', () => {
  const pages = {
    'special-rules': new Error('HTTP 503 Service Unavailable'),
    weapons: linkMarkup('weapons', 'halberd', 'Halberd'),
  };

  it('keeps the entries of the remaining sections', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: SECTIONS,
      derivations: [],
    });

    expect(Object.keys(index)).toEqual(['Halberd']);
    expect(failures).toEqual([
      { section: 'special-rules', message: 'HTTP 503 Service Unavailable' },
    ]);
  });

  it('reports the failure cause and completes the run as not ok', async () => {
    const { events, onEvent } = collectEvents();

    await crawlRulesIndex({ fetchHTML: fakeFetchFrom(pages), sections: SECTIONS, derivations: [], onEvent });

    expect(eventsOfType(events, CrawlEvent.SectionFailed)).toMatchObject([
      { section: 'special-rules', message: 'HTTP 503 Service Unavailable', sectionNumber: 1 },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: CrawlEvent.RunCompleted,
      entryCount: 1,
      failedSections: ['special-rules'],
      ok: false,
    });
  });
});

describe('crawlRulesIndex when a section yields no links', () => {
  it('treats the empty section as a failure instead of passing silently', async () => {
    const { events, onEvent } = collectEvents();
    const pages = {
      'special-rules': '<main>Kein Link hier</main>',
      weapons: linkMarkup('weapons', 'halberd', 'Halberd'),
    };

    const { failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: SECTIONS,
      derivations: [],
      onEvent,
    });

    expect(failures).toEqual([{ section: 'special-rules', message: EMPTY_SECTION_MESSAGE }]);
    expect(events.at(-1)).toMatchObject({ ok: false, failedSections: ['special-rules'] });
  });
});

describe('crawlRulesIndex when every section fails', () => {
  it('yields an empty index and reports every section as failed', async () => {
    const { events, onEvent } = collectEvents();
    const pages = {
      'special-rules': new Error('HTTP 500 Internal Server Error'),
      weapons: new Error('network unreachable'),
    };

    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: SECTIONS,
      derivations: [],
      onEvent,
    });

    expect(index).toEqual({});
    expect(failures.map(failure => failure.section)).toEqual(SECTIONS);
    expect(events.at(-1)).toMatchObject({
      type: CrawlEvent.RunCompleted,
      entryCount: 0,
      ok: false,
    });
  });
});

describe('mergeRetainingFailedSections', () => {
  const existingIndex = {
    'Killing Blow': '/special-rules/killing-blow?minimal=true',
    'Old Halberd': '/weapons/old-halberd?minimal=true',
  };

  it('retains the entries of failed sections and replaces the crawled ones', () => {
    const merged = mergeRetainingFailedSections({
      existingIndex,
      crawledIndex: { Halberd: '/weapons/halberd?minimal=true' },
      failedSections: ['special-rules'],
    });

    expect(merged).toEqual({
      'Killing Blow': '/special-rules/killing-blow?minimal=true',
      Halberd: '/weapons/halberd?minimal=true',
    });
  });

  it('drops every previous entry when no section failed', () => {
    const merged = mergeRetainingFailedSections({
      existingIndex,
      crawledIndex: { Halberd: '/weapons/halberd?minimal=true' },
      failedSections: [],
    });

    expect(merged).toEqual({ Halberd: '/weapons/halberd?minimal=true' });
  });
});

describe('addEntry explicit precedence', () => {
  it('does not overwrite a special-rules entry', () => {
    const index = { 'Red Fury': '/special-rules/red-fury?minimal=true' };
    addEntry(index, 'Red Fury', '/magic-item/red-fury?minimal=true');
    expect(index['Red Fury']).toBe('/special-rules/red-fury?minimal=true');
  });

  it('overwrites a non-special-rules entry', () => {
    const index = { 'Sword': '/weapons/sword?minimal=true' };
    addEntry(index, 'Sword', '/magic-item/sword-of-might?minimal=true');
    expect(index['Sword']).toBe('/magic-item/sword-of-might?minimal=true');
  });

  it('adds a fresh entry', () => {
    const index = {};
    addEntry(index, 'Runefang', '/magic-item/runefang?minimal=true');
    expect(index['Runefang']).toBe('/magic-item/runefang?minimal=true');
  });
});

describe('crawlRulesIndex with a two-level derivation', () => {
  const overviewHtml =
    linkMarkup('magic-items', 'common-magic-items', 'Common Magic Items') +
    linkMarkup('magic-items', 'banners', 'Banners');
  const commonPageHtml = linkMarkup('magic-item', 'sword-of-might', 'Sword of Might');
  const bannersPageHtml = linkMarkup('magic-item', 'war-banner', 'War Banner');

  const pages = {
    'magic-items': overviewHtml,
    'common-magic-items': commonPageHtml,
    banners: bannersPageHtml,
  };

  const derivations = [{ sourceSection: 'magic-items', targetSection: 'magic-item' }];

  it('indexes target links from sub-pages alongside regular sections', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: [],
      derivations,
    });

    expect(failures).toEqual([]);
    expect(index).toMatchObject({
      'Sword of Might': expect.stringContaining('/magic-item/sword-of-might'),
      'War Banner': expect.stringContaining('/magic-item/war-banner'),
    });
  });

  it('reports harvest events for every sub-page', async () => {
    const { events, onEvent } = collectEvents();

    await crawlRulesIndex({ fetchHTML: fakeFetchFrom(pages), sections: [], derivations, onEvent });

    expect(eventsOfType(events, CrawlEvent.HarvestStarted)).toMatchObject([
      { sourceSection: 'magic-items', targetSection: 'magic-item', pageCount: 2 },
    ]);
    expect(eventsOfType(events, CrawlEvent.HarvestPageCompleted)).toMatchObject([
      { page: 'common-magic-items', linkCount: 1 },
      { page: 'banners', linkCount: 1 },
    ]);
    expect(eventsOfType(events, CrawlEvent.HarvestCompleted)).toMatchObject([
      { totalLinkCount: 2, failedPages: [] },
    ]);
  });
});

describe('crawlRulesIndex derivation with explicit precedence', () => {
  const pages = {
    'special-rules': linkMarkup('special-rules', 'red-fury', 'Red Fury'),
    'magic-items': linkMarkup('magic-items', 'common-magic-items', 'Common Magic Items'),
    'common-magic-items': linkMarkup('magic-item', 'red-fury', 'Red Fury') +
      linkMarkup('magic-item', 'sword-of-might', 'Sword of Might'),
  };

  const derivations = [{ sourceSection: 'magic-items', targetSection: 'magic-item' }];

  it('keeps special-rules entries when the same name is harvested from a derivation', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: ['special-rules'],
      derivations,
    });

    expect(failures).toEqual([]);
    expect(index['Red Fury']).toMatch(/^\/special-rules\//);
    expect(index['Sword of Might']).toMatch(/^\/magic-item\//);
  });
});

describe('crawlRulesIndex derivation with a failing sub-page', () => {
  const pages = {
    'magic-items': linkMarkup('magic-items', 'common-magic-items', 'Common Magic Items') +
      linkMarkup('magic-items', 'banners', 'Banners'),
    'common-magic-items': linkMarkup('magic-item', 'sword-of-might', 'Sword of Might'),
    banners: new Error('HTTP 500'),
  };

  const derivations = [{ sourceSection: 'magic-items', targetSection: 'magic-item' }];

  it('indexes the successful sub-pages and reports the failures', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: [],
      derivations,
    });

    expect(failures).toEqual([]);
    expect(index['Sword of Might']).toBeDefined();
    expect(Object.keys(index).length).toBe(1);
  });

  it('emits harvest events for both successes and failures', async () => {
    const { events, onEvent } = collectEvents();

    await crawlRulesIndex({ fetchHTML: fakeFetchFrom(pages), sections: [], derivations, onEvent });

    const completed = eventsOfType(events, CrawlEvent.HarvestPageCompleted);
    const failed = eventsOfType(events, CrawlEvent.HarvestPageFailed);
    expect(completed).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ page: 'common-magic-items', linkCount: 1 });
    expect(failed[0]).toMatchObject({ page: 'banners' });
  });
});

describe('mergeRetainingFailedSections with derivations', () => {
  const existingIndex = {
    'Sword of Might': '/magic-item/sword-of-might?minimal=true',
    'War Banner': '/magic-item/war-banner?minimal=true',
  };
  const derivations = [{ sourceSection: 'magic-items', targetSection: 'magic-item' }];

  it('retains entries under the target prefix when the derivation label is in failedSections', () => {
    const merged = mergeRetainingFailedSections({
      existingIndex,
      crawledIndex: {},
      failedSections: ['magic-items → magic-item'],
      derivations,
    });

    expect(merged).toEqual(existingIndex);
  });

  it('drops retained entries when no derivation failed', () => {
    const merged = mergeRetainingFailedSections({
      existingIndex,
      crawledIndex: { 'New Item': '/magic-item/new-item?minimal=true' },
      failedSections: [],
      derivations,
    });

    expect(merged).toEqual({ 'New Item': '/magic-item/new-item?minimal=true' });
  });
});

describe('crawlRulesIndex derivation from root via army pages', () => {
  const rootHtml = linkMarkup('army', 'vampire-counts', 'Vampire Counts') +
    linkMarkup('army', 'bretonnia', 'Bretonnia');
  const vcHtml = linkMarkup('unit', 'chaos-steed', 'Chaos Steed');
  const bretonniaHtml = linkMarkup('unit', 'bretonnian-warhorse', 'Bretonnian Warhorse');
  const pages = {
    '': rootHtml,
    'vampire-counts': vcHtml,
    bretonnia: bretonniaHtml,
  };
  const derivations = [{ sourceSection: '', targetSection: 'unit', subPageSection: 'army' }];

  it('indexes target links from army pages found on the root page', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: [],
      derivations,
    });

    expect(failures).toEqual([]);
    expect(index['Chaos Steed']).toMatch(/^\/unit\//);
    expect(index['Bretonnian Warhorse']).toMatch(/^\/unit\//);
  });

  it('keeps special-rules entries when a unit name collides', async () => {
    const pagesWithCollision = {
      'special-rules': linkMarkup('special-rules', 'steam-tank', 'Steam Tank'),
      '': linkMarkup('army', 'empire', 'Empire'),
      empire: linkMarkup('unit', 'steam-tank', 'Steam Tank'),
    };

    const { index } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pagesWithCollision),
      sections: ['special-rules'],
      derivations,
    });

    expect(index['Steam Tank']).toMatch(/^\/special-rules\//);
  });

  it('continues when a single army page fails', async () => {
    const pagesWithFailure = {
      '': linkMarkup('army', 'vampire-counts', 'Vampire Counts') +
        linkMarkup('army', 'bretonnia', 'Bretonnia'),
      'vampire-counts': vcHtml,
      bretonnia: new Error('HTTP 500'),
    };

    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pagesWithFailure),
      sections: [],
      derivations,
    });

    expect(failures).toEqual([]);
    expect(index['Chaos Steed']).toBeDefined();
    expect(index['Bretonnian Warhorse']).toBeUndefined();
  });
});

describe('crawlRulesIndex derivation for spells', () => {
  const spellListsHtml = linkMarkup('spell-lists', 'the-lore-of-fire', 'The Lore of Fire') +
    linkMarkup('spell-lists', 'the-lore-of-death', 'The Lore of Death');
  const fireHtml = linkMarkup('spell', 'fire-ball', '1. Fire Ball') +
    linkMarkup('spell', 'flaming-sword-of-rhuin', '2. Flaming Sword of Rhuin');
  const deathHtml = linkMarkup('spell', 'dark-hand-of-death', '1. Dark Hand of Death');

  const pages = {
    'spell-lists': spellListsHtml,
    'the-lore-of-fire': fireHtml,
    'the-lore-of-death': deathHtml,
  };

  const derivations = [{ sourceSection: 'spell-lists', targetSection: 'spell' }];

  it('indexes spell pages with their numbered labels preserved', async () => {
    const { index, failures } = await crawlRulesIndex({
      fetchHTML: fakeFetchFrom(pages),
      sections: [],
      derivations,
    });

    expect(failures).toEqual([]);
    expect(index['1. Fire Ball']).toMatch(/^\/spell\/fire-ball/);
    expect(index['2. Flaming Sword of Rhuin']).toMatch(/^\/spell\/flaming-sword-of-rhuin/);
    expect(index['1. Dark Hand of Death']).toMatch(/^\/spell\/dark-hand-of-death/);
  });
});
