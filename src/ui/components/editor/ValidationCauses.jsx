import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { CAUSES_TITLE_KEY, formatViolationCauses } from '../../i18n/violationMessages';

/**
 * Der „Ursachen"-Block einer Validierungsmeldung (ADR 0027): die einzige
 * Renderquelle für die auslösenden Auswahlen hinter einer Verletzung des
 * Evaluator-Berichts, an jeder Renderstelle identisch (SSOT). Trägt die
 * Verletzung keine Ursachen, rendert die Komponente nichts — die Meldung
 * bleibt wie ohne das Feld.
 *
 * @param {{ violation?: object }} props  `violation` ist eine Verletzung aus
 *   dem Bericht der Evaluator-Fassade (`src/contexts/ruleengine/evaluator.js`).
 */
export default function ValidationCauses({ violation }) {
  const { t } = useTranslation();
  const causes = formatViolationCauses(violation, t);
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
