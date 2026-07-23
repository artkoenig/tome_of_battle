import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatValidationError } from '../../i18n/formatValidationError';
import ValidationCauses from './ValidationCauses';

/**
 * Eine Validierungsmeldung als Anzeige-Einheit: der Meldungssatz der aktiven
 * UI-Sprache und — falls vorhanden — der „Ursachen"-Block (ADR 0027). Die eine
 * Renderquelle dieser Einheit, an jeder Renderstelle identisch (SSOT, ADR 0022);
 * die Renderstelle steuert nur ihren eigenen Wrapper bei.
 *
 * @param {{ error: import('../../types.js').ValidationError }} props
 */
export default function ValidationMessage({ error }) {
  const { t } = useTranslation();
  return (
    <>
      <span>{formatValidationError(error, t)}</span>
      <ValidationCauses error={error} />
    </>
  );
}
