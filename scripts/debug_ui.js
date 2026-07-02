import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Artifact directory configuration for saving debug logs and screenshots
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || '/Users/artkoenig/.gemini/antigravity/brain/3eb78b9b-9921-4ccf-b9e8-8448f4bf5ed4';
const PORT = 5175; // The Vite dev server port as running locally

// Parse arguments
const args = process.argv.slice(2);
const isHeaded = args.includes('--headed');

async function run() {
  console.log(`Starting UI Debugger (${isHeaded ? 'Headed' : 'Headless'} mode)...`);
  
  // Setup output paths
  const consoleLogPath = path.join(ARTIFACT_DIR, 'debug_console.log');
  fs.writeFileSync(consoleLogPath, `--- BROWSER CONSOLE LOGS --- \n`);

  const browser = await puppeteer.launch({
    headless: !isHeaded,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Listen to browser console logs
  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}\n`;
    fs.appendFileSync(consoleLogPath, text);
    console.log(`[Browser] ${text.trim()}`);
  });

  page.on('pageerror', err => {
    const text = `[PAGE ERROR] ${err.stack || err.message || err}\n`;
    fs.appendFileSync(consoleLogPath, text);
    console.error(`[Browser Error] ${text.trim()}`);
  });

  // Helper functions
  const takeScreenshot = async (name) => {
    const filepath = path.join(ARTIFACT_DIR, `debug_${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Screenshot saved to: ${filepath}`);
  };

  const dumpHTML = async (selector, filename) => {
    const filepath = path.join(ARTIFACT_DIR, `debug_${filename}.html`);
    const content = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.innerHTML : `Element "${sel}" not found`;
    }, selector);
    fs.writeFileSync(filepath, content);
    console.log(`HTML dump saved to: ${filepath}`);
  };

  const clickButtonWithText = async (text) => {
    const clicked = await page.evaluate((btnText) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find(b => b.textContent.toLowerCase().includes(btnText.toLowerCase()));
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, text);
    if (!clicked) {
      throw new Error(`Button with text "${text}" not found`);
    }
    console.log(`Clicked button containing: "${text}"`);
    await new Promise(r => setTimeout(r, 500)); // sleep after click to allow UI updates
  };

  const clickSelector = async (selector) => {
    await page.waitForSelector(selector);
    await page.click(selector);
    console.log(`Clicked selector: "${selector}"`);
    await new Promise(r => setTimeout(r, 500));
  };

  const typeInto = async (selector, value) => {
    await page.waitForSelector(selector);
    // Clear field cleanly using DOM
    await page.$eval(selector, el => el.value = '');
    await page.type(selector, value);
    console.log(`Typed "${value}" into: "${selector}"`);
  };

  const selectDropdownValue = async (labelOrText, optionText) => {
    const success = await page.evaluate((labelText, optText) => {
      // Find select relative to a label, or any select matching
      const selects = Array.from(document.querySelectorAll('select'));
      for (const select of selects) {
        // Find matching option
        const options = Array.from(select.options);
        const opt = options.find(o => o.text.toLowerCase().includes(optText.toLowerCase()));
        if (opt) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, labelOrText, optionText);
    
    if (!success) {
      throw new Error(`Dropdown option matching "${optionText}" not found`);
    }
    console.log(`Selected dropdown option: "${optionText}"`);
    await new Promise(r => setTimeout(r, 500));
  };

  try {
    // 1. Navigate to the app
    console.log(`Navigating to http://localhost:${PORT}/ ...`);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    await takeScreenshot('01_loaded');

    // 2. Load game system into IndexedDB (either via ZIP upload or direct JSON injection)
    const zipPath = path.join(ARTIFACT_DIR, 'scratch', 'wfb_6e.zip');
    const jsonPath = '/Users/artkoenig/Downloads/Warhammer Fantasy Battle 6th edition_corrected.json';

    if (fs.existsSync(zipPath)) {
      console.log('Navigating to importer and uploading ZIP file...');
      try {
        await clickButtonWithText('Bibliothekar');
        await takeScreenshot('02_importer_open');
      } catch (e) {
        const fileInputExists = await page.evaluate(() => !!document.querySelector('input#file-upload'));
        if (!fileInputExists) {
          throw new Error('Neither "Bibliothekar" button nor "#file-upload" input found.');
        }
        console.log('Importer already shown as empty state.');
      }
      const fileInput = await page.$('input#file-upload');
      if (!fileInput) {
        throw new Error('File input #file-upload not found');
      }
      await fileInput.uploadFile(zipPath);
      console.log('Waiting for import and parsing to complete...');
      await new Promise(r => setTimeout(r, 4000)); // wait 4s for zip parsing
      await takeScreenshot('03_imported');
      console.log('Returning to Heerlager dashboard...');
      await clickButtonWithText('Heerlager');
      await takeScreenshot('04_heerlager');
    } else if (fs.existsSync(jsonPath)) {
      console.log('Bypassing ZIP upload. Injecting JSON system data directly into IndexedDB...');
      const systemJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      await page.evaluate(async (sys) => {
        const DB_NAME = 'TomeOfBattleDB';
        const DB_VERSION = 1;
        const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
        await new Promise((resolve, reject) => {
          openRequest.onupgradeneeded = (e) => {
            const db = openRequest.result;
            if (!db.objectStoreNames.contains('systems')) {
              db.createObjectStore('systems', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('rosters')) {
              db.createObjectStore('rosters', { keyPath: 'id' });
            }
          };
          openRequest.onsuccess = () => resolve();
          openRequest.onerror = () => reject(openRequest.error);
        });
        const db = openRequest.result;
        const transaction = db.transaction('systems', 'readwrite');
        const store = transaction.objectStore('systems');
        await new Promise((resolve, reject) => {
          const putReq = store.put(sys);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        });
        db.close();
      }, systemJson);
      console.log('JSON system injected successfully.');
      // Refresh page to load database changes
      await page.reload({ waitUntil: 'networkidle0' });
      await takeScreenshot('04_heerlager');
    } else {
      throw new Error(`Neither game system ZIP at "${zipPath}" nor JSON file at "${jsonPath}" was found.`);
    }

    console.log('Switching to mobile viewport for dashboard...');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 500));
    await takeScreenshot('04_mobile_heerlager');
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 500));

    // 5. Open create roster modal
    console.log('Opening Roster Creation Modal...');
    try {
      await clickButtonWithText('Armeeliste erstellen');
    } catch (e) {
      try {
        await clickButtonWithText('Neue Armeeliste');
      } catch (e2) {
        await clickButtonWithText('ausheben');
      }
    }
    await takeScreenshot('05_modal_open');

    // 6. Fill out the modal
    console.log('Filling out Roster details...');
    await typeInto('input[type="text"]', 'AI Orc Horde');
    await selectDropdownValue('Spielsystem', 'Warhammer Fantasy Battle 6th edition');
    await selectDropdownValue('Katalog / Fraktion', 'Orcs and Goblins');
    await typeInto('input[type="number"]', '1000'); // 1000 pts limit
    await takeScreenshot('06_modal_filled');

    // 7. Click "Heerschau starten" button to save
    await clickButtonWithText('Heerschau starten');
    await takeScreenshot('07_roster_created');

    // 8. Add units using the inline CategoryUnitAdder popover
    console.log('Opening CategoryUnitAdder popover for Heroes...');
    const clickAdder1 = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[title*="Heroes"], button[title*="Helden"]'));
      if (buttons.length > 0) {
        buttons[0].click();
        return true;
      }
      return false;
    });
    if (!clickAdder1) {
      throw new Error('Failed to find and click CategoryUnitAdder button for Heroes');
    }
    await new Promise(r => setTimeout(r, 600));
    await takeScreenshot('08_heroes_category_expanded');

    console.log('Adding Black Orc Bigboss from popover...');
    const addBlackOrc = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.popover-item'));
      const target = items.find(item => item.textContent.toLowerCase().includes('black orc bigboss'));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (!addBlackOrc) {
      throw new Error('Failed to find and click Black Orc Bigboss in popover');
    }
    await new Promise(r => setTimeout(r, 1000));

    console.log('Opening CategoryUnitAdder popover again to add Goblin Shaman...');
    const clickAdder2 = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[title*="Heroes"], button[title*="Helden"]'));
      if (buttons.length > 0) {
        buttons[0].click();
        return true;
      }
      return false;
    });
    if (!clickAdder2) {
      throw new Error('Failed to open popover for second unit');
    }
    await new Promise(r => setTimeout(r, 600));

    console.log('Adding Goblin Shaman from popover...');
    const addShaman = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.popover-item'));
      const target = items.find(item => item.textContent.toLowerCase().includes('goblin shaman'));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (!addShaman) {
      throw new Error('Failed to click Goblin Shaman in popover');
    }
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('09_units_added');

    // 9. Switch to mobile viewports
    console.log('Switching viewport to mobile (375x812)...');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('10_mobile_roster');

    // Open a CategoryUnitAdder popover on mobile to capture it
    console.log('Opening popover on mobile for screenshot...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[title*="Heroes"], button[title*="Helden"]'));
      if (buttons.length > 0) buttons[0].click();
    });
    await new Promise(r => setTimeout(r, 600));
    await takeScreenshot('11_mobile_library'); // Capture mobile popover dropdown

    // Close the popover by clicking on the title
    console.log('Closing popover on mobile...');
    await page.click('.builder-top-bar-title');
    await new Promise(r => setTimeout(r, 500));
 
    // Scroll to the bottom errors panel
    console.log('Scrolling to general errors section on mobile...');
    await page.evaluate(() => {
      const el = document.getElementById('general-errors-section');
      if (el) el.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('12_mobile_status'); // Capture mobile status panel at the bottom

    // Restore viewport
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 500));

    // 10. Dump validation sidebar HTML
    console.log('Dumping validation sidebar HTML...');
    await dumpHTML('.desktop-only-sidebar', 'validation_sidebar');

    console.log('UI automation complete successfully!');
  } catch (error) {
    console.error('An error occurred during UI debugging:', error);
    await takeScreenshot('error_occurred');
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

run();
