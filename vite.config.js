import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { latestVersion, nextVersion, formatVersion } from './scripts/versioning.js'

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
 * Creates a version tag for this build straight from git:
 *   - building main         → bump minor (patch reset to 0)
 *   - building any other branch → bump patch
 *   - major is only ever set manually and is never touched here
 * The tag is created before the changelog is generated (buildStart), so the
 * built changelog.json reflects the new version. It is also pushed so the next
 * build sees it and versions keep climbing monotonically.
 *
 * Opt-outs: SKIP_AUTO_TAG disables tagging entirely; AUTO_TAG_NO_PUSH keeps the
 * tag local (useful for local test builds).
 */
function createBuildTag() {
  if (!gitSafe('git rev-parse --is-inside-work-tree')) {
    console.warn('\x1b[36m[auto-tag]\x1b[0m Kein Git-Repository – übersprungen.');
    return;
  }

  const branch = detectBranch();
  const onMain = branch === 'main';
  const current = latestVersion(gitSafe("git tag -l 'v*.*.*'").split('\n').filter(Boolean));

  const next = nextVersion(current, onMain);
  let tag = formatVersion(next);
  // Avoid clashing with an existing tag (e.g. two branches building the same base).
  while (gitSafe(`git tag -l ${tag}`) === tag) {
    if (onMain) next.minor += 1; else next.patch += 1;
    tag = formatVersion(next);
  }

  try {
    execSync(`git tag -a ${tag} -m "Automatischer Build-Tag ${tag}"`, { stdio: 'ignore' });
  } catch (err) {
    console.warn(`\x1b[36m[auto-tag]\x1b[0m Konnte Tag ${tag} nicht erstellen: ${err.message}`);
    return;
  }
  console.log(`\x1b[36m[auto-tag]\x1b[0m ${branch || 'unbekannter Branch'} → ${tag}`);

  if (process.env.AUTO_TAG_NO_PUSH) {
    console.log(`\x1b[36m[auto-tag]\x1b[0m Push übersprungen (AUTO_TAG_NO_PUSH).`);
    return;
  }
  try {
    execSync(`git push origin ${tag}`, { stdio: 'ignore' });
    console.log(`\x1b[36m[auto-tag]\x1b[0m ${tag} gepusht.`);
  } catch {
    console.warn(`\x1b[36m[auto-tag]\x1b[0m ${tag} lokal erstellt, Push fehlgeschlagen (kein Remote-Zugriff?).`);
  }
}

/**
 * Vite plugin that auto-tags the build. Runs at buildStart so the tag exists
 * before the changelog plugin reads it at closeBundle.
 */
function autoTagPlugin() {
  return {
    name: 'auto-tag',
    apply: 'build',
    buildStart() {
      if (process.env.SKIP_AUTO_TAG) {
        console.log('\x1b[36m[auto-tag]\x1b[0m Übersprungen (SKIP_AUTO_TAG).');
        return;
      }
      createBuildTag();
    }
  };
}

/**
 * Builds the release notes for the current version from git tags.
 * "Current version" = the most recent tag; its changes = the commit subjects
 * between the previous tag and the current one (the whole history up to the
 * tag if it is the first one). Merge commits are skipped. Until the repo has a
 * tag the changelog is empty and the toast shows its generic message. The
 * result is served as /changelog.json so the running app can show "what's new"
 * when a service-worker update lands.
 */
function generateChangelog() {
  const opts = { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    const tags = execSync('git tag --sort=-creatordate', opts)
      .trim()
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    if (tags.length === 0) return { version: '', date: '', changes: [] };

    const latest = tags[0];
    const previous = tags[1];
    const range = previous ? `${previous}..${latest}` : latest;

    const out = execSync(`git log ${range} --no-merges --pretty=format:%s`, opts).trim();
    const changes = out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];

    const date = execSync(`git log -1 ${latest} --pretty=format:%cd --date=short`, opts).trim();

    return { version: latest, date, changes };
  } catch (err) {
    console.error('[changelog] Could not build changelog from git tags:', err.message);
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
  plugins: [react(), swVersionPlugin(), catalogManifestPlugin(), autoTagPlugin(), changelogPlugin()],
})

