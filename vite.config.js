import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { latestVersion, buildVersionString, formatVersion, parseVersion } from './scripts/versioning.js'

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
 * Computes this build's version and release notes from git (without creating
 * anything). Single source of truth for both the tag and changelog.json.
 *
 *   - building main         → next semver minor release (e.g. v1.5.0), tagged
 *   - building any other branch → current version + commit hash (v1.4.0+a1b2c3d),
 *                                 not a release, so not tagged
 *   - major is only ever set manually and is never touched here
 *
 * Notes ("changes") are the commit subjects since the latest existing release
 * tag up to HEAD — i.e. what is new in this build (merge commits skipped).
 *
 * @returns {{ version: string, date: string, changes: string[], tag: string|null }}
 */
function computeRelease() {
  if (!gitSafe('git rev-parse --is-inside-work-tree')) {
    return { version: '', date: '', changes: [], tag: null };
  }

  const isMain = detectBranch() === 'main';
  const commitHash = gitSafe('git rev-parse --short HEAD');
  const tags = gitSafe("git tag -l 'v*.*.*'").split('\n').filter(Boolean);
  const releaseTags = tags.filter((t) => parseVersion(t));
  const latest = latestVersion(tags);

  const version = buildVersionString({ latest, isMain, commitHash, existingTags: tags });
  const tag = isMain ? version : null;

  // Range for the notes: since the newest existing release tag, up to HEAD.
  const base = releaseTags.length ? formatVersion(latest) : '';
  const logCmd = base
    ? `git log ${base}..HEAD --no-merges --pretty=format:%s`
    : 'git log -n 20 --no-merges --pretty=format:%s';
  const out = gitSafe(logCmd);
  const changes = out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];

  const date = gitSafe('git log -1 --pretty=format:%cd --date=short');

  return { version, date, changes, tag };
}

/** Creates and (unless opted out) pushes the release tag for a main build. */
function createReleaseTag(tag) {
  if (gitSafe(`git tag -l ${tag}`) === tag) {
    console.warn(`\x1b[36m[version]\x1b[0m Tag ${tag} existiert bereits – Tagging übersprungen.`);
    return;
  }
  try {
    execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'ignore' });
  } catch (err) {
    console.warn(`\x1b[36m[version]\x1b[0m Konnte Tag ${tag} nicht erstellen: ${err.message}`);
    return;
  }
  console.log(`\x1b[36m[version]\x1b[0m Release-Tag ${tag} erstellt.`);

  if (process.env.AUTO_TAG_NO_PUSH) {
    console.log('\x1b[36m[version]\x1b[0m Push übersprungen (AUTO_TAG_NO_PUSH).');
    return;
  }
  try {
    execSync(`git push origin ${tag}`, { stdio: 'ignore' });
    console.log(`\x1b[36m[version]\x1b[0m ${tag} gepusht.`);
  } catch {
    console.warn(`\x1b[36m[version]\x1b[0m ${tag} lokal erstellt, Push fehlgeschlagen (kein Remote-Zugriff?).`);
  }
}

/**
 * Vite plugin that versions the build. At buildStart it computes the version,
 * tags main releases (opt-outs: SKIP_AUTO_TAG disables tagging, AUTO_TAG_NO_PUSH
 * keeps it local), and at closeBundle writes changelog.json. In dev it serves
 * /changelog.json live so the update toast can be tested without a build.
 */
function versionPlugin() {
  let outDir;
  let release = null;
  return {
    name: 'version',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      release = computeRelease();
      if (release.tag && !process.env.SKIP_AUTO_TAG) {
        createReleaseTag(release.tag);
      } else if (release.tag) {
        console.log('\x1b[36m[version]\x1b[0m Tagging übersprungen (SKIP_AUTO_TAG).');
      }
    },
    closeBundle() {
      const { version, date, changes } = release || computeRelease();
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

