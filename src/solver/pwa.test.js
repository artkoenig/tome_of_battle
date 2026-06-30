import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Configuration and Assets', () => {
  const rootDir = path.resolve(__dirname, '../../');
  
  it('should link the manifest in index.html', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain('link rel="manifest" href="/manifest.json"');
  });

  it('should contain iOS mobile capability meta tags in index.html', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    expect(htmlContent).toContain('meta name="apple-mobile-web-app-capable" content="yes"');
    expect(htmlContent).toContain('meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(htmlContent).toContain('meta name="apple-mobile-web-app-title" content="Tome of Battle"');
    expect(htmlContent).toContain('link rel="apple-touch-icon" href="/icon-192.png"');
  });

  it('should have a valid public/manifest.json', () => {
    const manifestPath = path.join(rootDir, 'public/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    expect(manifest.name).toBe('Tome of Battle - Army Builder');
    expect(manifest.short_name).toBe('Tome of Battle');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.background_color).toBe('#0e0e11');
    expect(manifest.theme_color).toBe('#0e0e11');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    
    const icon192 = manifest.icons.find(i => i.sizes === '192x192');
    expect(icon192).toBeDefined();
    expect(icon192.src).toBe('/icon-192.png');
    
    const iconMaskable = manifest.icons.find(i => i.purpose === 'maskable');
    expect(iconMaskable).toBeDefined();
    expect(iconMaskable.src).toBe('/icon-maskable.png');
  });

  it('should have a public/sw.js file implementing the service worker', () => {
    const swPath = path.join(rootDir, 'public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('self.addEventListener(\'install\'');
    expect(swContent).toContain('self.addEventListener(\'activate\'');
    expect(swContent).toContain('self.addEventListener(\'fetch\'');
    expect(swContent).toContain('caches.open');
  });

  it('should have generated PNG icons in the public folder', () => {
    const icon192Path = path.join(rootDir, 'public/icon-192.png');
    const icon512Path = path.join(rootDir, 'public/icon-512.png');
    const iconMaskablePath = path.join(rootDir, 'public/icon-maskable.png');
    
    expect(fs.existsSync(icon192Path)).toBe(true);
    expect(fs.existsSync(icon512Path)).toBe(true);
    expect(fs.existsSync(iconMaskablePath)).toBe(true);
  });
});
