import React from 'react';

// Wird zur Build-Zeit von vite.config.js via `define` gesetzt (siehe
// scripts/deployEnv.js). Auf Production/Dev bleibt der Badge unsichtbar.
const DEPLOY_ENV = import.meta.env.VITE_DEPLOY_ENV;

const LABELS = {
  preview: 'VORSCHAU',
};

/**
 * Kleiner Umgebungs-Hinweis im Header. Erscheint nur auf Nicht-Production-
 * Deploys (Vorschau), damit diese nicht mit der Live-App verwechselt
 * werden. Auf Production und im lokalen Dev-Betrieb wird nichts gerendert.
 */
export default function EnvBadge() {
  const label = LABELS[DEPLOY_ENV];
  if (!label) return null;
  return (
    <span
      className={`env-badge env-badge--${DEPLOY_ENV}`}
      title={`Diese Instanz ist die ${label}-Umgebung, nicht die Live-App.`}
    >
      {label}
    </span>
  );
}
