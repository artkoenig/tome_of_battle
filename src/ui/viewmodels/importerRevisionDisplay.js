import { deriveRevisionState, REVISION_STATE } from '../../data/services/catalogRevisions';
import { t as translate } from '../i18n/i18nStore';

/**
 * Die Revisionsanzeige der Import-Hülle, aus `useImporter.js`
 * herausgeschnitten (Issue 0176). Hier ist das frühere
 * `components/importer/revisionDisplay.js` aufgegangen.
 */

const REVISION_LABEL_PREFIX = 'Rev';
const REVISION_SEGMENT_SEPARATOR = ' · ';
const REVISION_LABEL_BASE_CLASS = 'bundle-revision-label';

// Ton eines Revisionsstands nach der Zustandsmatrix von ADR 0014, abgebildet
// auf die Hilfsklassen des Themes.
export const REVISION_TONE = {
  SUBTLE: 'text-dim',
  ACCENT: 'text-gold',
  NEUTRAL: '',
};

/**
 * Die `revision` eines catpkg-Index-Eintrags ist ein optionaler Zähler (ADR
 * 0014). Ältere oder unvollständige Indizes lassen ihn weg — ein nicht
 * numerischer Wert ergibt daher kein Label statt eines Fehlers.
 */
function formatRevisionLabel(revision) {
  if (typeof revision !== 'number') return null;
  return `${REVISION_LABEL_PREFIX} ${revision}`;
}

function formatLocalRevisionSegment(localFile, t) {
  const localRevision = localFile?.revision;
  const value = typeof localRevision === 'number' ? localRevision : t('importer.revision.unknown');
  return `${t('importer.revision.localPrefix')} ${value}`;
}

// Darstellung je Zustand (Zusatz-Segmente nach der verfügbaren Revision, plus
// Ton). Nach Zustand geschlüsselt, damit ein neuer Zustand hier ergänzt wird
// statt in einer wachsenden Fallunterscheidung.
const REVISION_STATE_PRESENTATION = {
  [REVISION_STATE.NEW]: (_localFile, t) => ({ segments: [t('importer.revision.new')], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.CURRENT]: (_localFile, t) => ({ segments: [t('importer.revision.current')], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.OUTDATED]: (localFile, t) => ({
    segments: [formatLocalRevisionSegment(localFile, t), t('importer.revision.updateAvailable')],
    tone: REVISION_TONE.ACCENT,
  }),
  [REVISION_STATE.AHEAD]: (localFile, t) => ({
    segments: [formatLocalRevisionSegment(localFile, t)],
    tone: REVISION_TONE.NEUTRAL,
  }),
};

/**
 * Die vollständige Revisionsanzeige einer Katalogdatei: die verfügbare
 * Revision gegen die lokal gespeicherte (`null`, wenn nicht importiert).
 * Ergibt `{ text, tone }` nach der Zustandsmatrix von ADR 0014, oder `null`,
 * wenn keine verfügbare Revision bekannt ist.
 */
export function buildRevisionDisplay(availableRevision, localFile, t = translate) {
  const availableLabel = formatRevisionLabel(availableRevision);
  if (availableLabel === null) return null;

  const state = deriveRevisionState(availableRevision, localFile);
  const { segments, tone } = REVISION_STATE_PRESENTATION[state](localFile, t);
  return {
    text: [availableLabel, ...segments].join(REVISION_SEGMENT_SEPARATOR),
    tone,
  };
}

export function revisionLabelClassName(tone) {
  return [REVISION_LABEL_BASE_CLASS, tone].filter(Boolean).join(' ');
}
