// Erzeugt die drei kuratierten Showcase-Screenshots der GitHub-Landing-Page
// (docs/assets/screenshots/showcase_0{1,2,3}_*.png): den Online-Import-Bildschirm
// mit Spielsystem- und Fraktionsauswahl, einen Imperiums-Helden beim Konfigurieren
// seiner Ausrüstung und die Spielansicht mit mehreren Imperiums-Einheiten. Alle drei
// in englischer UI und im Mobil-Format (Telefon-Attrappen der Landing-Page).
//
// Bewusst getrennt vom breiten `generate_screenshots.js`: Jenes belegt jede
// Hauptansicht netzfrei aus der WHFB6-Fixture über den Datei-Upload-Weg. Der
// Showcase braucht dagegen (a) englische UI, (b) echte Imperiums-Daten, die die
// eingefrorene WHFB6-Fixture nicht enthält, und (c) den Online-Bibliothekar mit
// Spielsystem-/Fraktionsauswahl, den nur die Katalog-Quelle (catpkg) rendert — nicht
// der Upload-Weg.
//
// Reproduzierbar und netzfrei: Die zur Laufzeit von der App abgerufenen
// Katalogdateien liegen als eingefrorene Fixture unter
// `scripts/__fixtures__/showcase-empire/` und werden dem Browser per
// Request-Interception unter der GitHub-Raw-URL der ersten Katalog-Quelle
// ausgeliefert (siehe deren README). So bleibt der echte Online-Import-Flow der App
// erhalten, ohne dass der Headless-Browser ins Netz muss.
//
// Ausgabe standardmäßig nach `.screenshots/` (git-ignoriert), per `SCREENSHOT_DIR`
// umlenkbar — die kuratierten Bilder werden bewusst von Hand von dort übernommen.

import fs from 'fs';
import path from 'path';
import {
  REPO_ROOT,
  LAYOUTS,
  startAppServer,
  launchBrowser,
} from './lib/e2e-harness.js';

// Eingefrorene Katalog-Fixture in Upstream-Form; deterministisch und netzfrei.
const FIXTURE_DIR = path.join(REPO_ROOT, 'scripts', '__fixtures__', 'showcase-empire');
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(REPO_ROOT, '.screenshots');

// localStorage-Schlüssel, unter dem die App die manuelle UI-Sprache hält
// (src/i18n/constants.js). Vor dem ersten Skriptlauf gesetzt, startet die App
// unmittelbar auf Englisch.
const LANGUAGE_STORAGE_KEY = 'tome-of-battle.ui-language';

// Host der Katalogdateien. Nur die erste Quelle
// (…/Warhammer-Fantasy-6th-edition/master/…, src/db/catalogUpdate.js) wird gespiegelt;
// die zweite bleibt „unerreichbar" und trägt nichts zur Systemliste bei.
const CATALOG_HOST = 'raw.githubusercontent.com';
const MIRRORED_PATH_MARKER = '/Warhammer-Fantasy-6th-edition/master/';

// Showcase = Telefon-Attrappe der Landing-Page: nur die Mobil-Ansicht.
const LAYOUT = 'mobile';

const SETTLE_MS = 600;
const settle = (ms = SETTLE_MS) => new Promise((resolve) => setTimeout(resolve, ms));

const capture = async (page, name) => {
  await settle();
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath });
  console.log(`Screenshot gespeichert: ${filePath}`);
};

/**
 * Liefert den Rumpf einer gespiegelten Katalog-Rohdatei, oder null, wenn die URL
 * nicht zur ersten (gespiegelten) Quelle gehört bzw. die Datei nicht in der Fixture
 * liegt. Der Pfad wird strikt innerhalb des Fixture-Verzeichnisses aufgelöst.
 * @param {string} url
 * @returns {Buffer | null}
 */
function mirroredFileBody(url) {
  const markerIndex = url.indexOf(MIRRORED_PATH_MARKER);
  if (markerIndex < 0) return null;
  const relative = decodeURIComponent(url.slice(markerIndex + MIRRORED_PATH_MARKER.length).split('?')[0]);
  const filePath = path.join(FIXTURE_DIR, relative);
  if (!filePath.startsWith(FIXTURE_DIR)) return null;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Öffnet eine Seite, die die Katalog-Abrufe der App aus der lokalen Fixture bedient.
 * GitHub-Raw liefert normal `Access-Control-Allow-Origin: *`; ohne diesen Header
 * blockte der Browser die (cross-origin) Antwort per CORS.
 */
async function openShowcasePage(browser) {
  const page = await browser.newPage();
  await page.setViewport(LAYOUTS[LAYOUT].viewport);

  // Vor allen Seiten-Skripten gesetzt: Die App startet direkt auf Englisch.
  await page.evaluateOnNewDocument((key) => {
    try {
      window.localStorage.setItem(key, 'en');
    } catch {
      // Nicht verfügbarer localStorage bricht den Showcase-Lauf nicht.
    }
  }, LANGUAGE_STORAGE_KEY);

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes(CATALOG_HOST)) {
      request.continue();
      return;
    }
    const cors = { 'Access-Control-Allow-Origin': '*' };
    const body = mirroredFileBody(url);
    if (body) {
      const contentType = url.endsWith('.json') ? 'application/json' : 'application/xml';
      request.respond({ status: 200, contentType, headers: cors, body });
    } else {
      request.respond({ status: 404, contentType: 'text/plain', headers: cors, body: 'not mirrored' });
    }
  });

  page.on('pageerror', (err) => console.error(`[Browser] ${err.message}`));
  return page;
}

