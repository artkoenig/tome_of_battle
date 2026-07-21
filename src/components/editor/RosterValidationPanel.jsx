import React from 'react';
import { Play, AlertTriangle, Check } from 'lucide-react';
import { hasBlockingViolations, ValidationSeverity } from '../../solver/validator';

/**
 * Der „Lagerbericht“ des Editors: Gesamtstatus der Liste, die blockierenden
 * Regelverstöße, die rein informativen Hinweise des Katalogautors und die
 * zusätzlichen Ressourcen-Summen.
 */
export default function RosterValidationPanel({ validationErrors, extraResources, onPlay }) {
  // Nur blockierende Verstöße (severity 'error') sperren das Spielen; rein informative
  // Hinweise (warning/info) erscheinen zwar in der Liste, gelten aber als regelkonform.
  const isRosterValid = !hasBlockingViolations(validationErrors);
  const generalErrors = validationErrors.filter(e => !e.categoryId && !e.selectionId);
  const contextualErrors = validationErrors.filter(
    e => (e.categoryId || e.selectionId) && e.severity === ValidationSeverity.ERROR
  );
  const advisoryMessages = validationErrors.filter(e => e.severity !== ValidationSeverity.ERROR);

  return (
    <div
      id="general-errors-section"
      className={`gothic-panel general-errors-panel ${isRosterValid ? 'general-errors-panel--valid' : 'general-errors-panel--invalid'}`}
    >
      <h3 className="font-serif text-gold general-errors-title">Lagerbericht (Gesamtstatus)</h3>

      {isRosterValid ? (
        <div className="flex-col gap-12">
          <div className="text-success text-ui-title flex-row gap-8 text-strong">
            <Check size={20} />
            <span>Streitmacht ist regelkonform und bereit für die Schlacht!</span>
          </div>
          <p className="text-body text-dim animate-fade-in roster-valid-flavour">
            „Die Schlachtreihen stehen fest, die Kriegstrommeln rufen nach den Tapferen. Führt Eure Streitmacht zum glorreichen Sieg!“
          </p>
          {/* Mobile-only Play button */}
          <div className="mobile-only w-full">
            <button
              type="button"
              className="btn-primary roster-play-btn-mobile"
              onClick={onPlay}
            >
              <Play size={18} /> Spielen
            </button>
          </div>
        </div>
      ) : (
        <div className="validation-error-list">
          {generalErrors.map((err, idx) => (
            <div key={idx} className="validation-error-item text-danger text-body flex-row gap-10">
              <AlertTriangle size={18} className="no-shrink" />
              <span>{err.message}</span>
            </div>
          ))}
          {/* Nachgelagerte Liste der Kategorie- und Auswahlfehler für den vollen Kontext */}
          {contextualErrors.map((err, idx) => (
            <div key={idx} className="validation-error-item validation-error-item--secondary text-danger text-body flex-row gap-10">
              <AlertTriangle size={18} className="no-shrink" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
      {/* Rein informative Hinweise des Katalogautors (warning/info) — sichtbar,
          aber ohne die Liste zu blockieren; daher unabhängig von isRosterValid. */}
      {advisoryMessages.length > 0 && (
        <div className="validation-error-list validation-error-list--advisory">
          {advisoryMessages.map((err, idx) => (
            <div key={idx} className="validation-error-item text-dim text-body flex-row gap-10">
              <AlertTriangle size={18} className="no-shrink" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
      {extraResources.length > 0 && (
        <div className="roster-extra-resources">
          {extraResources.map(res => (
            <div key={res.id} className="flex-between text-label text-dim">
              <span>{res.name}:</span>
              <span className="badge badge-muted">{res.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
