import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const PORT = 5175;
const tempZipPath = path.resolve('./temp_whfb6.zip');
// Bei einem Fehlschlag festgehaltener Bildschirmzustand: so lässt sich der Grund am
// tatsächlichen UI ablesen (im CI als Artefakt hochgeladen), statt ihn aus einem
// Stacktrace zu erraten. Repo-Wurzel, damit der CI-Upload-Schritt ihn zuverlässig findet.
const failureScreenshotPath = path.resolve('./e2e-failure.png');
let serverProcess = null;

// 1. Pack the frozen E2E fixture (./src/solver/__fixtures__/whfb6/) into a temporary
// ZIP file using JSZip. This fixture is deliberately decoupled from public/catalogs/
// (see docs/issues/.../01-e2e-fixture-einfrieren) so this test exercises the app, not
// the catalog data, and stays deterministic and network-free.
const packCatalogs = async () => {
  console.log('Packing ./src/solver/__fixtures__/whfb6/ into a temporary ZIP file...');
  const zip = new JSZip();
  const dirPath = path.resolve('./src/solver/__fixtures__/whfb6');
  
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

// 2. Serve the app from a production build via `vite preview` (nicht der Dev-Server).
// Der Dev-Server transpiliert den Modulgraphen on-demand erst beim ersten Seitenaufruf;
// auf kalten CI-Runnern (frisches `npm ci`, kein warmer Vite-Cache) überschritt das unter
// Last die Aushebe-/Import-Warteschwelle — die App blieb im „Verarbeite XML-Dateien…"-
// Ladezustand hängen und der E2E riss reproduzierbar. Ein einmal vorab erzeugter Build wird
// statisch ausgeliefert: kein Laufzeit-Transpilieren, deterministische Ladezeit, und näher
// am echten Auslieferungszustand.

// 2a. Produktions-Build einmalig erzeugen; erst danach wird preview bedient.
const buildApp = () => {
  return new Promise((resolve, reject) => {
    console.log('Building production bundle (vite build)...');
    const proc = spawn('npx', ['vite', 'build'], { shell: true });
    proc.stdout.on('data', (data) => console.log(`[vite build] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => console.error(`[vite build stderr] ${data.toString().trim()}`));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        console.log('Production build complete.');
        resolve();
      } else {
        reject(new Error(`vite build exited with code ${code}`));
      }
    });
  });
};

// 2b. Den gebauten Bundle mit `vite preview` auf Port 5175 ausliefern.
const startPreviewServer = () => {
  return new Promise((resolve, reject) => {
    console.log(`Serving built bundle with vite preview on port ${PORT}...`);
    const proc = spawn('npx', ['vite', 'preview', '--port', PORT.toString(), '--strictPort'], {
      shell: true
    });

    serverProcess = proc;

    let resolved = false;

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      console.log(`[Vite preview] ${str.trim()}`);
      if ((str.includes(PORT.toString()) || str.includes('Local:')) && !resolved) {
        resolved = true;
        resolve(proc);
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(`[Vite preview stderr] ${data.toString()}`);
    });

    proc.on('error', (err) => {
      console.error('Failed to start Vite preview server:', err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    // Fallback timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('Preview server startup timeout reached, continuing...');
        resolve(proc);
      }
    }, 15000);
  });
};

// Opens the actions menu (MoreVertical popover) of the first top-level unit
// card and clicks the entry whose label matches (e.g. "Kopieren"/"Löschen").
// The unit actions used to be inline icon buttons; they now live behind a
// BottomSheet/popover, so the E2E drives that menu instead.
const openUnitActionAndClick = async (page, label) => {
  const opened = await page.evaluate(() => {
    const node = document.querySelector('.selection-node');
    const menuBtn = node?.querySelector('.unit-card-menu-container button[title="Aktionen"]');
    if (!menuBtn) return false;
    menuBtn.click();
    return true;
  });
  if (!opened) {
    throw new Error('Actions menu button not found on selection node');
  }

  await page.waitForFunction(
    (lbl) => Array.from(document.querySelectorAll('.popover-item')).some(i => i.textContent.includes(lbl)),
    { timeout: 5000 },
    label
  );

  const clicked = await page.evaluate((lbl) => {
    const item = Array.from(document.querySelectorAll('.popover-item')).find(i => i.textContent.includes(lbl));
    if (!item) return false;
    item.click();
    return true;
  }, label);
  if (!clicked) {
    throw new Error(`Action "${label}" not found in unit actions menu`);
  }
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

  // The app performs a silent catalog update from raw.githubusercontent.com at
  // startup (see docs/issues/.../06-katalog-update-zur-laufzeit). Block that host so
  // this E2E stays deterministic and network-free: the fetch fails silently and the
  // app keeps the frozen fixture data unchanged.
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes('raw.githubusercontent.com')) {
      request.abort();
    } else {
      request.continue();
    }
  });

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
        const fileInput = document.querySelector('#file-upload');
        if (!fileInput) {
          throw new Error('Bibliothekar button not found in header and #file-upload is not on the page');
        }
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

    // Wait for the system to import and render under "Importierte Spielsysteme".
    // Da der Bundle nun vorab gebaut und statisch ausgeliefert wird (siehe buildApp/
    // startPreviewServer), entfällt die frühere kalte-Vite-Transpilierlatenz; es bleibt der
    // reine client-seitige XML-Parse des WHFB6-Fixtures. 30 s geben dafür komfortable Reserve
    // gegen Runner-Last, ohne die frühere 60-s-Notbremse. Ein echter Hänger bleibt dank des
    // Fehler-Screenshots (siehe catch) diagnostizierbar.
    console.log('Waiting for system to be imported and parsed...');
    await page.waitForSelector('.desktop-nav-actions', { timeout: 30000 });
    console.log('System imported successfully.');

    // Return to dashboard
    console.log('Returning to Heerlager...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes('heerlager'));
      if (btn) {
        btn.click();
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
    await page.type('form input[type="text"]', 'Gutbusters of the Ogre Kingdoms');

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

    // Select Ogre Kingdoms catalog
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      const catSelect = selects[1];
      if (catSelect) {
        const option = Array.from(catSelect.options).find(o => o.text.includes('Ogre Kingdoms'));
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

    // Verify RosterSidebar heading and costs elements
    console.log('Verifying RosterSidebar heading and costs elements...');
    await page.evaluate(() => {
      const rightBar = document.querySelector('.builder-right-bar');
      if (!rightBar) throw new Error('Roster sidebar not found');
      
      const armeeHeader = Array.from(rightBar.querySelectorAll('h4')).find(h => h.textContent === 'Armeeanforderungen');
      if (!armeeHeader) {
        throw new Error('Sidebar does not contain "Armeeanforderungen" heading');
      }

      const totalCostsLabel = Array.from(rightBar.querySelectorAll('span')).find(s => s.textContent === 'Gesamtkosten:');
      if (!totalCostsLabel) {
        throw new Error('Sidebar does not contain "Gesamtkosten:" label');
      }
    });

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
    await new Promise(r => setTimeout(r, 1000)); // Wait for the 150ms validation debounce to run and render
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

     // Copy the first unit via its actions menu ("Kopieren")
     await openUnitActionAndClick(page, 'Kopieren');

     await new Promise(r => setTimeout(r, 800)); // wait for state update

     const selectionNodesCountAfter = await page.evaluate(() => {
        return document.querySelectorAll('.selection-node').length;
     });
     console.log(`Units count after copy: ${selectionNodesCountAfter}`);

     if (selectionNodesCountAfter !== selectionNodesCountBefore + 1) {
        throw new Error(`Failed to copy unit. Expected ${selectionNodesCountBefore + 1} units, but found ${selectionNodesCountAfter}`);
     }
     console.log('Copy unit test: PASSED');

      console.log('Verifying unit deletion confirmation - cancel scenario...');
      const countBeforeCancel = await page.evaluate(() => document.querySelectorAll('.selection-node').length);
      
      // Delete the first unit via its actions menu ("Löschen") — opens modal
      await openUnitActionAndClick(page, 'Löschen');
      
      // Wait for modal to open and click "Abbrechen"
      await page.waitForFunction(() => {
         const buttons = Array.from(document.querySelectorAll('button'));
         return buttons.some(b => b.textContent.includes('Abbrechen') && b.closest('.gothic-bottomsheet.open'));
      }, { timeout: 2000 });
      
      await page.evaluate(() => {
         const buttons = Array.from(document.querySelectorAll('button'));
         const cancelBtn = buttons.find(b => b.textContent.includes('Abbrechen') && b.closest('.gothic-bottomsheet.open'));
         if (cancelBtn) cancelBtn.click();
      });
      
      await new Promise(r => setTimeout(r, 800)); // wait for modal close

      const countAfterCancel = await page.evaluate(() => document.querySelectorAll('.selection-node').length);
      console.log(`Units count after cancel deletion: ${countAfterCancel}`);
      if (countAfterCancel !== countBeforeCancel) {
        throw new Error(`Unit was deleted even though deletion was cancelled. Expected ${countBeforeCancel}, got ${countAfterCancel}`);
      }
      console.log('Cancel deletion test: PASSED');

      console.log('Verifying unit deletion confirmation - accept scenario...');
      
      // Delete the first unit again via its actions menu ("Löschen")
      await openUnitActionAndClick(page, 'Löschen');
      
      // Wait for modal to open and click "Löschen" (btn-danger in modal)
      await page.waitForFunction(() => {
         const buttons = Array.from(document.querySelectorAll('.gothic-bottomsheet.open button.btn-danger'));
         return buttons.some(b => b.textContent.includes('Löschen'));
      }, { timeout: 2000 });

      await page.evaluate(() => {
         const buttons = Array.from(document.querySelectorAll('.gothic-bottomsheet.open button.btn-danger'));
         const deleteBtn = buttons.find(b => b.textContent.includes('Löschen'));
         if (deleteBtn) deleteBtn.click();
      });

      await new Promise(r => setTimeout(r, 800)); // wait for state update

      const countAfterAccept = await page.evaluate(() => document.querySelectorAll('.selection-node').length);
      console.log(`Units count after accept deletion: ${countAfterAccept}`);
      if (countAfterAccept !== countBeforeCancel - 1) {
        throw new Error(`Unit was not deleted. Expected ${countBeforeCancel - 1}, got ${countAfterAccept}`);
      }
      console.log('Accept deletion test: PASSED');

      // Change viewport to mobile (375x812)
    console.log('Changing viewport to mobile (375x812)...');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 1000));

     // Scroll to the bottom errors panel
     console.log('Scrolling to general errors section...');
     await page.evaluate(() => {
       const el = document.getElementById('general-errors-section');
       if (el) el.scrollIntoView();
     });
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
  } catch (err) {
    // Den UI-Zustand im Moment des Fehlers als Vollseiten-Screenshot festhalten, solange
    // die Seite noch offen ist (das `finally` schließt den Browser gleich). Der Screenshot
    // ist rein diagnostisch — der ursprüngliche Fehler wird unverändert weitergereicht.
    try {
      await page.screenshot({ path: failureScreenshotPath, fullPage: true });
      console.error(`Fehler-Screenshot gespeichert: ${failureScreenshotPath}`);
    } catch (shotErr) {
      console.error('Fehler-Screenshot konnte nicht erstellt werden:', shotErr.message);
    }
    throw err;
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
    await buildApp();
    await startPreviewServer();
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
