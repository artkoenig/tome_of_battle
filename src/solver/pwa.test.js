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
    expect(swContent).toContain('self.addEventListener(\'message\'');
    expect(swContent).toContain('SKIP_WAITING');
    expect(swContent).toContain('caches.open');

    // Verify install block does NOT call skipWaiting (to let the update prompt toast display first)
    const installBlockMatch = swContent.match(/self\.addEventListener\('install'[\s\S]*?\}\);/);
    expect(installBlockMatch).not.toBeNull();
    expect(installBlockMatch[0]).not.toContain('skipWaiting');

    // Verify message block DOES call skipWaiting
    const messageBlockMatch = swContent.match(/self\.addEventListener\('message'[\s\S]*?\}\);/);
    expect(messageBlockMatch).not.toBeNull();
    expect(messageBlockMatch[0]).toContain('skipWaiting');
  });

  it('should have generated PNG icons in the public folder', () => {
    const faviconPath = path.join(rootDir, 'public/favicon.png');
    const icon192Path = path.join(rootDir, 'public/icon-192.png');
    const icon512Path = path.join(rootDir, 'public/icon-512.png');
    const iconMaskablePath = path.join(rootDir, 'public/icon-maskable.png');
    
    expect(fs.existsSync(faviconPath)).toBe(true);
    expect(fs.existsSync(icon192Path)).toBe(true);
    expect(fs.existsSync(icon512Path)).toBe(true);
    expect(fs.existsSync(iconMaskablePath)).toBe(true);
  });

  it('should link the favicon.png in index.html', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
  });

  it('should have the exact CACHE_NAME placeholder that the build plugin expects', () => {
    const swPath = path.join(rootDir, 'public/sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');
    // The sw-version Vite plugin replaces this exact string at build time.
    // If this placeholder changes, the plugin silently fails and updates break.
    expect(swContent).toContain("const CACHE_NAME = 'tome-of-battle-cache-v1'");
  });

  it('should have the sw-version plugin configured in vite.config.js', () => {
    const viteConfigPath = path.join(rootDir, 'vite.config.js');
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
    // The plugin must be defined and registered in the plugins array
    expect(viteContent).toContain("name: 'sw-version'");
    expect(viteContent).toContain('swVersionPlugin()');
  });

  it('should version the build read-only and write changelog.json via the version plugin', () => {
    const viteConfigPath = path.join(rootDir, 'vite.config.js');
    const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
    // The plugin derives version + changelog from git tags; it must NOT create
    // or push tags itself (tagging is owned by the CI workflow / tag script).
    expect(viteContent).toContain('versionPlugin()');
    expect(viteContent).toContain('resolveVersion');
    expect(viteContent).toContain("writeFileSync(join(outDir, 'changelog.json')");
    expect(viteContent).not.toContain('git tag -a');
    expect(viteContent).not.toContain('git push origin');
  });

  it('should own release tagging in the tag-release script and its workflow', () => {
    const scriptPath = path.join(rootDir, 'scripts/tag-release.js');
    const workflowPath = path.join(rootDir, '.github/workflows/tag-release.yml');
    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(fs.existsSync(workflowPath)).toBe(true);

    const script = fs.readFileSync(scriptPath, 'utf8');
    // The script is the single writer of tags: it resolves the version and pushes.
    expect(script).toContain('resolveVersion');
    expect(script).toContain('git tag -a');
    expect(script).toContain('git push origin');

    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('node scripts/tag-release.js');
  });

  it('should fetch the changelog fresh when an update is available', () => {
    const mainPath = path.join(rootDir, 'src/main.jsx');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    // A unique query string bypasses the outgoing service worker's cache so the
    // running app sees the newly-deployed version's notes, not the stale copy.
    expect(mainContent).toContain('/changelog.json?t=');
    expect(mainContent).toContain("detail: { worker, release }");
  });
});
