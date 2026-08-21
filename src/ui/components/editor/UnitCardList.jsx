import React from 'react';
import UnitSelectionCard from './UnitSelectionCard';

/**
 * Rendert die Einheitenkarten einer Auswahlgruppe.
 *
 * Diese Komponente existiert, damit der umfangreiche Prop-Satz einer
 * Einheitenkarte nur noch an **einer** Stelle eingefädelt wird: zuvor stand
 * derselbe Aufruf dreifach im Editor (Kategorie-Sektion, armeeweite Auswahl,
 * „Sonstiges“), sodass jeder neue Prop dreifach nachgezogen werden musste.
 *
 * `cardContext` ist bewusst ein Bündel: es wird unverändert an jede Karte
 * durchgereicht und von dieser Liste selbst nie ausgewertet.
 */
export default function UnitCardList({ selections, cardContext }) {
  if (!selections || selections.length === 0) return null;

  return (
    <div className="unit-card-list">
      {selections.map(selection => (
        <UnitSelectionCard key={selection.id} selection={selection} {...cardContext} />
      ))}
    </div>
  );
}
