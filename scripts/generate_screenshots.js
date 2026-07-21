// Erzeugt Screenshots der wichtigsten Ansichten in Desktop- und Mobil-Größe.
// Belegt UI-sichtbare Änderungen (siehe CLAUDE.md und ADR 0006).
//
// Läuft netzfrei und ohne Katalogdaten im Repository: Aufbau und Datenquelle
// kommen aus dem gemeinsamen E2E-Harness, das sich auch der Smoke-Test teilt.

import fs from 'fs';
import path from 'path';
import {
  REPO_ROOT,
  LAYOUTS,
  startAppServer,
  launchBrowser,
  openAppPage,
  resetAppState,
  importFixtureSystem,
} from './lib/e2e-harness.js';

// Standardmäßig repo-lokal und git-ignoriert; per Umgebungsvariable umlenkbar.
//
// Bewusst NICHT das versionierte `screenshots/`: dort liegen die kuratierten
// Bilder der README. Ein netzfreier Lauf erreicht den Katalog-Index nicht und
// zeigt daher den Offline-Hinweis — korrekt zur Verifikation, aber nichts, was
// ungefragt in das Schaufenster des Projekts geschrieben werden darf. Wer die
// README-Bilder erneuern will, kopiert die gewünschten Dateien bewusst hinüber.
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(REPO_ROOT, '.screenshots');

// Wartezeit, bis Layout und Übergänge zur Ruhe gekommen sind, bevor ausgelöst wird.
const SETTLE_MS = 600;
const INTERACTION_MS = 800;

const settle = (ms = SETTLE_MS) => new Promise((resolve) => setTimeout(resolve, ms));

// Knöpfe werden über ihre Beschriftung angesteuert, weil die Aushebe- und
// Navigationsknöpfe keine stabilen Klassen tragen.
const clickButtonLabelled = async (page, labelFragments) => {
  const clicked = await page.evaluate((fragments) => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => {
      const label = b.textContent.toLowerCase();
      return fragments.some((fragment) => label.includes(fragment));
    });
    if (button) button.click();
    return Boolean(button);
  }, labelFragments);

  if (!clicked) {
    throw new Error(`Kein Knopf mit Beschriftung ${labelFragments.join(' / ')} gefunden`);
  }
};

const clickRequired = async (page, selector) => {
  const clicked = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element) element.click();
    return Boolean(element);
  }, selector);

  if (!clicked) {
    throw new Error(`Element "${selector}" nicht gefunden`);
  }
  await settle(INTERACTION_MS);
};

const clickIfPresent = async (page, selector) => {
  await page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
  await settle(500);
};

const ROSTER_DIALOG_LABELS = ['armeeliste', 'neu'];

const openRosterDialog = async (page) => {
  await clickButtonLabelled(page, ROSTER_DIALOG_LABELS);
  await page.waitForSelector('form input[type="text"]', { visible: true, timeout: 5000 });
  await settle(500);
};

// Wechselt über die Hauptnavigation die Ansicht. Ein nicht gefundener Knopf ist
// ein Fehler, kein Grund weiterzulaufen: sonst entstehen Screenshots, die eine
// andere Ansicht zeigen als ihr Dateiname behauptet.
const openView = async (page, layout, label) => {
  const containerSelector = LAYOUTS[layout].navReadySelector;
  const clicked = await page.evaluate(
    (selector, viewLabel) => {
      const button = Array.from(document.querySelectorAll(`${selector} button`))
        .find((b) => b.textContent.toLowerCase().includes(viewLabel));
      if (button) button.click();
      return Boolean(button);
    },
    containerSelector,
    label,
  );

  if (!clicked) {
    throw new Error(`Navigationsknopf "${label}" in ${containerSelector} nicht gefunden`);
  }
  await settle(INTERACTION_MS);
};

