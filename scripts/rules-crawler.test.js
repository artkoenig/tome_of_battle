import { describe, it, expect } from 'vitest';
import {
  CrawlEvent,
  EMPTY_SECTION_MESSAGE,
  crawlRulesIndex,
  extractLinks,
  mergeRetainingFailedSections,
} from './rules-crawler.js';

const SECTIONS = ['special-rules', 'weapons'];

function linkMarkup(section, slug, label) {
  return `<a href="/${section}/${slug}" class="rule">${label}</a>`;
}

function fakeFetchFrom(pagesBySection) {
  return async url => {
    const section = url.split('/').pop();
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
    });

    expect(failures).toEqual([]);
    expect(index).toEqual({
      'Killing Blow': '/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral',
      Halberd: '/weapons/halberd?minimal=true&utm_source=6th-builder&utm_medium=referral',
    });
  });

  it('reports progress per section as it advances', async () => {
    const { events, onEvent } = collectEvents();

    await crawlRulesIndex({ fetchHTML: fakeFetchFrom(pages), sections: SECTIONS, onEvent });

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
    });

    expect(Object.keys(index)).toEqual(['Halberd']);
    expect(failures).toEqual([
      { section: 'special-rules', message: 'HTTP 503 Service Unavailable' },
    ]);
  });

  it('reports the failure cause and completes the run as not ok', async () => {
    const { events, onEvent } = collectEvents();

    await crawlRulesIndex({ fetchHTML: fakeFetchFrom(pages), sections: SECTIONS, onEvent });

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
