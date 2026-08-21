import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatViolation } from '../../i18n/violationMessages';
import ValidationCauses from './ValidationCauses';

/**
 * Eine Validierungsmeldung als Anzeige-Einheit: der Meldungssatz der aktiven
 * UI-Sprache zu einer Verletzung des Evaluator-Berichts und — falls vorhanden —
 * der „Ursachen"-Block (ADR 0027). Die eine Renderquelle dieser Einheit, an
 * jeder Renderstelle identisch (SSOT); die Renderstelle steuert nur ihren
 * eigenen Wrapper bei. Der Schweregrad der Verletzung bestimmt die Optik über
 * die Klasse `validation-message--<severity>`.
 *
 * @param {{ violation: object }} props  `violation` ist eine Verletzung aus
 *   dem Bericht der Evaluator-Fassade (`src/domain/evaluator/evaluator.js`).
 */
export default function ValidationMessage({ violation }) {
  const { t } = useTranslation();
  return (
    <div className={`validation-message validation-message--${violation?.severity}`}>
      <span>{formatViolation(violation, t)}</span>
      <ValidationCauses violation={violation} />
    </div>
  );
}
