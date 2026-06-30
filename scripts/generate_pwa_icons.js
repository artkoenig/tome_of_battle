import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generate() {
  console.log('Launching headless browser to render PWA icons from golden skull template...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const iconPath = path.join(__dirname, '../public/pwa-icon.png');
  if (!fs.existsSync(iconPath)) {
    throw new Error(`PWA base icon not found at ${iconPath}`);
  }
  const imgBuffer = fs.readFileSync(iconPath);
  const base64Img = imgBuffer.toString('base64');
  const imgSrc = `data:image/png;base64,${base64Img}`;

  // Helper to build dynamic HTML document containing the image centered
  const getHTML = (size, isMaskable) => {
    // For maskable icon, add a 15% padding (safe area) so corners are not clipped
    const paddingVal = isMaskable ? '15%' : '0%';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #0e0e11;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
          }
          .icon-container {
            width: calc(100% - (${paddingVal} * 2));
            height: calc(100% - (${paddingVal} * 2));
            display: flex;
            justify-content: center;
            align-items: center;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="icon-container">
          <img src="${imgSrc}" />
        </div>
      </body>
      </html>
    `;
  };

  const targets = [
    { size: 48, name: 'favicon.png', maskable: false },
    { size: 192, name: 'icon-192.png', maskable: false },
    { size: 512, name: 'icon-512.png', maskable: false },
    { size: 512, name: 'icon-maskable.png', maskable: true }
  ];

  for (const target of targets) {
    await page.setViewport({ width: target.size, height: target.size, deviceScaleFactor: 1 });
    await page.setContent(getHTML(target.size, target.maskable));
    const outputPath = path.join(__dirname, '../public', target.name);
    await page.screenshot({ path: outputPath, type: 'png', omitBackground: false });
    console.log(`Generated public/${target.name} (${target.size}x${target.size})`);
  }

  await browser.close();
  console.log('All PWA icons successfully generated.');
}

generate().catch(err => {
  console.error('Failed to generate PWA icons:', err);
  process.exit(1);
});
