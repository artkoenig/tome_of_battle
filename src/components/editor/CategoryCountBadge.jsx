import React from 'react';
import { formatConstraintLimit } from '../../solver/validator';

/**
 * Setzt die wirksamen Min-/Max-Grenzen zu dem Zusatz hinter der Anzahl zusammen.
 * Grenzen, die nichts einschränken (kein Minimum, unbegrenztes Maximum), bleiben
 * weg — ein Chip soll nur zeigen, was tatsächlich gilt.
 */
function formatLimitSuffix({ minValue, maxValue, minConstraint, maxConstraint }) {
  const limitParts = [];
  if (minValue > 0) limitParts.push(`Min: ${formatConstraintLimit(minValue, minConstraint)}`);
  if (maxValue < Infinity) limitParts.push(`Max: ${formatConstraintLimit(maxValue, maxConstraint)}`);
  return limitParts.length > 0 ? `/ ${limitParts.join(', ')}` : '';
}

/**
 * Zähl-Chip im Kopf einer Kategorie: aktuelle Anzahl, dahinter die wirksamen
 * Grenzen. Trägt die Kategorie blockierende Meldungen, färbt sich der Chip.
 */
export default function CategoryCountBadge({
  count,
  minValue,
  maxValue,
  minConstraint,
  maxConstraint,
  hasErrors
}) {
  const limitText = formatLimitSuffix({ minValue, maxValue, minConstraint, maxConstraint });

  return (
    <span className={hasErrors ? 'badge badge-danger' : 'badge badge-muted'}>
      {count} {limitText}
    </span>
  );
}
