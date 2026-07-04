import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { resolveVersion } from './scripts/versioning.js'

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

/** Runs a git command, returning trimmed stdout or '' on any failure. */
function gitSafe(cmd) {
  try {
    return execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Determines the branch being built. Build hosts often check out a detached
 * HEAD, so CI-provided branch names take precedence over `git rev-parse`.
 */
function detectBranch() {
  const envBranch =
    process.env.GITHUB_REF_NAME ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.CF_PAGES_BRANCH ||
    process.env.BRANCH ||
    '';
  if (envBranch) return envBranch;
  const branch = gitSafe('git rev-parse --abbrev-ref HEAD');
  return branch && branch !== 'HEAD' ? branch : '';
}

/**
 * On Vercel the repo is a shallow clone without tags, so best-effort fetch the
 * history and tags the versioning needs. No-op elsewhere (local/CI checkouts
 * already have them). Failures are swallowed — the build must never break here.
 */
function ensureGitHistory() {
  if (!process.env.VERCEL) return;
  gitSafe('git fetch --tags --unshallow'); // errors if already complete → ignored
  gitSafe('git fetch --tags');
}

/**
 * Computes this build's version and release notes from git — read only, never
 * creates or pushes anything (tagging is owned by scripts/tag-release.js in CI).
 *
 *   - building main         → next semver minor release (e.g. v1.5.0), or the
 *                             tag already on HEAD if this commit was released
 *   - building any other branch → current version + commit hash (v1.4.0+a1b2c3d)
 *   - major is only ever set manually
 *
 * Notes ("changes") are the commit subjects since the base release tag up to
 * HEAD — i.e. what is new in this build (merge commits skipped).
 *
 * @returns {{ version: string, date: string, changes: string[] }}
 */
function computeRelease() {
  if (!gitSafe('git rev-parse --is-inside-work-tree')) {
    return { version: '', date: '', changes: [] };
  }
  ensureGitHistory();

  const isMain = detectBranch() === 'main';
  const commitHash = gitSafe('git rev-parse --short HEAD');
  const tags = gitSafe("git tag -l 'v*.*.*'").split('\n').filter(Boolean);
  const headTags = gitSafe("git tag --points-at HEAD -l 'v*.*.*'").split('\n').filter(Boolean);

  const { version, base } = resolveVersion({ tags, headTags, isMain, commitHash });

  const logCmd = base
    ? `git log ${base}..HEAD --no-merges --pretty=format:%s`
    : 'git log -n 20 --no-merges --pretty=format:%s';
  const out = gitSafe(logCmd);
  const changes = out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];

  const date = gitSafe('git log -1 --pretty=format:%cd --date=short');

  return { version, date, changes };
}

/**
 * Vite plugin that versions the build (read only): at closeBundle it writes
 * changelog.json, and in dev it serves /changelog.json live so the update toast
 * can be tested without a build. Release tags are created separately by the
 * tag-release GitHub Actions workflow, not here.
 */
function versionPlugin() {
  let outDir;
  return {
    name: 'version',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const { version, date, changes } = computeRelease();
      writeFileSync(join(outDir, 'changelog.json'), JSON.stringify({ version, date, changes }, null, 2));
      console.log(`\x1b[36m[version]\x1b[0m ${version || 'unbekannt'} – ${changes.length} Änderung(en) in changelog.json.`);
    },
    configureServer(server) {
      server.middlewares.use('/changelog.json', (req, res) => {
        const { version, date, changes } = computeRelease();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ version, date, changes }, null, 2));
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
  plugins: [react(), swVersionPlugin(), catalogManifestPlugin(), versionPlugin()],
})

