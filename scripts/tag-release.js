#!/usr/bin/env node
/**
 * Erzeugt und pusht den Release-Tag für einen main-Build. Läuft im
 * GitHub-Actions-Workflow (die einzige Umgebung mit Push-Rechten). Die
 * Versionsberechnung teilt sich diese Datei mit dem read-only versionPlugin in
 * vite.config.js (beide nutzen resolveVersion), damit Tag und der von Vercel
 * gebaute Changelog dieselbe Version tragen.
 *
 * Verhalten:
 *   - main + HEAD noch nicht getaggt → nächster Minor-Release-Tag, push
 *   - main + HEAD bereits getaggt     → nichts zu tun (idempotent)
 *   - anderer Branch                  → nichts zu tun (kein Release)
 *
 * AUTO_TAG_NO_PUSH=1 erstellt den Tag nur lokal (für Tests).
 */
import { execSync } from 'node:child_process';
import { resolveVersion } from './versioning.js';

function gitSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const branch = process.env.GITHUB_REF_NAME || gitSafe('git rev-parse --abbrev-ref HEAD');
const isMain = branch === 'main';
const commitHash = gitSafe('git rev-parse --short HEAD');
const tags = gitSafe("git tag -l 'v*.*.*'").split('\n').filter(Boolean);
const headTags = gitSafe("git tag --points-at HEAD -l 'v*.*.*'").split('\n').filter(Boolean);

const { tag } = resolveVersion({ tags, headTags, isMain, commitHash });

if (!tag) {
  console.log(`[tag-release] Kein neuer Release-Tag nötig (Branch: ${branch || 'unbekannt'}).`);
  process.exit(0);
}

execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'ignore' });
console.log(`[tag-release] Tag ${tag} erstellt.`);

if (process.env.AUTO_TAG_NO_PUSH) {
  console.log('[tag-release] Push übersprungen (AUTO_TAG_NO_PUSH).');
  process.exit(0);
}

execSync(`git push origin ${tag}`, { stdio: 'inherit' });
console.log(`[tag-release] ${tag} gepusht.`);
