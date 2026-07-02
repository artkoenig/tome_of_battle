import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const PORT = 5176; // use a different port to avoid conflict
const tempZipPath = path.resolve('./temp_stress_whfb6.zip');
let serverProcess = null;

// 1. Pack catalogs
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

// 2. Start Vite server
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

const runVerification = async () => {
  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error] ${msg.text()}`);
    }
  });

  try {
    console.log(`Navigating to http://localhost:${PORT}/ ...`);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });

    // Clear DB
    await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('TomeOfBattleDB');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await page.reload({ waitUntil: 'networkidle2' });

    // 1. Verify CSS opacity constraint (R6)
    console.log('Verifying CSS background and opacity constraints...');
    const cssBackgroundData = await page.evaluate(() => {
      // Find the loaded index.css styles or examine body computed style
      const bodyStyle = window.getComputedStyle(document.body);
      const appContentEl = document.querySelector('.app-content');
      const appContentStyle = appContentEl ? window.getComputedStyle(appContentEl) : null;
      
      return {
        bodyBg: bodyStyle.backgroundImage,
        appContentBg: appContentStyle ? appContentStyle.backgroundImage : null
      };
    });

    console.log('Body background-image style:', cssBackgroundData.bodyBg ? 'Found' : 'Not Found');
    console.log('App Content background-image style:', cssBackgroundData.appContentBg ? 'Found' : 'Not Found');

    // Parse base64 SVGs to ensure they represent W6 dice with 3-5% opacity
    const extractSvgOpacity = (bgStyle) => {
      if (!bgStyle) return null;
      const match = bgStyle.match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/);
      if (!match) return null;
      const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
      
      // Parse out opacity attributes
      const strokeOpacityMatch = decoded.match(/stroke-opacity="([^"]+)"/);
      const fillOpacityMatch = decoded.match(/fill-opacity="([^"]+)"/);
      return {
        svg: decoded,
        strokeOpacity: strokeOpacityMatch ? parseFloat(strokeOpacityMatch[1]) : null,
        fillOpacity: fillOpacityMatch ? parseFloat(fillOpacityMatch[1]) : null
      };
    };

    const bodySvgData = extractSvgOpacity(cssBackgroundData.bodyBg);
    console.log('Parsed body SVG opacity:', bodySvgData);
    if (!bodySvgData || bodySvgData.strokeOpacity < 0.03 || bodySvgData.strokeOpacity > 0.05) {
      throw new Error(`Background SVG opacity ${bodySvgData?.strokeOpacity} is not within the requested 3-5% (0.03-0.05) range.`);
    }
    console.log('✅ Background opacity is correct: ' + (bodySvgData.strokeOpacity * 100) + '%');

    // 2. Perform UI Actions to test R5 (Destroyed Unit Overlay and click pass-through)
    // Upload files
    const fileInput = await page.waitForSelector('#file-upload');
    await fileInput.uploadFile(tempZipPath);
    await page.waitForSelector('.desktop-nav-actions', { timeout: 15000 });
    
    // Return to Heerlager
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent.includes('Heerlager'));
      if (btn) btn.click();
    });

    // Create Roster
    console.log('Opening new roster modal...');
    await page.waitForSelector('button');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('armeeliste') || b.textContent.toLowerCase().includes('neu'));
      if (btn) btn.click();
    });

    await page.waitForSelector('form');
    await page.type('form input[type="text"]', 'Test Army for R5');
    
    // Select Spielsystem (WHFB6)
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const systemSelect = selects[0];
      if (systemSelect && systemSelect.options.length > 1) {
        systemSelect.selectedIndex = 1;
        systemSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Wait for catalog select to populate
    await page.waitForFunction(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const catSelect = selects[1];
      return catSelect && catSelect.options.length > 1;
    });

    // Select Bretonnia catalog
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const catSelect = selects[1];
      if (catSelect) {
        const option = Array.from(catSelect.options).find(o => o.text.includes('Bretonnia'));
        if (option) {
          catSelect.value = option.value;
          catSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          catSelect.selectedIndex = 1;
          catSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // Set points limit to 500
    await page.evaluate(() => {
      const input = document.querySelector('form input[type="number"]');
      if (input) {
        input.value = '500';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Click submit
    console.log('Submitting roster creation form...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('form button')).find(b => b.type === 'submit');
      if (btn) btn.click();
    });

    // Wait for the Roster Editor to load
    console.log('Waiting for Roster Editor...');
    await page.waitForSelector('.builder-layout', { timeout: 10000 });

    // Add units using CategoryUnitAdder popover
    console.log('Opening CategoryUnitAdder popover...');
    const openedPopover = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.category-unit-adder-container button'));
      if (buttons.length > 0) {
        buttons[0].click(); // click first plus button
        return true;
      }
      return false;
    });

    if (!openedPopover) {
      throw new Error('Failed to find CategoryUnitAdder buttons');
    }

    // Wait for popover-item list to open
    await page.waitForSelector('.popover-item', { visible: true, timeout: 5000 });

    // Click the first popover item to add the unit to the roster
    console.log('Clicking popover item to add unit...');
    await page.click('.popover-item');
    await new Promise(r => setTimeout(r, 1000)); // wait for selection update

    // Open Spielmodus
    console.log('Navigating to Spielmodus...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Spielmodus'));
      if (btn) btn.click();
    });

    await page.waitForSelector('.play-layout', { timeout: 10000 });
    console.log('Entered Spielmodus successfully.');

    // Find the unit cards and get initial state of rules header
    const initialRulesExpandedState = await page.evaluate(() => {
      const header = document.querySelector('.play-unit-wound-tracker h4');
      if (!header) return null;
      return header.textContent.includes('▲') ? 'expanded' : 'collapsed';
    });
    console.log('Initial rules expanded state:', initialRulesExpandedState);

    // Get current wounds and max wounds of the unit
    const unitWoundsText = await page.evaluate(() => {
      const tracker = document.querySelector('.play-unit-header-controls span');
      return tracker ? tracker.textContent.trim() : null;
    });
    console.log('Unit wounds:', unitWoundsText); // e.g. "5 / 5"
    if (!unitWoundsText) {
      // Let's dump page content or log if not found
      const content = await page.content();
      console.log('Page content body HTML:', await page.evaluate(() => document.body.innerHTML));
      throw new Error('Wounds tracker not found.');
    }

    const match = unitWoundsText.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) throw new Error('Could not parse wounds text.');
    const maxWounds = parseInt(match[2], 10);

    // Kill unit: click Minus button maxWounds times
    console.log(`Killing unit by clicking Minus button ${maxWounds} times...`);
    for (let i = 0; i < maxWounds; i++) {
      await page.click('.play-unit-header-controls button.qty-btn');
      await new Promise(r => setTimeout(r, 200));
    }

    // Verify unit is dead
    const isDestroyedOverlayPresent = await page.evaluate(() => {
      const overlay = document.querySelector('.destroyed-overlay');
      if (!overlay) return false;
      const text = overlay.querySelector('.destroyed-text');
      return text && text.textContent === 'Vernichtet';
    });
    console.log('Is "Vernichtet" overlay present:', isDestroyedOverlayPresent);
    if (!isDestroyedOverlayPresent) {
      throw new Error('Vernichtet overlay was not displayed when wounds reached 0.');
    }

    // Verify unit card is not darkened/grayscale
    console.log('Verifying unit card has no opacity/grayscale filters...');
    const cardStyles = await page.evaluate(() => {
      const card = document.querySelector('.play-unit-card.unit-destroyed');
      if (!card) return null;
      const style = window.getComputedStyle(card);
      return {
        filter: style.filter,
        opacity: style.opacity
      };
    });
    console.log('Card styles when destroyed:', cardStyles);
    if (cardStyles.filter.includes('grayscale')) {
      throw new Error('Unit card is set to grayscale when destroyed, violating requirements.');
    }
    // Wait, the overlay itself has a background color. But does the card have grayscale or card opacity lower than 1?
    if (parseFloat(cardStyles.opacity) < 1.0) {
      throw new Error('Unit card has opacity lower than 1.0 when destroyed, violating requirements.');
    }
    console.log('✅ Unit card is NOT darkened (via opacity/grayscale) on the card itself.');

    // Verify pointer-events: none on the overlay
    const overlayPointerEvents = await page.evaluate(() => {
      const overlay = document.querySelector('.destroyed-overlay');
      return overlay ? window.getComputedStyle(overlay).pointerEvents : null;
    });
    console.log('Overlay pointer-events value:', overlayPointerEvents);
    if (overlayPointerEvents !== 'none') {
      throw new Error(`Overlay pointer-events is "${overlayPointerEvents}", expected "none".`);
    }
    console.log('✅ Overlay pointer-events: none is correctly set.');

    // 3. Empirically verify click pass-through: click the rules header underneath the overlay!
    console.log('Testing click pass-through to rules header under overlay...');
    // We will find the coordinates of the rules header
    const headerRect = await page.evaluate(() => {
      const header = document.querySelector('.play-unit-wound-tracker h4');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (!headerRect) {
      throw new Error('Rules header rect could not be computed.');
    }

    console.log(`Clicking rules header at coordinates: x=${headerRect.x}, y=${headerRect.y}`);
    await page.mouse.click(headerRect.x, headerRect.y);
    await new Promise(r => setTimeout(r, 500));

    // Check if the rules expanded state has changed
    const newRulesExpandedState = await page.evaluate(() => {
      const header = document.querySelector('.play-unit-wound-tracker h4');
      if (!header) return null;
      return header.textContent.includes('▲') ? 'expanded' : 'collapsed';
    });
    console.log('Rules expanded state after click:', newRulesExpandedState);

    if (newRulesExpandedState === initialRulesExpandedState) {
      throw new Error('Click did not pass through to the rules header. The overlay is blocking pointer events.');
    }
    console.log('✅ Click pass-through test: PASSED (toggled rules expansion successfully under the overlay).');

    console.log('🎉 ALL EMPIRICAL VERIFICATION CHECKS PASSED!');
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
};

const cleanup = () => {
  console.log('Cleaning up...');
  if (fs.existsSync(tempZipPath)) {
    fs.unlinkSync(tempZipPath);
  }
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
};

const main = async () => {
  try {
    await packCatalogs();
    await startViteServer();
    await runVerification();
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err);
    cleanup();
    process.exit(1);
  }
};

main();