/**
 * Klickt einen Knopf über sein `data-testid`, optional innerhalb eines Containers.
 * Ein nicht gefundener Knopf ist ein Fehler, kein Grund weiterzulaufen.
 */
async function clickByTestId(page, testId, containerSelector = '') {
  const clicked = await page.evaluate(
    (id, container) => {
      const root = container ? document.querySelector(container) : document;
      const button = /** @type {HTMLElement | null} */ (root && root.querySelector(`[data-testid="${id}"]`));
      if (button) button.click();
      return Boolean(button);
    },
    testId,
    containerSelector,
  );
  if (!clicked) {
    throw new Error(`Kein Element mit data-testid "${testId}"${containerSelector ? ` in ${containerSelector}` : ''} gefunden`);
  }
}

/**
 * Öffnet den Aushebe-Dialog der genannten Kategorie und wählt das i-te verfügbare
 * (nicht blockierte) Angebot. Sprachunabhängig über die Kategorie-Kopfzeile.
 * @returns {Promise<string | null>} der Name der ausgehobenen Einheit, oder null,
 *   wenn die Kategorie oder ein Angebot fehlte.
 */
async function addUnitFromCategory(page, categoryPattern, itemIndex = 0) {
  const opened = await page.evaluate((pattern) => {
    const regex = new RegExp(pattern, 'i');
    const headers = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll('.roster-category-header')));
    for (const header of headers) {
      if (!regex.test(header.textContent || '')) continue;
      const button = /** @type {HTMLElement | null} */ (
        header.querySelector('.category-unit-adder-container button')
        || (header.parentElement && header.parentElement.querySelector('.category-unit-adder-container button'))
      );
      if (button) {
        button.click();
        return true;
      }
    }
    return false;
  }, categoryPattern.source);
  if (!opened) return null;

  await settle(700);
  const name = await page.evaluate((index) => {
    const items = /** @type {HTMLElement[]} */ (
      Array.from(document.querySelectorAll('.popover-item')).filter((item) => !item.classList.contains('disabled'))
    );
    if (items.length === 0) return null;
    const chosen = items[index] || items[0];
    const label = chosen.textContent;
    chosen.click();
    return label;
  }, itemIndex);
  await settle(800);
  return name;
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const server = await startAppServer();
  const browser = await launchBrowser({ layout: LAYOUT });

  try {
    const page = await openShowcasePage(browser);
    await page.goto(server.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // --- Screenshot 1: Online-Bibliothekar mit Spielsystem- und Fraktionsauswahl ---
    await page.waitForSelector('.bundle-importer-panel select', { timeout: 30000 });
    await settle(1200);

    // Das Spielsystem wählen, dessen Fraktionsliste Empire enthält, und in der Liste
    // nur Empire ankreuzen.
    const systemChosen = await page.evaluate(async () => {
      const select = /** @type {HTMLSelectElement} */ (document.querySelector('.bundle-importer-panel select'));
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < select.options.length; i++) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(700);
        const hasEmpire = Array.from(document.querySelectorAll('.bundle-catalog-item-label'))
          .some((label) => /empire/i.test(label.textContent || ''));
        if (hasEmpire) return true;
      }
      return false;
    });
    if (!systemChosen) throw new Error('Kein Spielsystem mit Empire-Fraktion in der Online-Liste');
    await settle(600);

    // Alle vorausgewählten Fraktionen abwählen, dann nur Empire ankreuzen.
    await page.evaluate(() => {
      const anyChecked = () =>
        /** @type {HTMLInputElement[]} */ (Array.from(document.querySelectorAll('.bundle-catalog-item-label input')))
          .some((checkbox) => checkbox.checked);
      const toggle = /** @type {HTMLElement | null} */ (document.querySelector('.bundle-importer-header .btn-gold'));
      if (toggle && anyChecked()) toggle.click();
    });
    await settle(400);
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('.bundle-catalog-item-label'))
        .find((item) => /empire/i.test(item.textContent || ''));
      const checkbox = /** @type {HTMLInputElement | null} */ (label && label.querySelector('input[type="checkbox"]'));
      if (checkbox && !checkbox.checked) checkbox.click();
    });
    await settle(700);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, 'showcase_01_system_selection');

    // --- Empire importieren ---
    await page.evaluate(() => {
      const importButton = /** @type {HTMLButtonElement | null} */ (document.querySelector('.bundle-importer-actions .btn-primary'));
      if (importButton) importButton.click();
    });
    await page.waitForSelector('.mobile-bottom-nav', { timeout: 60000 });
    await settle(1500);

    // --- Armeeliste anlegen ---
    await clickByTestId(page, 'nav-rosters', '.mobile-bottom-nav');
    await settle(1000);
    await clickByTestId(page, 'new-roster');
    await page.waitForSelector('form input[type="text"]', { visible: true, timeout: 8000 });
    await settle(500);
    await page.type('form input[type="text"]', 'Army of the Empire');
    await page.evaluate(() => {
      const systemSelect = /** @type {HTMLSelectElement} */ (document.querySelectorAll('form select')[0]);
      if (systemSelect && systemSelect.options.length > 1) {
        systemSelect.selectedIndex = 1;
        systemSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await settle(600);
    await page.evaluate(() => {
      const catalogueSelect = /** @type {HTMLSelectElement} */ (document.querySelectorAll('form select')[1]);
      if (!catalogueSelect) return;
      const empireIndex = Array.from(catalogueSelect.options).findIndex((option) => /empire/i.test(option.textContent || ''));
      catalogueSelect.selectedIndex = empireIndex >= 0 ? empireIndex : Math.min(1, catalogueSelect.options.length - 1);
      catalogueSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle(500);
    await page.evaluate(() => {
      const submit = /** @type {HTMLButtonElement | undefined} */ (
        Array.from(document.querySelectorAll('form button')).find((button) => /** @type {HTMLButtonElement} */ (button).type === 'submit')
      );
      if (submit) submit.click();
    });
    await page.waitForSelector('.builder-layout', { timeout: 15000 });
    await settle(1200);

    // --- Screenshot 2: Imperiums-Held beim Konfigurieren seiner Ausrüstung ---
    const hero = (await addUnitFromCategory(page, /Lord/, 0))
      || (await addUnitFromCategory(page, /Hero/, 0))
      || (await addUnitFromCategory(page, /Character/, 0));
    if (!hero) throw new Error('Kein Imperiums-Held aushebbar');
    // Die Einheitenkarte aufklappen, damit Werte und der Ausrüstungs-Konfigurator sichtbar sind.
    await page.evaluate(() => {
      const toggle = /** @type {HTMLElement | null} */ (document.querySelector('.unit-card-details-toggle'));
      if (toggle) toggle.click();
    });
    await settle(900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(400);
    await capture(page, 'showcase_02_unit_item_selection');

    // Weitere Imperiums-Einheiten für eine gefüllte Spielansicht.
    await addUnitFromCategory(page, /Core/, 0);
    await addUnitFromCategory(page, /Core/, 1);
    await addUnitFromCategory(page, /Core/, 2);
    await addUnitFromCategory(page, /Hero/, 0);
    await addUnitFromCategory(page, /Special/, 0);

    // --- Screenshot 3: Spielansicht mit mehreren Imperiums-Einheiten ---
    await clickByTestId(page, 'nav-rosters', '.mobile-bottom-nav');
    await page.waitForSelector('.roster-card', { timeout: 12000 });
    await settle(700);
    const startedPlayMode = await page.evaluate(() => {
      const card = document.querySelector('.roster-card');
      const playButton = /** @type {HTMLElement | null} */ (card && card.querySelector('[data-testid="roster-play"]'));
      if (playButton) playButton.click();
      return Boolean(playButton);
    });
    if (!startedPlayMode) throw new Error('Kein Knopf zum Starten des Spielmodus gefunden');
    await page.waitForSelector('.play-layout', { timeout: 12000 });
    await settle(700);
    await page.evaluate(() => {
      /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll('.play-layout .unit-card-details-toggle')))
        .forEach((toggle) => toggle.click());
    });
    await settle(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(400);
    await capture(page, 'showcase_03_play_mode_long');

    console.log(`\nAlle Showcase-Screenshots erzeugt in: ${SCREENSHOT_DIR}`);
  } finally {
    await browser.close();
    server.stop();
  }
}

run().catch((error) => {
  console.error('Showcase-Screenshot-Lauf fehlgeschlagen:', error);
  process.exit(1);
});
