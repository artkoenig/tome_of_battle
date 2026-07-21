import { deriveRevisionState, REVISION_STATE } from '../../db/catalogUpdate';

const REVISION_LABEL_PREFIX = 'Rev';
const REVISION_SEGMENT_SEPARATOR = ' · ';
const NEW_STATE_TEXT = 'neu';
const CURRENT_STATE_TEXT = 'aktuell';
const UPDATE_AVAILABLE_TEXT = 'Update verfügbar';
const LOCAL_REVISION_PREFIX = 'lokal';
const UNKNOWN_LOCAL_REVISION_TEXT = 'unbekannt';
const REVISION_LABEL_BASE_CLASS = 'bundle-revision-label';

// Visual tone of a revision status per ADR 0014's state matrix, mapped to the theme's
// helper classes: a subtle secondary text, the gold accent that flags an available
// update, and the neutral default for a self-uploaded (higher) local revision.
export const REVISION_TONE = {
  SUBTLE: 'text-dim',
  ACCENT: 'text-gold',
  NEUTRAL: '',
};

/**
 * The `revision` from a catpkg index entry is an optional integer update counter
 * (see ADR 0014). Older or incomplete indices may omit it, so a non-numeric value
 * yields no label rather than an error.
 */
function formatRevisionLabel(revision) {
  if (typeof revision !== 'number') return null;
  return `${REVISION_LABEL_PREFIX} ${revision}`;
}

function formatLocalRevisionSegment(localFile) {
  const localRevision = localFile?.revision;
  const value = typeof localRevision === 'number' ? localRevision : UNKNOWN_LOCAL_REVISION_TEXT;
  return `${LOCAL_REVISION_PREFIX} ${value}`;
}

// Per-state presentation (suffix segments appended after the available revision, plus
// tone). Keyed by state so a new state is added here rather than in a growing switch.
const REVISION_STATE_PRESENTATION = {
  [REVISION_STATE.NEW]: () => ({ segments: [NEW_STATE_TEXT], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.CURRENT]: () => ({ segments: [CURRENT_STATE_TEXT], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.OUTDATED]: (localFile) => ({
    segments: [formatLocalRevisionSegment(localFile), UPDATE_AVAILABLE_TEXT],
    tone: REVISION_TONE.ACCENT,
  }),
  [REVISION_STATE.AHEAD]: (localFile) => ({
    segments: [formatLocalRevisionSegment(localFile)],
    tone: REVISION_TONE.NEUTRAL,
  }),
};

/**
 * Builds the full revision display for one catalog file, comparing the available
 * revision against the locally stored file (or `null` when it is not imported). Returns
 * `{ text, tone }` per ADR 0014's state matrix, or `null` when no available revision is
 * known (nothing to show).
 */
export function buildRevisionDisplay(availableRevision, localFile) {
  const availableLabel = formatRevisionLabel(availableRevision);
  if (availableLabel === null) return null;

  const state = deriveRevisionState(availableRevision, localFile);
  const { segments, tone } = REVISION_STATE_PRESENTATION[state](localFile);
  return {
    text: [availableLabel, ...segments].join(REVISION_SEGMENT_SEPARATOR),
    tone,
  };
}

export function revisionLabelClassName(tone) {
  return [REVISION_LABEL_BASE_CLASS, tone].filter(Boolean).join(' ');
}
