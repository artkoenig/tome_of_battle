const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // We need the dev server to be running. I'll check if it is, or run it.
  console.log('Script loaded');
  await browser.close();
})();
