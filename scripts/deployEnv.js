/**
 * Reine Logik zur Bestimmung der Deploy-Umgebung eines Builds (ohne Git-/
 * Env-Zugriff, damit sie testbar bleibt). Verwendet von vite.config.js, das den
 * Wert als import.meta.env.VITE_DEPLOY_ENV in die App injiziert.
 *
 * Umgebungen:
 * - 'development' → lokaler Dev-Server (`vite`)
 * - 'production'  → Build vom production-Branch (main) → Live-App
 * - 'staging'     → Build vom staging-Branch → feste Staging-URL
 * - 'preview'     → Build eines beliebigen anderen Branches/PRs (Vercel-Preview)
 */

/**
 * @param {object} opts
 * @param {'serve'|'build'} opts.command  Vite-Kommando ('serve' = Dev-Server)
 * @param {string} opts.branch            gebauter Branch (leer bei unbekannt)
 * @returns {'development'|'production'|'staging'|'preview'}
 */
export function resolveDeployEnv({ command, branch }) {
  if (command === 'serve') return 'development';
  if (branch === 'main') return 'production';
  if (branch === 'staging') return 'staging';
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
