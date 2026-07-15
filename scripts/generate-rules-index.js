/**
 * CLI entry point for the rules crawl.
 *
 * Default output is human readable. With `--events` every crawl event is
 * written to stdout as one JSON object per line (NDJSON), which the rules
 * editor consumes to render live progress and to persist a run log.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CrawlEvent,
  crawlRulesIndex,
  DERIVATIONS,
  mergeRetainingFailedSections,
} from './rules-crawler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(__dirname, '..', 'src', 'data', 'rules-index.json');
const EVENTS_FLAG = '--events';

function formatHumanLine(event) {
  switch (event.type) {
    case CrawlEvent.RunStarted:
      return `Crawle ${event.sectionCount} Schritte (${event.sections.length} Sections, ${event.derivationCount} Ableitungen) ...`;
    case CrawlEvent.SectionStarted:
      return `[${event.sectionNumber}/${event.sectionCount}] ${event.section} ...`;
    case CrawlEvent.SectionCompleted:
      return `[${event.sectionNumber}/${event.sectionCount}] ${event.section}: ${event.linkCount} Links`;
    case CrawlEvent.SectionFailed:
      return `[${event.sectionNumber}/${event.sectionCount}] ${event.section}: FEHLER – ${event.message}`;
    case CrawlEvent.HarvestStarted:
      return `  → Ernte aus ${event.pageCount} Seiten (${event.sourceSection} → ${event.targetSection})`;
    case CrawlEvent.HarvestPageCompleted:
      return `    ${event.page}: ${event.linkCount} Links (${event.totalLinkCount} gesamt)`;
    case CrawlEvent.HarvestPageFailed:
      return `    ${event.page}: FEHLER – ${event.message}`;
    case CrawlEvent.HarvestCompleted:
      return `  → Fertig: ${event.totalLinkCount} Einträge, ${event.failedPages.length} fehlgeschlagen`;
    case CrawlEvent.RunCompleted:
      return `Fertig: ${event.entryCount} Einträge, ${event.failedSections.length} fehlgeschlagene Schritte`;
    default:
      return null;
  }
}

function createHumanReporter(log = console.log) {
  return event => {
    const line = formatHumanLine(event);
    if (line !== null) log(line);
  };
}

function createEventReporter(write = line => process.stdout.write(line)) {
  return event => write(JSON.stringify({ ...event, timestamp: new Date().toISOString() }) + '\n');
}

function readExistingIndex(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function writeIndex(file, index) {
  writeFileSync(file, JSON.stringify(index, null, 2) + '\n');
}

async function main() {
  const emitEvents = process.argv.includes(EVENTS_FLAG);
  const onEvent = emitEvents ? createEventReporter() : createHumanReporter();

  const { index, failures } = await crawlRulesIndex({ onEvent });
  const failedSections = failures.map(failure => failure.section);

  if (Object.keys(index).length === 0) {
    throw new Error('Alle Sections fehlgeschlagen – rules-index.json bleibt unverändert.');
  }

  const merged = mergeRetainingFailedSections({
    existingIndex: readExistingIndex(OUT_FILE),
    crawledIndex: index,
    failedSections,
    derivations: DERIVATIONS,
  });
  writeIndex(OUT_FILE, merged);

  if (!emitEvents) {
    console.log(`Wrote ${Object.keys(merged).length} entries to ${OUT_FILE}`);
  }
  return failures.length === 0;
}

main()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(error => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
