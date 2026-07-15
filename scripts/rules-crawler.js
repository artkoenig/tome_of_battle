/**
 * Crawls the rule sections of 6th.whfb.app and builds the name → URL-path index.
 *
 * The crawl is expressed as a stream of events so that callers can render
 * progress, persist a log, or format CLI output without this module knowing
 * about any of them. Fetching is injected, which keeps the crawl testable
 * without network access.
 */

export const BASE_URL = 'https://6th.whfb.app';
export const SECTIONS = ['special-rules', 'weapons', 'magic-items', 'spell-lists', 'characteristics'];

const UTM_PARAMS = 'utm_source=6th-builder&utm_medium=referral';
const RULE_QUERY = `minimal=true&${UTM_PARAMS}`;

export const CrawlEvent = {
  RunStarted: 'run-started',
  SectionStarted: 'section-started',
  SectionCompleted: 'section-completed',
  SectionFailed: 'section-failed',
  RunCompleted: 'run-completed',
};

export const EMPTY_SECTION_MESSAGE = 'Section lieferte keine Links – Markup der Quelle geändert?';

export function sectionUrl(section) {
  return `${BASE_URL}/${section}`;
}

export function rulePath(section, slug) {
  return `/${section}/${slug}?${RULE_QUERY}`;
}

export async function fetchSectionHTML(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} für ${url}`);
  }
  return response.text();
}

export function extractLinks(html, section) {
  const pattern = new RegExp(`<a\\s+href="/${section}/([^"]+)"[^>]*>([^<]+)</a>`, 'gi');
  const links = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[2].replace(/&#x27;/g, "'").trim();
    if (!links.some(link => link.name === name)) {
      links.push({ slug: match[1], name });
    }
  }
  return links;
}

async function crawlSection(section, fetchHTML) {
  const html = await fetchHTML(sectionUrl(section));
  const links = extractLinks(html, section);
  if (links.length === 0) {
    throw new Error(EMPTY_SECTION_MESSAGE);
  }
  return links;
}

/**
 * Crawls every section, tolerating per-section failures so that one broken
 * section cannot discard the results of the others.
 *
 * @returns {Promise<{index: Record<string,string>, failures: Array<{section: string, message: string}>}>}
 */
export async function crawlRulesIndex({
  fetchHTML = fetchSectionHTML,
  onEvent = () => {},
  sections = SECTIONS,
} = {}) {
  const index = {};
  const failures = [];
  const sectionCount = sections.length;

  onEvent({ type: CrawlEvent.RunStarted, sections, sectionCount });

  for (const [position, section] of sections.entries()) {
    const sectionNumber = position + 1;
    onEvent({
      type: CrawlEvent.SectionStarted,
      section,
      url: sectionUrl(section),
      sectionNumber,
      sectionCount,
    });

    try {
      const links = await crawlSection(section, fetchHTML);
      for (const { name, slug } of links) {
        index[name] = rulePath(section, slug);
      }
      onEvent({
        type: CrawlEvent.SectionCompleted,
        section,
        linkCount: links.length,
        entryCount: Object.keys(index).length,
        sectionNumber,
        sectionCount,
      });
    } catch (error) {
      failures.push({ section, message: error.message });
      onEvent({
        type: CrawlEvent.SectionFailed,
        section,
        message: error.message,
        sectionNumber,
        sectionCount,
      });
    }
  }

  onEvent({
    type: CrawlEvent.RunCompleted,
    entryCount: Object.keys(index).length,
    sectionCount,
    failedSections: failures.map(failure => failure.section),
    failures,
    ok: failures.length === 0,
  });

  return { index, failures };
}

/**
 * Builds the index to persist after a partially failed crawl: freshly crawled
 * sections replace their previous entries, while the entries of failed sections
 * are retained from the existing index instead of being silently dropped.
 */
export function mergeRetainingFailedSections({ existingIndex, crawledIndex, failedSections }) {
  const retained = Object.entries(existingIndex).filter(([, path]) =>
    failedSections.some(section => path.startsWith(`/${section}/`)),
  );
  return { ...Object.fromEntries(retained), ...crawledIndex };
}
