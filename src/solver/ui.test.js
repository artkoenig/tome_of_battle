import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const PORT = 5175;
const tempZipPath = path.resolve('./temp_whfb6.zip');
let serverProcess = null;

// 1. Pack `./catalogs/whfb6/` files into a temporary ZIP file using JSZip.
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

  if (count === 0) {
    throw new Error('No .cat or .gst files found to pack.');
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(tempZipPath, buffer);
  console.log(`Successfully packed ${count} files into: ${tempZipPath}`);
};

// 2. Start the Vite dev server programmatically on port 5175.
const startViteServer = () => {
  return new Promise((resolve, reject) => {
    console.log(`Spawning Vite dev server on port ${PORT}...`);
    // Run npx vite --port 5175 --strictPort
    const proc = spawn('npx', ['vite', '--port', PORT.toString(), '--strictPort'], {
      shell: true
    });

    serverProcess = proc;

    let resolved = false;

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      console.log(`[Vite stdout] ${str.trim()}`);
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

    // Fallback timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('Vite server startup timeout reached, continuing...');
        resolve(proc);
      }
    }, 6000);
  });
};

// 3. Main UI test logic using Puppeteer
const runUiTests = async () => {
  console.log('Launching headless Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    // Suppress verbose debug console logs unless needed
    if (msg.type() === 'error') {
      console.error(`[Browser Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`[Browser PageError] ${err.stack || err.message}`);
  });

  try {
    console.log(`Navigating to http://localhost:${PORT}/ ...`);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });

    // Clear indexedDB to guarantee test starts from clean state
    console.log('Clearing indexedDB database TomeOfBattleDB...');
    await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('TomeOfBattleDB');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await page.reload({ waitUntil: 'networkidle2' });

    // Navigate to Importer view
    console.log('Navigating to BSData Bibliothekar...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes('bibliothekar'));
      if (btn) {
        btn.click();
      } else {
        throw new Error('Bibliothekar button not found in header');
      }
    });

    // Upload ZIP file
    console.log('Waiting for #file-upload input...');
    await page.waitForSelector('#file-upload', { timeout: 5000 });
    const fileInput = await page.$('#file-upload');
    if (!fileInput) {
      throw new Error('#file-upload element not found');
    }
    console.log('Uploading temporary ZIP file...');
    await fileInput.uploadFile(tempZipPath);

    // Wait for the system to import and render under "Importierte Spielsysteme"
    console.log('Waiting for system to be imported and parsed...');
    await page.waitForSelector('.catalog-item', { timeout: 15000 });
    console.log('System imported successfully.');

    // Return to dashboard
    console.log('Returning to Heerlager...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes('heerlager'));
      if (btn) {
        btn.click();
      } else {
        throw new Error('Heerlager button not found in header');
      }
    });

    // Click button to create a new roster
    console.log('Waiting for roster list area...');
    await page.waitForSelector('button', { timeout: 5000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('armeeliste') || b.textContent.toLowerCase().includes('neu'));
      if (btn) {
        btn.click();
      } else {
        throw new Error('New roster button not found');
      }
    });

    // Wait for creation modal form
    await page.waitForSelector('form', { timeout: 5000 });

    // Fill Roster details
    console.log('Filling out Roster Details...');
    await page.type('form input[type="text"]', 'Paladins of Bretonnia');

    // Select Spielsystem (WHFB6)
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const systemSelect = selects[0];
      if (systemSelect && systemSelect.options.length > 1) {
        systemSelect.selectedIndex = 1;
        systemSelect.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        throw new Error('No system select or systems found in modal');
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

    // Set points limit to 500 so we trigger validation limit errors easily
    await page.evaluate(() => {
      const input = document.querySelector('form input[type="number"]');
      if (input) {
        input.value = '500';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Click submit "Heerschau starten"
    console.log('Submitting roster creation form...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('form button')).find(b => b.type === 'submit');
      if (btn) {
        btn.click();
      } else {
        throw new Error('Submit button not found in form');
      }
    });

    // Wait for the Roster Editor to load
    console.log('Waiting for Roster Editor (builder layout)...');
    await page.waitForSelector('.builder-layout', { timeout: 10000 });

    // Verify that "Characters" category group is NOT rendered (since it's not primary for any unit)
    console.log('Verifying secondary categories like "Characters" are hidden...');
    const hasCharactersGroup = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.roster-category-header h3'));
      return headers.some(h => h.textContent.trim() === 'Characters');
    });
    if (hasCharactersGroup) {
      throw new Error('Secondary category "Characters" should not be rendered as a UI group.');
    }

    const hasHeroesGroup = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.roster-category-header h3'));
      return headers.some(h => h.textContent.trim() === 'Heroes');
    });
    if (!hasHeroesGroup) {
      throw new Error('Primary category "Heroes" should be rendered as a UI group.');
    }
    console.log('Category groups rendered correctly.');

    // Verify initial validation errors are shown (since empty roster violates min units etc.)
    console.log('Verifying initial validation errors are shown...');
    const errorsCountBefore = await page.evaluate(() => {
      return document.querySelectorAll('.validation-error-item').length;
    });
    console.log(`Initial validation errors count: ${errorsCountBefore}`);
    if (errorsCountBefore === 0) {
      throw new Error('Expected initial validation errors for an empty roster, but found none.');
    }

    // Add units using CategoryUnitAdder popover
    console.log('Locating and opening CategoryUnitAdder popover...');
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

    console.log('Verifying sorting of items in CategoryUnitAdder popover...');
    const popoverPoints = await page.evaluate(() => {
       const items = Array.from(document.querySelectorAll('.popover-item'));
       return items.map(item => {
          const text = item.querySelector('.popover-item-cost')?.textContent || '';
          const match = text.match(/\+?(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
       });
    });
    console.log(`Popover items points: ${popoverPoints.join(', ')}`);
    for (let i = 0; i < popoverPoints.length - 1; i++) {
       if (popoverPoints[i] < popoverPoints[i+1]) {
          throw new Error(`Popover items are not sorted descending: ${popoverPoints[i]} < ${popoverPoints[i+1]}`);
       }
    }

    // Click the first popover item to add the unit to the roster
    console.log('Clicking popover item to add unit...');
    await page.click('.popover-item');
    await new Promise(r => setTimeout(r, 1000)); // wait for selection update

    // Verify validation errors are still shown or updated
    const errorsCountAfter = await page.evaluate(() => {
      return document.querySelectorAll('.validation-error-item').length;
    });
    console.log(`Validation errors count after unit added: ${errorsCountAfter}`);

    // Test SelectionConfigurator sorting by opening the unit options
    console.log('Opening unit to verify SelectionConfigurator sorting...');
    await page.click('.selection-node');
    await page.waitForSelector('.selection-node-body', { visible: true, timeout: 5000 });
    
    // Find a group and expand it to see options
    const expandedGroup = await page.evaluate(() => {
       const groups = Array.from(document.querySelectorAll('.selection-node-body > .sub-selection-group > div'));
       // find one that has a ChevronRight (expandable) and click it
       for (const group of groups) {
          const titleDiv = group.firstElementChild;
          if (titleDiv && titleDiv.innerHTML.includes('lucide-chevron-right')) {
             titleDiv.click();
             return true;
          }
       }
       return false;
    });

    if (expandedGroup) {
       await new Promise(r => setTimeout(r, 500)); // wait for expansion
       console.log('Verifying sorting of items in SelectionConfigurator group...');
       const optionPoints = await page.evaluate(() => {
          const groups = Array.from(document.querySelectorAll('.selection-node-body > .sub-selection-group > div'));
          const expandedGroup = groups.find(group => {
             const titleDiv = group.firstElementChild;
             return titleDiv && titleDiv.innerHTML.includes('lucide-chevron-down');
          });
          if (!expandedGroup) return [];
          const items = Array.from(expandedGroup.querySelectorAll('.sub-selection-row'));
          return items.map(item => {
             const pointsEl = Array.from(item.querySelectorAll('span')).find(s => s.textContent.includes('Pkt.'));
             if (!pointsEl) return 0;
             const match = pointsEl.textContent.match(/\+?(\d+)/);
             return match ? parseInt(match[1], 10) : 0;
          });
       });
       console.log(`SelectionConfigurator option points: ${optionPoints.join(', ')}`);
       for (let i = 0; i < optionPoints.length - 1; i++) {
          if (optionPoints[i] < optionPoints[i+1]) {
             throw new Error(`SelectionConfigurator items are not sorted descending: ${optionPoints[i]} < ${optionPoints[i+1]}`);
          }
       }
    }

     // Test Copy Unit functionality
     console.log('Verifying copy unit functionality...');
     const selectionNodesCountBefore = await page.evaluate(() => {
        return document.querySelectorAll('.selection-node').length;
     });
     console.log(`Units count before copy: ${selectionNodesCountBefore}`);

     // Click the copy button (which has title="Kopieren") on the first selection node
     const copyButtonExists = await page.evaluate(() => {
        const copyBtn = document.querySelector('.selection-node .btn-primary[title="Kopieren"]');
        if (copyBtn) {
           copyBtn.click();
           return true;
        }
        return false;
     });
     if (!copyButtonExists) {
        throw new Error('Copy button not found on selection node');
     }

     await new Promise(r => setTimeout(r, 800)); // wait for state update

     const selectionNodesCountAfter = await page.evaluate(() => {
        return document.querySelectorAll('.selection-node').length;
     });
     console.log(`Units count after copy: ${selectionNodesCountAfter}`);

     if (selectionNodesCountAfter !== selectionNodesCountBefore + 1) {
        throw new Error(`Failed to copy unit. Expected ${selectionNodesCountBefore + 1} units, but found ${selectionNodesCountAfter}`);
     }
     console.log('Copy unit test: PASSED');

     // Change viewport to mobile (375x812)
    console.log('Changing viewport to mobile (375x812)...');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 1000));

    // Verify mobile status bar works correctly and is visible
    console.log('Verifying mobile status bar is visible...');
    const mobileBarVisible = await page.evaluate(() => {
      const el = document.querySelector('.mobile-sticky-status-bar');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (!mobileBarVisible) {
      throw new Error('Mobile sticky status bar is not visible in mobile viewport');
    }
    console.log('Mobile sticky status bar is visible.');

    // Click mobile status bar, which should trigger scroll to errors panel
    console.log('Clicking mobile status bar to scroll to general errors...');
    await page.click('.mobile-sticky-status-bar');
    await new Promise(r => setTimeout(r, 1000));

    // Verify validation error panel is visible in viewport/document
    console.log('Verifying validation error panel exists and is visible...');
    const panelExists = await page.evaluate(() => {
      const el = document.getElementById('general-errors-section');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (!panelExists) {
      throw new Error('Validation error panel is not visible or does not exist');
    }
    console.log('Validation error panel is visible.');

    console.log('ALL UI TESTS PASSED SUCCESSFULLY!');
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
};

const cleanup = () => {
  console.log('Cleaning up temporary ZIP file...');
  if (fs.existsSync(tempZipPath)) {
    fs.unlinkSync(tempZipPath);
  }

  if (serverProcess) {
    console.log('Killing Vite server process...');
    serverProcess.kill('SIGTERM');
  }
};

const run = async () => {
  try {
    await packCatalogs();
    await startViteServer();
    await runUiTests();
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('❌ UI TEST RUN FAILED:', err);
    cleanup();
    process.exit(1);
  }
};

run();
