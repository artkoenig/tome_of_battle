import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generate() {
  console.log('Launching headless browser to render PWA icons...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const svgPath = path.join(__dirname, '../public/favicon.svg');
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Favicon not found at ${svgPath}`);
  }
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // Helper to build dynamic HTML document containing the SVG centered in a dark rounded square
  const getHTML = (size, isMaskable) => {
    // For maskable icon, we need more padding (safe area is 80% of the size)
    const padding = isMaskable ? '20%' : '12%';
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
            width: calc(100% - (${padding} * 2));
            height: calc(100% - (${padding} * 2));
            display: flex;
            justify-content: center;
            align-items: center;
          }
          svg {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div class="icon-container">
          ${svgContent}
        </div>
      </body>
      </html>
    `;
  };

  const targets = [
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
