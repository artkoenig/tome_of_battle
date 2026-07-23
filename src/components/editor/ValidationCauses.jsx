import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatValidationCauses, CAUSES_TITLE_KEY } from '../../i18n/formatValidationError';

/**
 * Der „Ursachen"-Block einer Validierungsmeldung (ADR 0027): die einzige
 * Renderquelle für die auslösenden Auswahlen hinter einem Verstoß, an jeder
 * Renderstelle identisch (SSOT, ADR 0022). Trägt der Verstoß keine Ursachen,
 * rendert die Komponente nichts — die Meldung bleibt wie ohne das Feld.
 *
 * @param {{ error?: import('../../types.js').ValidationError }} props
 */
export default function ValidationCauses({ error }) {
  const { t } = useTranslation();
  const causes = formatValidationCauses(error, t);
  if (causes.length === 0) return null;

  return (
    <div className="validation-causes">
      <span className="validation-causes-title text-label">{t(CAUSES_TITLE_KEY)}</span>
      <ul className="validation-causes-list">
        {causes.map((cause, index) => (
          <li key={index} className="validation-causes-item">{cause}</li>
        ))}
      </ul>
    </div>
  );
}
