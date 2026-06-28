import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Artifact directory configuration for saving debug logs and screenshots
const ARTIFACT_DIR = '/Users/artkoenig/.gemini/antigravity/brain/4ceed881-e54c-42cb-a67b-6525918aecbb';
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

    // 2. Click "BSData Bibliothekar" to open importer
    console.log('Navigating to importer...');
    await clickButtonWithText('BSData Bibliothekar');
    await takeScreenshot('02_importer_open');

    // 3. Upload game system zip
    console.log('Uploading game system ZIP file...');
    const zipPath = path.join(ARTIFACT_DIR, 'scratch', 'wfb_6e.zip');
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file not found at path: ${zipPath}`);
    }
    const fileInput = await page.$('input#file-upload');
    if (!fileInput) {
      throw new Error('File input #file-upload not found');
    }
    await fileInput.uploadFile(zipPath);
    console.log('Waiting for import and parsing to complete...');
    await new Promise(r => setTimeout(r, 4000)); // wait 4s for zip parsing
    await takeScreenshot('03_imported');

    // 4. Return to Heerlager
    console.log('Returning to Heerlager dashboard...');
    await clickButtonWithText('Heerlager');
    await takeScreenshot('04_heerlager');

    // 5. Open create roster modal
    console.log('Opening Roster Creation Modal...');
    try {
      await clickButtonWithText('Armeeliste erstellen');
    } catch (e) {
      await clickButtonWithText('Neue Armeeliste');
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

    // 8. Let's expand the Heroes category in the sidebar to view catalog items
    console.log('Expanding Heroes category in catalog sidebar...');
    // The sidebar categories have headers containing the category names (like Lord, Heroes, Core, etc.)
    const categoryExpanded = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.catalog-category-header'));
      const heroesHeader = headers.find(h => h.textContent.toLowerCase().includes('heroes'));
      if (heroesHeader) {
        heroesHeader.click();
        return true;
      }
      return false;
    });
    if (!categoryExpanded) {
      throw new Error('Heroes category header not found in catalog sidebar');
    }
    await new Promise(r => setTimeout(r, 500));
    await takeScreenshot('08_heroes_category_expanded');

    // 9. Add 1 Black Orc Bigboss and 1 Goblin Shaman
    console.log('Adding 1 Black Orc Bigboss to the army roster...');
    const addBlackOrc = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.catalog-item'));
      const bigboss = items.find(item => item.textContent.toLowerCase().includes('black orc bigboss'));
      if (bigboss) {
        const plusBtn = bigboss.querySelector('button');
        if (plusBtn) {
          plusBtn.click();
          return true;
        }
      }
      return false;
    });
    if (!addBlackOrc) {
      throw new Error('Failed to find and click plus button for Black Orc Bigboss');
    }
    await new Promise(r => setTimeout(r, 1000)); // wait for it to load

    console.log('Adding 1 Goblin Shaman to the army roster...');
    const addShaman = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.catalog-item'));
      const shaman = items.find(item => item.textContent.toLowerCase().includes('goblin shaman'));
      if (shaman) {
        const plusBtn = shaman.querySelector('button');
        if (plusBtn) {
          plusBtn.click();
          return true;
        }
      }
      return false;
    });
    if (!addShaman) {
      throw new Error('Failed to find and click plus button for Goblin Shaman');
    }
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('09_units_added');

    // 10. Dump the right-hand requirements sidebar to see if the validation errors are visible
    console.log('Dumping validation sidebar HTML...');
    await dumpHTML('.builder-right-bar', 'validation_sidebar');

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
