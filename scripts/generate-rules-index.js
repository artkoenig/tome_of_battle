import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'https://6th.whfb.app';
const UTM = 'utm_source=6th-builder&utm_medium=referral';
const SECTIONS = ['special-rules', 'weapons', 'magic-items', 'spell-lists', 'characteristics'];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(__dirname, '..', 'src', 'data', 'rules-index.json');

async function fetchHTML(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${url}`);
  return res.text();
}

function extractLinks(html, section) {
  const pattern = new RegExp(`<a\\s+href="/${section}/([^"]+)"[^>]*>([^<]+)</a>`, 'gi');
  const links = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[2].replace(/&#x27;/g, "'").trim();
    if (!links.some(l => l.name === name)) {
      links.push({ slug: match[1], name });
    }
  }
  return links;
}

async function main() {
  const index = {};

  for (const section of SECTIONS) {
    const html = await fetchHTML(`${BASE_URL}/${section}`);
    const links = extractLinks(html, section);

    for (const { name, slug } of links) {
      index[name] = `/${section}/${slug}?minimal=true&${UTM}`;
    }
  }

  writeFileSync(OUT_FILE, JSON.stringify(index, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(index).length} entries to ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
