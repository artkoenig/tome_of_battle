import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const PORT = 5176;
const tempZipPath = path.resolve('./temp_whfb6.zip');
const SCREENSHOT_DIR = '/Users/artkoenig/.gemini/antigravity/brain/c4237a0b-b94a-4234-ba03-fdcf6116ba3e/screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let serverProcess = null;

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
  console.log(`Successfully packed ${count} files into: ${tempZipPath}`);
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
      console.error('Failed to start Vite server:', err);
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

const runSessionForMode = async (mode) => {
  const isMobile = mode === 'mobile';
  console.log(`\n--- Starting Screenshot Session for ${mode.toUpperCase()} ---`);
  
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: isMobile 
      ? { width: 375, height: 812, isMobile: true, hasTouch: true }
      : { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const takeScreenshot = async (name) => {
    await new Promise(r => setTimeout(r, 600)); // wait for layout/animations
    const filename = `${mode}_${name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
    console.log(`Saved screenshot: ${filename}`);
  };

  try {
    console.log(`Navigating to http://localhost:${PORT}/ ...`);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });

    // Clear indexedDB to start fresh
    console.log('Clearing IndexedDB...');
    await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('TomeOfBattleDB');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await page.reload({ waitUntil: 'networkidle2' });

    // SCREEN 1: Empty state
    await takeScreenshot('01_importer_empty');

    // Upload ZIP file to import catalog
    console.log('Uploading temporary ZIP file...');
    await page.waitForSelector('#file-upload', { timeout: 5000 });
    const fileInput = await page.$('#file-upload');
    await fileInput.uploadFile(tempZipPath);

    // Wait for the system to import
    console.log('Waiting for import...');
    if (isMobile) {
      await page.waitForSelector('.mobile-bottom-nav', { timeout: 15000 });
    } else {
      await page.waitForSelector('.desktop-nav-actions', { timeout: 15000 });
    }
    await new Promise(r => setTimeout(r, 1000));
    
    // SCREEN 2: Bibliothekar after catalog imported
    await takeScreenshot('02_bibliothekar_loaded');

    // Go to Heerlager (Dashboard)
    console.log('Navigating to Heerlager...');
    await page.evaluate((mobile) => {
      const containerSelector = mobile ? '.mobile-bottom-nav' : '.desktop-nav-actions';
      const btn = Array.from(document.querySelectorAll(`${containerSelector} button`))
        .find(b => b.textContent.toLowerCase().includes('heerlager'));
      if (btn) btn.click();
    }, isMobile);
    await new Promise(r => setTimeout(r, 800));

    // SCREEN 3: Empty Heerlager Dashboard
    await takeScreenshot('03_dashboard_empty');

    // Click button to create a new roster
    console.log('Opening Roster creation modal...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('armeeliste') || b.textContent.toLowerCase().includes('neu'));
      if (btn) btn.click();
    });
    
    // Wait for form to be visible
    await page.waitForSelector('form input[type="text"]', { visible: true, timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));

    // SCREEN 4: Neues Heer ausheben bottomsheet/modal
    await takeScreenshot('04_new_roster_modal');

    // Fill form
    console.log('Filling out Roster Details...');
    await page.type('form input[type="text"]', `Bretonnia ${isMobile ? 'Mobile' : 'Desktop'}`);
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const systemSelect = selects[0];
      if (systemSelect) {
        systemSelect.selectedIndex = 1;
        systemSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const catSelect = selects[1];
      if (catSelect) {
        catSelect.selectedIndex = 1;
        catSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Submit form
    console.log('Submitting roster creation form...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('form button')).find(b => b.type === 'submit');
      if (btn) btn.click();
    });
    
    // Wait for the Roster Editor to load
    await page.waitForSelector('.builder-layout', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // SCREEN 5: Roster Editor / Builder view
    await takeScreenshot('05_roster_editor');

    // Open Unit Selection / Category Adder bottomsheet
    console.log('Opening CategoryUnitAdder popover/bottomsheet...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.category-unit-adder-container button'));
      if (buttons.length > 0) buttons[0].click();
    });
    await new Promise(r => setTimeout(r, 800));

    // SCREEN 6: Unit Selection popover / bottomsheet
    await takeScreenshot('06_unit_adder');

    // Add unit
    console.log('Adding unit...');
    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('.popover-item'));
      if (options.length > 0) options[0].click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Open unit config (SelectionConfigurator)
    console.log('Opening unit configuration...');
    await page.evaluate(() => {
      const card = document.querySelector('.selection-node-header');
      if (card) card.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // SCREEN 7: SelectionConfigurator dialog / bottomsheet
    await takeScreenshot('07_selection_configurator');

    // Close unit config bottomsheet
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.bottomsheet-close-btn');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Go to Play Mode via dashboard to bypass validation restriction
    console.log('Navigating back to Heerlager dashboard to open Play Mode...');
    await page.evaluate((mobile) => {
      const containerSelector = mobile ? '.mobile-bottom-nav' : '.desktop-nav-actions';
      const btn = Array.from(document.querySelectorAll(`${containerSelector} button`))
        .find(b => b.textContent.toLowerCase().includes('heerlager'));
      if (btn) btn.click();
    }, isMobile);
    
    // Wait for dashboard view to load and show the roster card
    await page.waitForSelector('.roster-card', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 600));

    console.log('Clicking play button on roster card...');
    await page.evaluate(() => {
      const card = document.querySelector('.roster-card');
      if (card) {
        const playBtn = Array.from(card.querySelectorAll('button'))
          .find(b => b.textContent.toLowerCase().includes('schlacht') || b.textContent.toLowerCase().includes('play') || b.textContent.toLowerCase().includes('spielen'));
        if (playBtn) playBtn.click();
      }
    });

    await page.waitForSelector('.play-layout', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // SCREEN 8: Play Mode view
    await takeScreenshot('08_play_mode');

  } catch (error) {
    console.error(`Error during ${mode} screenshot session:`, error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
};

(async () => {
  try {
    await packCatalogs();
    await startViteServer();
    
    // Run Desktop Session
    await runSessionForMode('desktop');
    
    // Run Mobile Session
    await runSessionForMode('mobile');

  } catch (err) {
    console.error(err);
  } finally {
    if (tempZipPath && fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
    if (serverProcess) {
      console.log('Stopping Vite server...');
      serverProcess.kill();
    }
    console.log('All screenshot generation complete!');
    process.exit(0);
  }
})();
