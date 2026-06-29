import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set up console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:5173');
  
  // Wait for the app to load
  await page.waitForSelector('.app-header');
  
  // Enable debug mode
  await page.evaluate(() => {
    const debugBtn = document.querySelector('.app-header-actions button[title*="Debugging"]');
    if (debugBtn) debugBtn.click();
  });
  
  // Wait a moment for re-render
  await new Promise(r => setTimeout(r, 500));
  
  // Click on "Heerlager" to ensure we are in rosters view
  // Then click on a roster's "Ausrüsten" button to enter the builder
  const btn = await page.$('.roster-actions button'); // 'Ausrüsten' is the first button
  if (btn) {
    await btn.click();
    console.log("Clicked Ausrüsten");
  } else {
    console.log("No roster found, cannot enter builder");
    await browser.close();
    process.exit(0);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Wait for a clickable debug badge
  const badge = await page.$('.debug-id-badge.clickable');
  if (badge) {
    console.log("Found a clickable badge!");
    const text = await page.evaluate(b => b.textContent, badge);
    console.log("Badge text:", text);
    
    // override console.log in page to catch more
    await page.evaluate(() => {
      window.logCount = 0;
    });
    
    await badge.click();
    console.log("Clicked the badge!");
    
    await new Promise(r => setTimeout(r, 500));
    
    // Check if modal opened
    const modal = await page.$('.modal-overlay');
    if (modal) {
      console.log("Modal opened!");
    } else {
      console.log("Modal did NOT open.");
    }
  } else {
    console.log("No clickable badge found");
  }
  
  await browser.close();
})();
