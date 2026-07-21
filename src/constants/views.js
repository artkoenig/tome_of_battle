/**
 * Die Hauptansichten der Anwendung. Die Navigation kommt ohne Router aus
 * (siehe ADR 0005), daher sind die erlaubten Ansichtswerte hier als benannte
 * Konstanten festgeschrieben statt als lose Strings.
 */
export const VIEWS = Object.freeze({
  ROSTERS: 'rosters',
  IMPORTER: 'importer',
  BUILDER: 'builder',
  PLAY: 'play',
});

/** @typedef {typeof VIEWS[keyof typeof VIEWS]} View */

/** Ansichten, die den Editor-/Spiel-Modus darstellen und das App-Layout umschalten. */
/** @type {ReadonlyArray<string>} */
const IMMERSIVE_VIEWS = Object.freeze([VIEWS.BUILDER, VIEWS.PLAY]);

/**
 * Ob eine Ansicht den bildschirmfüllenden Editor-/Spielmodus darstellt.
 * @param {string} view
 * @returns {boolean}
 */
export function isImmersiveView(view) {
  return IMMERSIVE_VIEWS.includes(view);
}
