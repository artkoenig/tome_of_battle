/**
 * Crawls the rule sections of 6th.whfb.app and builds the name → URL-path index.
 *
 * The crawl is expressed as a stream of events so that callers can render
 * progress, persist a log, or format CLI output without this module knowing
 * about any of them. Fetching is injected, which keeps the crawl testable
 * without network access.
 */

export const BASE_URL = 'https://6th.whfb.app';

/**
 * Every section whose overview page `/<section>` links its rule pages as
 * `/<section>/<slug>`. Psychology rules (Fear, Terror, Hatred, …) live under
 * `psychology` and are not linked from `special-rules`, which is why they were
 * missing from the index.
 */
export const SECTIONS = [
  'special-rules',
  'weapons',
  'magic-items',
  'spell-lists',
  'characteristics',
  'psychology',
  'units',
  'chariots',
  'movement',
  'close-combat',
];

/**
 * Derived (two-level) sections: the crawler first fetches the overview page
 * of `sourceSection`, extracts sub-page slugs from it, fetches each sub-page,
 * and extracts target entries matching `targetSection`. The same mechanism can
 * be extended for `/unit` (via army pages) and `/spell` (via lore pages)
 * without additional logic.
 *
 * When `subPageSection` is set, it is used instead of `sourceSection` both
 * for extracting sub-page links (the regex pattern) and for constructing the
 * sub-page URL. This supports sources like the root page `/` that link to
 * `/army/<slug>` (where `subPageSection: 'army'`).
 */
export const DERIVATIONS = [
  { sourceSection: 'magic-items', targetSection: 'magic-item' },
  { sourceSection: '', targetSection: 'unit', subPageSection: 'army' },
  { sourceSection: 'spell-lists', targetSection: 'spell' },
];

const UTM_PARAMS = 'utm_source=6th-builder&utm_medium=referral';
const RULE_QUERY = `minimal=true&${UTM_PARAMS}`;

export const CrawlEvent = {
  RunStarted: 'run-started',
  SectionStarted: 'section-started',
  SectionCompleted: 'section-completed',
  SectionFailed: 'section-failed',
  HarvestStarted: 'harvest-started',
  HarvestPageCompleted: 'harvest-page-completed',
  HarvestPageFailed: 'harvest-page-failed',
  HarvestCompleted: 'harvest-completed',
  RunCompleted: 'run-completed',
};

export const EMPTY_SECTION_MESSAGE = 'Section lieferte keine Links – Markup der Quelle geändert?';

