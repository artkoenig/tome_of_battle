/**
 * Reine Logik zur Bestimmung der Deploy-Umgebung eines Builds (ohne Git-/
 * Env-Zugriff, damit sie testbar bleibt). Verwendet von vite.config.js, das den
 * Wert als import.meta.env.VITE_DEPLOY_ENV in die App injiziert.
 *
 * Umgebungen:
 * - 'development' → lokaler Dev-Server (`vite`)
 * - 'production'  → Production-Deploy (Branch main) → Live-App
 * - 'preview'     → jeder andere Branch/PR (Vercel-Preview)
 */

/**
 * @param {object} opts
 * @param {'serve'|'build'} opts.command  Vite-Kommando ('serve' = Dev-Server)
 * @param {string} [opts.branch]          gebauter Branch (leer bei unbekannt)
 * @param {string} [opts.targetEnv]       Vercels VERCEL_TARGET_ENV/VERCEL_ENV, falls gesetzt
 * @returns {'development'|'production'|'preview'}
 */
export function resolveDeployEnv({ command, branch = '', targetEnv = '' }) {
  if (command === 'serve') return 'development';

  // Branch-Namen (main) haben Vorrang für Production. Alles andere ist Preview,
  // es sei denn, targetEnv überschreibt es.
  if (branch === 'main') return 'production';

  const env = targetEnv || 'preview';

  if (env === 'production') return 'production';
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
  return env === 'preview';
}