// Setzt den bereits geöffneten Aushebe-Dialog fort und wartet auf den Editor.
const submitRosterDialog = async (page, rosterName) => {
  await page.type('form input[type="text"]', rosterName);

  // Spielsystem und Katalog jeweils auf den ersten echten Eintrag setzen; die
  // Katalogliste füllt sich erst, nachdem das System gewählt wurde.
  const selectFirstOption = (index) =>
    page.evaluate((selectIndex) => {
      const select = Array.from(document.querySelectorAll('form select'))[selectIndex];
      if (!select || select.options.length <= 1) return false;
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, index);

  if (!(await selectFirstOption(0))) {
    throw new Error('Kein Spielsystem im Aushebe-Dialog auswählbar');
  }
  await page.waitForFunction(() => {
    const select = Array.from(document.querySelectorAll('form select'))[1];
    return select && select.options.length > 1;
  });
  await selectFirstOption(1);

  await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll('form button')).find((b) => b.type === 'submit');
    if (!submit) throw new Error('Absende-Knopf im Aushebe-Dialog nicht gefunden');
    submit.click();
  });
  await page.waitForSelector('.builder-layout', { timeout: 10000 });
  await settle(1000);
};

const runSessionForLayout = async (layout, server) => {
  console.log(`\n--- Screenshot-Sitzung: ${layout.toUpperCase()} ---`);
  const browser = await launchBrowser({ layout });
  const page = await openAppPage(browser);

  const capture = async (name) => {
    await settle();
    const fileName = `${layout}_${name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName) });
    console.log(`Screenshot gespeichert: ${fileName}`);
  };

  try {
    await resetAppState(page, server.url);
    await capture('01_importer_empty');

    await importFixtureSystem(page, { fixtureZipPath: server.fixtureZipPath, layout });
    await settle(1000);

    // Nach dem Import wechselt die App selbsttätig ins Heerlager. Für den Blick
    // auf die importierten Spielsysteme muss der Bibliothekar erneut geöffnet
    // werden, sonst zeigte dieser Screenshot dasselbe wie der nächste.
    await openView(page, layout, 'bibliothekar');
    await capture('02_bibliothekar_loaded');

    await openView(page, layout, 'heerlager');
    await capture('03_dashboard_empty');

    await openRosterDialog(page);
    await capture('04_new_roster_modal');
    await submitRosterDialog(page, `Heerschau ${layout}`);

    await clickRequired(page, '.category-unit-adder-container button');
    await capture('06_unit_adder');

    await clickRequired(page, '.popover-item');
    await clickRequired(page, '.unit-card-details-toggle');
    await capture('05_roster_editor');

    await clickRequired(page, '.selection-node-header');
    await capture('07_selection_configurator');

    // Auf dem Desktop schließt der Konfigurator ohne eigenen Knopf, daher optional.
    await clickIfPresent(page, '.bottomsheet-close-btn');

    // Der Spielmodus wird über die Armeelisten-Karte im Heerlager gestartet.
    await openView(page, layout, 'heerlager');
    await page.waitForSelector('.roster-card', { timeout: 10000 });
    await settle();

    const startedPlayMode = await page.evaluate(() => {
      const card = document.querySelector('.roster-card');
      const playButton = card && Array.from(card.querySelectorAll('button'))
        .find((b) => /schlacht|spielen|play/.test(b.textContent.toLowerCase()));
      if (playButton) playButton.click();
      return Boolean(playButton);
    });
    if (!startedPlayMode) {
      throw new Error('Kein Knopf zum Starten des Spielmodus auf der Armeelisten-Karte gefunden');
    }
    await page.waitForSelector('.play-layout', { timeout: 10000 });
    await settle(1000);
    await capture('08_play_mode');
  } finally {
    await browser.close();
  }
};

const run = async () => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const server = await startAppServer();
  try {
    for (const layout of Object.keys(LAYOUTS)) {
      await runSessionForLayout(layout, server);
    }
    console.log(`\nAlle Screenshots erzeugt in: ${SCREENSHOT_DIR}`);
  } finally {
    server.stop();
  }
};

run().catch((error) => {
  console.error('Screenshot-Lauf fehlgeschlagen:', error);
  process.exit(1);
});
