/**
 * Reine Logik zur Bestimmung der Deploy-Umgebung eines Builds (ohne Git-/
 * Env-Zugriff, damit sie testbar bleibt). Verwendet von vite.config.js, das den
 * Wert als import.meta.env.VITE_DEPLOY_ENV in die App injiziert.
 *
 * Umgebungen:
 * - 'development' → lokaler Dev-Server (`vite`)
 * - 'production'  → Production-Deploy (Branch main) → Live-App
 * - 'staging'     → Staging-Deploy (Branch staging bzw. Vercel-Umgebung staging)
 * - 'preview'     → jeder andere Branch/PR (Vercel-Preview)
 */

/** Leitet die Umgebung allein aus dem gebauten Branch ab. */
function branchToEnv(branch) {
  if (branch === 'main') return 'production';
  if (branch === 'staging') return 'staging';
  return 'preview';
}

/**
 * @param {object} opts
 * @param {'serve'|'build'} opts.command  Vite-Kommando ('serve' = Dev-Server)
 * @param {string} [opts.branch]          gebauter Branch (leer bei unbekannt)
 * @param {string} [opts.targetEnv]       Vercels VERCEL_TARGET_ENV, falls gesetzt
 * @returns {'development'|'production'|'staging'|'preview'}
 */
export function resolveDeployEnv({ command, branch = '', targetEnv = '' }) {
  if (command === 'serve') return 'development';

  // Vercel benennt die (auch custom) Umgebung zuverlässig über
  // VERCEL_TARGET_ENV; VERCEL_ENV taugt dafür nicht, weil es bei custom
  // Pre-Prod-Umgebungen auf 'preview' steht. Darum TARGET_ENV bevorzugen und
  // nur als Fallback den Branch-Namen heranziehen.
  const env = targetEnv || branchToEnv(branch);

  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  if (env === 'development') return 'development';
  return 'preview';
}

/**
 * Umgebungen, die in der UI sichtbar gekennzeichnet werden sollen, damit sie
 * nicht mit der Live-App verwechselt werden (also alles außer Production/Dev).
 * @param {string} env
 * @returns {boolean}
 */
export function isFlaggedEnv(env) {
  return env === 'staging' || env === 'preview';
}
