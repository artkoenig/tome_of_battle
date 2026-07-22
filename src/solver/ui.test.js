import path from 'path';
import {
  REPO_ROOT,
  startAppServer,
  launchBrowser,
  openAppPage,
  resetAppState,
  importFixtureSystem,
} from '../../scripts/lib/e2e-harness.js';

// Fixture-Quelle, Produktions-Build, Auslieferung, Netzwerk-Sperre und
// Zustands-Reset liegen im gemeinsamen Harness (scripts/lib/e2e-harness.js), das
// sich dieser Test mit dem Screenshot-Skript teilt. Hier bleibt nur, was diesen
// Test ausmacht: die geprüften Zusicherungen.

// Bei einem Fehlschlag festgehaltener Bildschirmzustand: so lässt sich der Grund am
// tatsächlichen UI ablesen (im CI als Artefakt hochgeladen), statt ihn aus einem
// Stacktrace zu erraten. Repo-Wurzel, damit der CI-Upload-Schritt ihn zuverlässig findet.
const failureScreenshotPath = path.join(REPO_ROOT, 'e2e-failure.png');

// Opens the actions menu (MoreVertical popover) of the first top-level unit
// card and clicks the entry identified by its data-testid (e.g.
// "unit-action-copy"/"unit-action-delete"). Selecting by data-testid keeps the
// E2E language-independent — no reliance on visible German app-chrome labels.
// The unit actions used to be inline icon buttons; they now live behind a
// BottomSheet/popover, so the E2E drives that menu instead.
const openUnitActionAndClick = async (page, actionTestId) => {
  const opened = await page.evaluate(() => {
    const node = document.querySelector('.selection-node');
    const menuBtn = node?.querySelector('[data-testid="unit-actions-menu"]');
    if (!menuBtn) return false;
    menuBtn.click();
    return true;
  });
  if (!opened) {
    throw new Error('Actions menu button not found on selection node');
  }

  const actionSelector = `[data-testid="${actionTestId}"]`;
  await page.waitForSelector(actionSelector, { visible: true, timeout: 5000 });

  const clicked = await page.evaluate((selector) => {
    const item = document.querySelector(selector);
    if (!item) return false;
    item.click();
    return true;
  }, actionSelector);
  if (!clicked) {
    throw new Error(`Action "${actionTestId}" not found in unit actions menu`);
  }
};

// 3. Main UI test logic using Puppeteer
const runUiTests = async (server) => {
  console.log('Launching headless Puppeteer...');
  const browser = await launchBrowser();
  const page = await openAppPage(browser);

  try {
    await resetAppState(page, server.url);
    await importFixtureSystem(page, { fixtureZipPath: server.fixtureZipPath });

    // Return to dashboard
    console.log('Returning to Heerlager...');
    await page.evaluate(() => {
      const btn = document.querySelector('header [data-testid="nav-rosters"]');
      if (btn) {
        btn.click();
      }
    });

    // Click button to create a new roster
    console.log('Waiting for roster list area...');
    await page.waitForSelector('[data-testid="new-roster"]', { timeout: 5000 });
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="new-roster"]');
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

      const armyRequirements = rightBar.querySelector('[data-testid="sidebar-army-requirements"]');
      if (!armyRequirements) {
        throw new Error('Sidebar does not contain the army-requirements section');
      }

      const totalCosts = rightBar.querySelector('[data-testid="sidebar-total-costs"]');
      if (!totalCosts) {
        throw new Error('Sidebar does not contain the total-costs summary');
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
             // Die Kostenart-Bezeichnung kommt aus dem Katalog und darf hier nicht
             // festgeschrieben werden — der Kostenwert wird über seine Klasse gefunden.
             const pointsEl = item.querySelector('span.sub-selection-cost');
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

     // Copy the first unit via its actions menu (copy entry)
     await openUnitActionAndClick(page, 'unit-action-copy');

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
      
      // Delete the first unit via its actions menu (delete entry) — opens modal
      await openUnitActionAndClick(page, 'unit-action-delete');

      // Wait for the confirmation modal to open and click cancel
      await page.waitForFunction(() => {
         const cancelBtn = document.querySelector('[data-testid="unit-delete-cancel"]');
         return Boolean(cancelBtn && cancelBtn.closest('.gothic-bottomsheet.open'));
      }, { timeout: 2000 });

      await page.evaluate(() => {
         const cancelBtn = document.querySelector('.gothic-bottomsheet.open [data-testid="unit-delete-cancel"]');
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
      
      // Delete the first unit again via its actions menu (delete entry)
      await openUnitActionAndClick(page, 'unit-action-delete');

      // Wait for the confirmation modal to open and click confirm-delete
      await page.waitForFunction(() => {
         const confirmBtn = document.querySelector('.gothic-bottomsheet.open [data-testid="unit-delete-confirm"]');
         return Boolean(confirmBtn);
      }, { timeout: 2000 });

      await page.evaluate(() => {
         const confirmBtn = document.querySelector('.gothic-bottomsheet.open [data-testid="unit-delete-confirm"]');
         if (confirmBtn) confirmBtn.click();
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

const run = async () => {
  // Aufräumen bewusst vor process.exit: ein Exit im finally-Block würde diesen
  // überspringen und den Preview-Server als Waise zurücklassen.
  let server = null;
  let exitCode = 0;
  try {
    server = await startAppServer();
    await runUiTests(server);
  } catch (err) {
    console.error('❌ UI TEST RUN FAILED:', err);
    exitCode = 1;
  }
  if (server) server.stop();
  process.exit(exitCode);
};

run();
