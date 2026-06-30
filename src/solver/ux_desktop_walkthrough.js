import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const PORT = 5175;
const tempZipPath = path.resolve('./temp_whfb6.zip');
let serverProcess = null;

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || '/Users/artkoenig/.gemini/antigravity/brain/1a0dd12c-dc23-4bdf-af61-3c5484283f9d';

const packCatalogs = async () => {
  console.log('Packing ./catalogs/whfb6/ into a temporary ZIP file...');
  const zip = new JSZip();
  const dirPath = path.resolve('./catalogs/whfb6');
  
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Catalog directory not found at: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath);
  let count = 0;
  for (const filename of files) {
    if (filename.endsWith('.cat') || filename.endsWith('.gst')) {
      const filePath = path.join(dirPath, filename);
      const content = fs.readFileSync(filePath);
      zip.file(filename, content);
      count++;
    }
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(tempZipPath, buffer);
  console.log(`Packed ${count} files to ${tempZipPath}`);
};

const startViteServer = () => {
  return new Promise((resolve, reject) => {
    console.log(`Spawning Vite dev server on port ${PORT}...`);
    const proc = spawn('npx', ['vite', '--port', PORT.toString(), '--strictPort'], {
      shell: true
    });
    serverProcess = proc;
    let resolved = false;

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      if ((str.includes(PORT.toString()) || str.includes('Local:')) && !resolved) {
        resolved = true;
        resolve(proc);
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(`[Vite stderr] ${data.toString()}`);
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc);
      }
    }, 6000);
  });
};

const clickButtonWithText = async (page, text) => {
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
  await new Promise(r => setTimeout(r, 600));
};

const selectDropdownValue = async (page, optionText) => {
  const success = await page.evaluate((optText) => {
    const selects = Array.from(document.querySelectorAll('select'));
    for (const select of selects) {
      const options = Array.from(select.options);
      const opt = options.find(o => o.text.toLowerCase().includes(optText.toLowerCase()));
      if (opt) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, optionText);
  if (!success) {
    throw new Error(`Dropdown option matching "${optionText}" not found`);
  }
  await new Promise(r => setTimeout(r, 600));
};

const run = async () => {
  try {
    await packCatalogs();
    await startViteServer();

    console.log('Launching Puppeteer in Desktop mode...');
    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1440, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const takeScreenshot = async (name) => {
      const filepath = path.join(ARTIFACT_DIR, `desktop_${name}.png`);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`Screenshot saved: ${filepath}`);
    };

    // 1. Navigate to main page (Empty state)
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('TomeOfBattleDB');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await takeScreenshot('01_empty_state');

    // 2. Upload zip system file
    console.log('Uploading game system ZIP...');
    const fileInput = await page.waitForSelector('#file-upload');
    await fileInput.uploadFile(tempZipPath);
    await new Promise(r => setTimeout(r, 3000));
    await takeScreenshot('02_imported');

    // 3. Go to Heerlager
    console.log('Navigating to Heerlager...');
    await clickButtonWithText(page, 'Heerlager');
    await takeScreenshot('03_heerlager');

    // 4. Click "Erste Armeeliste ausheben" (opens modal)
    console.log('Opening Roster creation modal...');
    await clickButtonWithText(page, 'ausheben');
    await takeScreenshot('04_modal');

    // 5. Fill modal
    console.log('Filling modal form...');
    await page.type('form input[type="text"]', 'AI Orc Horde');
    await selectDropdownValue(page, 'Warhammer Fantasy Battle 6th edition');
    await selectDropdownValue(page, 'Orcs and Goblins');
    // Set points to 1000
    await page.evaluate(() => {
      const input = document.querySelector('form input[type="number"]');
      if (input) {
        input.value = '1000';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await takeScreenshot('05_modal_filled');

    // 6. Submit modal (opens editor)
    console.log('Submitting form...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('form button')).find(b => b.type === 'submit');
      if (btn) btn.click();
    });
    await page.waitForSelector('.builder-layout', { timeout: 10000 });
    await takeScreenshot('06_editor_empty');

    // 7. Open Heroes category popover
    console.log('Opening Heroes popover...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.category-unit-adder-container button'));
      const heroesBtn = buttons.find(b => b.title && (b.title.toLowerCase().includes('heroes') || b.title.toLowerCase().includes('helden')));
      if (heroesBtn) {
        heroesBtn.click();
      } else {
        throw new Error('Heroes add button not found');
      }
    });
    await new Promise(r => setTimeout(r, 600));
    await takeScreenshot('07_popover_open');

    // 8. Add Black Orc Bigboss
    console.log('Adding Black Orc Bigboss...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.popover-item'));
      const target = items.find(item => item.textContent.toLowerCase().includes('black orc bigboss'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('08_unit_added');

    await page.waitForSelector('.selection-node', { visible: true, timeout: 5000 });
    await page.click('.selection-node');
    await page.waitForSelector('.selection-node-body', { visible: true });
    await takeScreenshot('09_configurator_open');

    // 10. Add Shaman
    console.log('Opening Heroes popover again...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.category-unit-adder-container button'));
      if (buttons.length > 0) buttons[0].click();
    });
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.popover-item'));
      const target = items.find(item => item.textContent.toLowerCase().includes('goblin shaman') || item.textContent.toLowerCase().includes('shaman'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('10_shaman_added');

    // 11. Enter Play Mode
    console.log('Entering Play Mode...');
    await clickButtonWithText(page, 'Spielmodus');
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('11_play_mode');

    await browser.close();
    console.log('Walkthrough completed successfully!');
  } finally {
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  }
};

run();
