import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'

/**
 * Vite plugin that injects a unique build version into sw.js
 * so browsers detect a new service worker on each deployment.
 * Without this, sw.js never changes between builds and the browser
 * never fires the 'updatefound' event → the update toast never appears.
 */
function swVersionPlugin() {
  let outDir;
  return {
    name: 'sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;

      let content = readFileSync(swPath, 'utf8');
      const buildId = Date.now().toString(36);
      content = content.replace(
        "const CACHE_NAME = 'tome-of-battle-cache-v1'",
        `const CACHE_NAME = 'tome-of-battle-cache-${buildId}'`
      );
      writeFileSync(swPath, content);
      console.log(`\x1b[36m[sw-version]\x1b[0m Injected build ID: ${buildId}`);
    }
  };
}

/**
 * Vite plugin that scans public/catalogs for game systems and catalogs
 * and automatically generates public/catalogs/manifest.json.
 */
function catalogManifestPlugin() {
  return {
    name: 'catalog-manifest',
    buildStart() {
      generateManifest();
    },
    configureServer(server) {
      generateManifest();
      server.watcher.add(resolve('public/catalogs'));
      server.watcher.on('all', (event, path) => {
        if (path.includes('public/catalogs') && !path.endsWith('manifest.json')) {
          generateManifest();
        }
      });
    }
  };
}

function generateManifest() {
  const catalogsDir = resolve('public/catalogs');
  if (!existsSync(catalogsDir)) return;

  const manifestPath = join(catalogsDir, 'manifest.json');
  const systems = [];

  try {
    const entries = readdirSync(catalogsDir);
    for (const entry of entries) {
      const entryPath = join(catalogsDir, entry);
      if (statSync(entryPath).isDirectory()) {
        const files = readdirSync(entryPath);
        const gstFile = files.find(f => f.endsWith('.gst'));
        if (!gstFile) continue;

        const gstPath = join(entryPath, gstFile);
        const gstContent = readFileSync(gstPath, 'utf8');
        const gstMeta = extractIdAndName(gstContent, 'gameSystem');
        if (!gstMeta) continue;

        const system = {
          id: gstMeta.id,
          name: gstMeta.name,
          dir: entry,
          gst: {
            id: gstMeta.id,
            name: gstMeta.name,
            fileName: gstFile
          },
          catalogues: []
        };

        const catFiles = files.filter(f => f.endsWith('.cat'));
        for (const catFile of catFiles) {
          const catPath = join(entryPath, catFile);
          const catContent = readFileSync(catPath, 'utf8');
          const catMeta = extractIdAndName(catContent, 'catalogue');
          if (catMeta) {
            system.catalogues.push({
              id: catMeta.id,
              name: catMeta.name,
              fileName: catFile
            });
          }
        }

        system.catalogues.sort((a, b) => a.name.localeCompare(b.name));
        systems.push(system);
      }
    }

    writeFileSync(manifestPath, JSON.stringify(systems, null, 2), 'utf8');
    console.log(`\x1b[36m[catalog-manifest]\x1b[0m Generated manifest.json with ${systems.length} systems.`);
  } catch (err) {
    console.error('[catalog-manifest] Error generating manifest:', err);
  }
}

/**
 * Builds the release notes for the current version straight from git history.
 * "Current version" = the commits since the most recent git tag; if the repo
 * has no tags yet, the 10 most recent commits are used. Merge commits are
 * skipped. The result is served as /changelog.json so the running app can show
 * "what's new" when a service-worker update lands.
 */
function generateChangelog() {
  const opts = { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    let range = '';
    try {
      const tag = execSync('git describe --tags --abbrev=0', opts).trim();
      if (tag) range = `${tag}..HEAD`;
    } catch {
      // No tags yet — fall back to the most recent commits below.
    }

    const logCmd = range
      ? `git log ${range} --no-merges --pretty=format:%s`
      : 'git log -n 10 --no-merges --pretty=format:%s';
    const out = execSync(logCmd, opts).trim();
    const changes = out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];

    const version = execSync('git rev-parse --short HEAD', opts).trim();
    const date = execSync('git log -1 --pretty=format:%cd --date=short', opts).trim();

    return { version, date, changes };
  } catch (err) {
    console.error('[changelog] Could not build changelog from git:', err.message);
    return { version: '', date: '', changes: [] };
  }
}

/**
 * Vite plugin that writes the git-derived changelog to the build output as
 * changelog.json, and serves it live during dev so the update toast can be
 * tested without a production build.
 */
function changelogPlugin() {
  let outDir;
  return {
    name: 'changelog',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const data = generateChangelog();
      writeFileSync(join(outDir, 'changelog.json'), JSON.stringify(data, null, 2));
      console.log(`\x1b[36m[changelog]\x1b[0m Wrote ${data.changes.length} change(s) for ${data.version || 'unknown'}`);
    },
    configureServer(server) {
      server.middlewares.use('/changelog.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(generateChangelog(), null, 2));
      });
    }
  };
}

function extractIdAndName(content, tag) {
  const slice = content.slice(0, 5000);
  const tagRegex = new RegExp(`<${tag}[^>]+>`);
  const tagMatch = slice.match(tagRegex);
  if (tagMatch) {
    const fullTag = tagMatch[0];
    const idMatch = fullTag.match(/id="([^"]+)"/);
    const nameMatch = fullTag.match(/name="([^"]+)"/);
    if (idMatch && nameMatch) {
      return { id: idMatch[1], name: nameMatch[1] };
    }
  }
  return null;
}

export default defineConfig({
  plugins: [react(), swVersionPlugin(), catalogManifestPlugin(), changelogPlugin()],
})