export function sectionUrl(section) {
  return section ? `${BASE_URL}/${section}` : BASE_URL;
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

// The ToC anchors carry HTML-escaped rule names (e.g. "Cloak &amp; Dagger",
// "&quot;My Will Be Done!&quot;"). Names are the lookup keys matched against the
// literal BSData entries, so every entity must be decoded — otherwise the entry
// can never resolve. `&amp;` is decoded last so it does not double-decode.
function decodeEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

export function extractLinks(html, section) {
  const pattern = new RegExp(`<a\\s+href="/${section}/([^"]+)"[^>]*>([^<]+)</a>`, 'gi');
  const links = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = decodeEntities(match[2]).trim();
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

export function addEntry(index, name, path) {
  if (index[name] && index[name].startsWith('/special-rules/')) {
    return;
  }
  index[name] = path;
}

async function crawlDerivedSection(derivation, fetchHTML, onEvent, sectionNumber, sectionCount) {
  const { sourceSection, targetSection, subPageSection } = derivation;
  const subPagePrefix = subPageSection || sourceSection;
  const overviewHtml = await fetchHTML(sectionUrl(sourceSection));
  const subPages = extractLinks(overviewHtml, subPagePrefix);

  if (subPages.length === 0) {
    throw new Error(EMPTY_SECTION_MESSAGE);
  }

  onEvent({
    type: CrawlEvent.HarvestStarted,
    sourceSection,
    targetSection,
    subPageSection: subPagePrefix,
    pageCount: subPages.length,
    sectionNumber,
    sectionCount,
  });

  const links = [];
  const harvestFailures = [];

  for (const subPage of subPages) {
    try {
      const subUrl = `${BASE_URL}/${subPagePrefix}/${subPage.slug}`;
      const subHtml = await fetchHTML(subUrl);
      const targetLinks = extractLinks(subHtml, targetSection);
      links.push(...targetLinks);
      onEvent({
        type: CrawlEvent.HarvestPageCompleted,
        sourceSection,
        targetSection,
        page: subPage.slug,
        label: subPage.name,
        url: subUrl,
        linkCount: targetLinks.length,
        totalLinkCount: links.length,
        sectionNumber,
        sectionCount,
      });
    } catch (error) {
      harvestFailures.push({ slug: subPage.slug, label: subPage.name, message: error.message });
      onEvent({
        type: CrawlEvent.HarvestPageFailed,
        sourceSection,
        targetSection,
        page: subPage.slug,
        label: subPage.name,
        message: error.message,
        sectionNumber,
        sectionCount,
      });
    }
  }

  onEvent({
    type: CrawlEvent.HarvestCompleted,
    sourceSection,
    targetSection,
    totalLinkCount: links.length,
    failedPages: harvestFailures,
    sectionNumber,
    sectionCount,
  });

  return { links, harvestFailures };
}

/**
 * Crawls every section (both single-level and derived two-level), tolerating
 * per-section failures so that one broken section cannot discard the results
 * of the others.
 *
 * @param {object} options
 * @param {typeof fetchSectionHTML} [options.fetchHTML]
 * @param {(event: object) => void} [options.onEvent]
 * @param {string[]} [options.sections] - Single-level sections to crawl
 * @param {Array<{sourceSection: string, targetSection: string}>} [options.derivations]
 * @returns {Promise<{index: Record<string,string>, failures: Array<{section: string, message: string}>}>}
 */
export async function crawlRulesIndex({
  fetchHTML = fetchSectionHTML,
  onEvent = () => {},
  sections = SECTIONS,
  derivations = DERIVATIONS,
} = {}) {
  const index = /** @type {Record<string, string>} */ ({});
  const failures = [];
  const sectionCount = sections.length + derivations.length;

  onEvent({ type: CrawlEvent.RunStarted, sections, sectionCount, derivationCount: derivations.length });

  let position = 0;

  for (const section of sections) {
    const sectionNumber = ++position;
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
        addEntry(index, name, rulePath(section, slug));
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

  for (const derivation of derivations) {
    const sectionNumber = ++position;
    const label = derivation.sourceSection
      ? `${derivation.sourceSection} → ${derivation.targetSection}`
      : `start → ${derivation.targetSection}`;
    onEvent({
      type: CrawlEvent.SectionStarted,
      section: label,
      url: sectionUrl(derivation.sourceSection),
      sectionNumber,
      sectionCount,
    });

    try {
      const result = await crawlDerivedSection(derivation, fetchHTML, onEvent, sectionNumber, sectionCount);
      for (const { name, slug } of result.links) {
        addEntry(index, name, rulePath(derivation.targetSection, slug));
      }
      onEvent({
        type: CrawlEvent.SectionCompleted,
        section: label,
        linkCount: result.links.length,
        entryCount: Object.keys(index).length,
        sectionNumber,
        sectionCount,
        harvestFailures: result.harvestFailures,
      });
    } catch (error) {
      failures.push({ section: label, message: error.message });
      onEvent({
        type: CrawlEvent.SectionFailed,
        section: label,
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
 *
 * For derivations, the `targetSection` is used as the path prefix to match
 * retained entries (e.g. a failed `magic-items → magic-item` derivation
 * retains entries starting with `/magic-item/`).
 */
export function mergeRetainingFailedSections({ existingIndex, crawledIndex, failedSections, derivations = [] }) {
  const derivationPrefixes = new Map(
    derivations.map(d => {
      const label = d.sourceSection
        ? `${d.sourceSection} → ${d.targetSection}`
        : `start → ${d.targetSection}`;
      return [label, d.targetSection];
    }),
  );

  const retained = Object.entries(existingIndex).filter(([, path]) =>
    failedSections.some(section => {
      const prefix = derivationPrefixes.get(section) || section;
      return path.startsWith(`/${prefix}/`);
    }),
  );
  return { ...Object.fromEntries(retained), ...crawledIndex };
}
