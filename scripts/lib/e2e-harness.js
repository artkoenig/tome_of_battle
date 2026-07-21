// Gemeinsamer Setup-Pfad für alle Puppeteer-Werkzeuge dieses Repositories: den
// E2E-Smoke-Test (src/solver/ui.test.js) und das Screenshot-Skript
// (scripts/generate_screenshots.js).
//
// Warum als eigenes Modul: Dieser Ablauf existierte zuvor dreifach kopiert, und
// nur eine Kopie wurde bei der Umstellung auf das externe Katalog-Fork-Repo
// (ADR 0014/0020) nachgezogen — die beiden anderen liefen danach überhaupt nicht
// mehr. Eine einzige Fassung kann nicht mehr auseinanderdriften.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Alle Pfade werden aus dem Modulstandort abgeleitet, nicht aus dem aktuellen
// Arbeitsverzeichnis: so laufen die Werkzeuge unabhängig davon, aus welchem
// Verzeichnis sie gestartet wurden.
export const REPO_ROOT = path.resolve(HARNESS_DIR, '..', '..');

// Eingefrorene Katalog-Fixture in Upstream-Form (siehe deren README). Bewusst
// entkoppelt von den zur Laufzeit über das Netz bezogenen Katalogdaten, damit
// jeder Lauf deterministisch und netzfrei bleibt.
const FIXTURE_DIR = path.join(REPO_ROOT, 'src', 'solver', '__fixtures__', 'whfb6');
const CATALOG_FILE_EXTENSIONS = ['.cat', '.gst'];

// Die App stößt beim Start still ein Katalog-Update gegen diesen Host an. Für
// einen deterministischen, netzfreien Lauf wird der Abruf abgebrochen; die App
// behält dann unverändert die Fixture-Daten.
const CATALOG_UPDATE_HOST = 'raw.githubusercontent.com';

const INDEXED_DB_NAME = 'TomeOfBattleDB';

export const DEFAULT_PREVIEW_PORT = 5175;

const SERVER_STARTUP_TIMEOUT_MS = 15_000;
const SYSTEM_IMPORT_TIMEOUT_MS = 30_000;
const FILE_UPLOAD_TIMEOUT_MS = 5_000;

// Ansichtsgrößen und der jeweils erst nach erfolgreichem Import gerenderte
// Navigationsbereich — das Signal dafür, dass der XML-Parse durch ist.
export const LAYOUTS = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    navReadySelector: '.desktop-nav-actions',
  },
  mobile: {
    viewport: { width: 375, height: 812, isMobile: true, hasTouch: true },
    navReadySelector: '.mobile-bottom-nav',
  },
};

/**
 * Liefert die Namen aller Katalogdateien eines Verzeichnisses, alphabetisch
 * sortiert, damit das erzeugte ZIP-Archiv reproduzierbar ist.
 */
export function collectCatalogFileNames(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Fixture-Verzeichnis nicht gefunden: ${directory}`);
  }
  const fileNames = fs
    .readdirSync(directory)
    .filter((fileName) => CATALOG_FILE_EXTENSIONS.includes(path.extname(fileName)))
    .sort();

  if (fileNames.length === 0) {
    throw new Error(`Keine ${CATALOG_FILE_EXTENSIONS.join('/')}-Dateien in: ${directory}`);
  }
  return fileNames;
}

/**
 * Verpackt die Fixture zu einem ZIP-Archiv, das die App wie einen normalen
 * Benutzer-Upload importiert. Landet im Temp-Verzeichnis des Systems, damit ein
 * abgebrochener Lauf keine Datei im Repository zurücklässt.
 */
async function packFixtureZip() {
  const fileNames = collectCatalogFileNames(FIXTURE_DIR);
  const zip = new JSZip();
  for (const fileName of fileNames) {
    zip.file(fileName, fs.readFileSync(path.join(FIXTURE_DIR, fileName)));
  }

  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tome-of-battle-e2e-'));
  const zipPath = path.join(targetDir, 'whfb6-fixture.zip');
  fs.writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));

  console.log(`Fixture verpackt (${fileNames.length} Dateien): ${zipPath}`);
  return zipPath;
}

const spawnVite = (args) => spawn('npx', ['vite', ...args], { shell: true, cwd: REPO_ROOT });

/**
 * Erzeugt einmalig einen Produktions-Build. Bewusst kein Dev-Server: der
 * transpiliert den Modulgraphen erst beim ersten Seitenaufruf on-demand, was auf
 * kalten CI-Runnern unter Last die Import-Warteschwelle überschritt und den Lauf
 * reproduzierbar riss (siehe ADR 0006).
 */
function buildApp() {
  return new Promise((resolve, reject) => {
    console.log('Erzeuge Produktions-Build (vite build)...');
    const proc = spawnVite(['build']);
    proc.stdout.on('data', (data) => console.log(`[vite build] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => console.error(`[vite build] ${data.toString().trim()}`));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`vite build endete mit Code ${code}`));
      }
    });
  });
}

function startPreviewServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`Liefere Build über vite preview auf Port ${port} aus...`);
    const proc = spawnVite(['preview', '--port', String(port), '--strictPort']);

    let settled = false;
    const settle = (action) => {
      if (settled) return;
      settled = true;
      action();
    };

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[vite preview] ${output.trim()}`);
      if (output.includes(String(port)) || output.includes('Local:')) {
        settle(() => resolve(proc));
      }
    });
    proc.stderr.on('data', (data) => console.error(`[vite preview] ${data.toString().trim()}`));
    proc.on('error', (err) => settle(() => reject(err)));

    setTimeout(() => {
      settle(() => {
        console.log('Startmeldung des Preview-Servers blieb aus, fahre trotzdem fort.');
        resolve(proc);
      });
    }, SERVER_STARTUP_TIMEOUT_MS);
  });
}

/**
 * Macht die App unter einer URL erreichbar: Fixture verpacken, Produktions-Build
 * erzeugen, statisch ausliefern. Das zurückgegebene `stop` räumt Server und
 * temporäres Archiv wieder ab.
 */
export async function startAppServer({ port = DEFAULT_PREVIEW_PORT } = {}) {
  const fixtureZipPath = await packFixtureZip();
  const discardFixtureZip = () =>
    fs.rmSync(path.dirname(fixtureZipPath), { recursive: true, force: true });

  let serverProcess;
  try {
    await buildApp();
    serverProcess = await startPreviewServer(port);
  } catch (error) {
    // Scheitert der Aufbau, bleibt sonst ein verwaistes Temp-Archiv zurück.
    discardFixtureZip();
    throw error;
  }

  return {
    url: `http://localhost:${port}/`,
    fixtureZipPath,
    stop: () => {
      serverProcess.kill('SIGTERM');
      discardFixtureZip();
    },
  };
}

/**
 * `headed: true` zeigt den Browser sichtbar an — zum Zuschauen beim Debuggen.
 */
export function launchBrowser({ layout = 'desktop', headed = false } = {}) {
  return puppeteer.launch({
    headless: !headed,
    defaultViewport: LAYOUTS[layout].viewport,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/**
 * Öffnet eine Seite mit gesperrtem Katalog-Update-Abruf. Ist `consoleLogPath`
 * gesetzt, wird die vollständige Browser-Konsole samt Fehler-Stacktraces
 * mitgeschnitten; ohne den Pfad gehen nur Fehler nach stderr.
 */
export async function openAppPage(browser, { consoleLogPath = null } = {}) {
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes(CATALOG_UPDATE_HOST)) {
      request.abort();
    } else {
      request.continue();
    }
  });

  if (consoleLogPath) {
    fs.mkdirSync(path.dirname(consoleLogPath), { recursive: true });
    fs.writeFileSync(consoleLogPath, '--- BROWSER-KONSOLE ---\n');
    const append = (line) => fs.appendFileSync(consoleLogPath, `${line}\n`);
    page.on('console', (msg) => append(`[${msg.type().toUpperCase()}] ${msg.text()}`));
    page.on('pageerror', (err) => append(`[PAGEERROR] ${err.stack || err.message}`));
  } else {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[Browser] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.error(`[Browser] ${err.stack || err.message}`));
  }

  return page;
}

/**
 * Versetzt die App in den Auslieferungszustand eines unbenutzten Browsers:
 * IndexedDB gelöscht, Seite neu geladen.
 */
export async function resetAppState(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.evaluate(
    (dbName) =>
      new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = resolve;
        request.onerror = resolve;
        request.onblocked = resolve;
      }),
    INDEXED_DB_NAME,
  );
  await page.reload({ waitUntil: 'networkidle2' });
}

/**
 * Importiert das Spielsystem über denselben Upload-Weg, den auch ein Benutzer
 * nimmt, und wartet, bis der XML-Parse durch ist.
 */
export async function importFixtureSystem(page, { fixtureZipPath, layout = 'desktop' }) {
  // Nach dem Zurücksetzen zeigt die App den leeren Bibliothekar bereits selbst;
  // steht sie doch auf einer anderen Ansicht, führt der Kopfzeilen-Knopf hin.
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('header button'))
      .find((b) => b.textContent.toLowerCase().includes('bibliothekar'));
    if (button) button.click();
  });

  await page.waitForSelector('#file-upload', { timeout: FILE_UPLOAD_TIMEOUT_MS });
  const fileInput = await page.$('#file-upload');
  if (!fileInput) {
    throw new Error('Datei-Eingabefeld #file-upload nicht gefunden');
  }
  await fileInput.uploadFile(fixtureZipPath);

  console.log('Warte auf Import und Parsen des Spielsystems...');
  await page.waitForSelector(LAYOUTS[layout].navReadySelector, { timeout: SYSTEM_IMPORT_TIMEOUT_MS });
  console.log('Spielsystem importiert.');
}

/**
 * Schreibt das gerenderte DOM eines Ausschnitts in eine Datei — zum Nachsehen,
 * was die App tatsächlich ausgegeben hat.
 */
export async function dumpElementHtml(page, { selector, filePath }) {
  const html = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    return element ? element.innerHTML : null;
  }, selector);

  if (html === null) {
    throw new Error(`Kein Element für Selektor "${selector}" gefunden`);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
  console.log(`DOM-Ausgabe gespeichert: ${filePath}`);
}
