import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generate() {
  console.log('Launching headless browser to render PWA icons and browser favicon...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Load source images
  const pwaIconPath = path.join(__dirname, '../public/pwa-icon.png');
  const faviconSourcePath = path.join(__dirname, '../public/favicon-source.png');
  
  if (!fs.existsSync(pwaIconPath)) {
    throw new Error(`PWA base icon not found at ${pwaIconPath}`);
  }
  if (!fs.existsSync(faviconSourcePath)) {
    throw new Error(`Favicon base icon not found at ${faviconSourcePath}`);
  }

  const pwaImgBuffer = fs.readFileSync(pwaIconPath);
  const pwaBase64 = pwaImgBuffer.toString('base64');
  const pwaImgSrc = `data:image/png;base64,${pwaBase64}`;

  const favImgBuffer = fs.readFileSync(faviconSourcePath);
  const favBase64 = favImgBuffer.toString('base64');
  const favImgSrc = `data:image/png;base64,${favBase64}`;

  // Helper to build HTML document containing the image
  const getHTML = (size, isMaskable, imgSrc, isFavicon) => {
    // For maskable icon, add a 15% padding (safe area) so corners are not clipped
    const paddingVal = isMaskable ? '15%' : '0%';
    const background = isFavicon ? 'transparent' : '#0e0e11';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: ${background};
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
    { size: 48, name: 'favicon.png', maskable: false, imgSrc: favImgSrc, isFavicon: true, omitBg: true },
    { size: 192, name: 'icon-192.png', maskable: false, imgSrc: pwaImgSrc, isFavicon: false, omitBg: false },
    { size: 512, name: 'icon-512.png', maskable: false, imgSrc: pwaImgSrc, isFavicon: false, omitBg: false },
    { size: 512, name: 'icon-maskable.png', maskable: true, imgSrc: pwaImgSrc, isFavicon: false, omitBg: false }
  ];

  for (const target of targets) {
    await page.setViewport({ width: target.size, height: target.size, deviceScaleFactor: 1 });
    await page.setContent(getHTML(target.size, target.maskable, target.imgSrc, target.isFavicon));
    const outputPath = path.join(__dirname, '../public', target.name);
    await page.screenshot({ path: outputPath, type: 'png', omitBackground: target.omitBg });
    console.log(`Generated public/${target.name} (${target.size}x${target.size})`);
  }

  await browser.close();
  console.log('All PWA icons and favicons successfully generated.');
}

generate().catch(err => {
  console.error('Failed to generate PWA icons:', err);
  process.exit(1);
});
