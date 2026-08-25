import React from 'react';

/**
 * Setzt die wirksamen Min-/Max-Grenzen zu dem Zusatz hinter der Anzahl zusammen.
 * Die Werte kommen aus dem categoryAnchor-Slot des Evaluator-Berichts
 * (`effectiveMin`/`effectiveMax`; `null` = keine wirksame Grenze/unbegrenzt,
 * Issue 0121, Task 7). Grenzen, die nichts einschränken (kein Minimum,
 * unbegrenztes Maximum), bleiben weg — ein Chip soll nur zeigen, was
 * tatsächlich gilt.
 */
function formatLimitSuffix({ min, max }) {
  const limitParts = [];
  if (min !== null && min !== undefined && min > 0) limitParts.push(`Min: ${min}`);
  if (max !== null && max !== undefined) limitParts.push(`Max: ${max}`);
  return limitParts.length > 0 ? `/ ${limitParts.join(', ')}` : '';
}

/**
 * Keine wirksame Grenze. Als Literal im Parameter faellt `null` auf den Typ
 * `null`.
 *
 * @type {number|null}
 */
const NO_LIMIT = null;

/**
 * Zähl-Chip im Kopf einer Kategorie: aktuelle Anzahl, dahinter die wirksamen
 * Grenzen. Trägt die Kategorie blockierende Meldungen, färbt sich der Chip.
 */
export default function CategoryCountBadge({
  count,
  min = NO_LIMIT,
  max = NO_LIMIT,
  hasErrors
}) {
  const limitText = formatLimitSuffix({ min, max });

  return (
    <span className={hasErrors ? 'badge badge-danger' : 'badge badge-muted'}>
      {count} {limitText}
    </span>
  );
}
