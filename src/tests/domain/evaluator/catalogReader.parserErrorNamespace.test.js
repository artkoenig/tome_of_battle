/**
 * Die Erkennung kaputten Katalog-XMLs darf nicht am blossen Element*namen*
 * haengen (Issue 0105). `DOMParser` legt sein Fehlerdokument in einem eigenen
 * Namensraum ab — Mozilla-NS in jsdom/Firefox, XHTML-NS in Chrome/WebKit. Ein
 * **wohlgeformter** Katalog, der ein Element buchstaeblich namens
 * `parsererror` enthaelt, traegt keinen dieser Namensraeume und ist gewoehnlicher
 * Katalog-Inhalt; er darf nicht als `MALFORMED_XML` verworfen werden.
 *
 * - Kriterium 1: ein wohlgeformter Katalog mit einem `parsererror`-Element im
 *   Katalog-Namensraum wird normal geparst (`id: "cat-x"`, keine Diagnose).
 * - Kriterium 2: echte Parser-Fehler werden weiterhin in **beiden**
 *   Einbettungsformen erkannt — jsdom macht den `parsererror` zur Wurzel,
 *   Chrome bettet ihn unterhalb der Original-Wurzel ein.
 *
 * Die Chrome-Form wird hier deterministisch nachgebaut: das XML unten ist
 * wohlgeformt und erzeugt in jsdom genau die DOM-Form, die Chrome fuer einen
 * echten Parser-Fehler liefert (Original-Wurzel `catalogue`, darunter ein
 * `parsererror` im XHTML-Namensraum). Damit prueft die Suite die Chrome-Form
 * ohne einen Browser-Lauf.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from '../../../domain/evaluator/catalogReader.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const CATALOGUE_NAMESPACE = 'http://www.battlescribe.net/schema/catalogueSchema';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MOZILLA_PARSER_ERROR_NAMESPACE = 'http://www.mozilla.org/newlayout/xml/parsererror.xml';

// Das Repro des Issues: wohlgeformt, ohne Namensraum, mit einem Element, das
// zufaellig `parsererror` heisst.
const CATALOGUE_WITH_PARSERERROR_ELEMENT_XML = `<?xml version="1.0"?>`
  + `<catalogue id="cat-x" name="X"><parsererror>not an error</parsererror></catalogue>`;

// Dasselbe, aber im echten Katalog-Namensraum, wie ihn reale `.cat` tragen.
const NAMESPACED_CATALOGUE_WITH_PARSERERROR_ELEMENT_XML = `<?xml version="1.0"?>`
  + `<catalogue xmlns="${CATALOGUE_NAMESPACE}" id="cat-x" name="X">`
  + `<parsererror>not an error</parsererror></catalogue>`;

// Die Chrome-Form eines echten Parser-Fehlers: Original-Wurzel bleibt stehen,
// der `parsererror` sitzt als Kind darunter — im XHTML-Namensraum.
const CHROME_PARSER_ERROR_DOCUMENT_XML = `<?xml version="1.0"?>`
  + `<catalogue id="cat-broken" name="Broken">`
  + `<parsererror xmlns="${XHTML_NAMESPACE}">error on line 1 at column 1: Extra content at the end of the document</parsererror>`
  + `</catalogue>`;

// Die jsdom/Firefox-Form, hier ebenfalls als DOM-Form nachgebaut: der
// `parsererror` im Mozilla-Namensraum unterhalb der Original-Wurzel.
const MOZILLA_EMBEDDED_PARSER_ERROR_DOCUMENT_XML = `<?xml version="1.0"?>`
  + `<catalogue id="cat-broken" name="Broken">`
  + `<parsererror xmlns="${MOZILLA_PARSER_ERROR_NAMESPACE}">XML Parsing Error</parsererror>`
  + `</catalogue>`;

// Ein echter, von jsdom selbst erzeugter Parser-Fehler: der Wurzel-Tag wird
// nie geschlossen.
const UNCLOSED_TAG_XML = `<?xml version="1.0"?>`
  + `<catalogue id="cat-broken" name="Broken"><entryLinks>`;

describe('parseCatalogue: `parsererror` im Katalog-Namensraum ist kein Parser-Fehler (Kriterium 1)', () => {
  it('parst das Repro des Issues normal statt es als kaputtes XML zu verwerfen', () => {
    const result = parseCatalogue(CATALOGUE_WITH_PARSERERROR_ELEMENT_XML);

    expect(result.id).toBe('cat-x');
    expect(result.diagnostics).toEqual([]);
  });

  it('parst denselben Katalog auch im echten Katalog-Namensraum normal', () => {
    const result = parseCatalogue(NAMESPACED_CATALOGUE_WITH_PARSERERROR_ELEMENT_XML);

    expect(result.id).toBe('cat-x');
    expect(result.name).toBe('X');
    expect(result.diagnostics).toEqual([]);
  });
});

describe('parseCatalogue: echte Parser-Fehler bleiben in beiden Einbettungsformen erkannt (Kriterium 2)', () => {
  it('erkennt die von jsdom selbst erzeugte Fehlerwurzel (unverschlossener Tag)', () => {
    expect(parseCatalogue(UNCLOSED_TAG_XML).diagnostics).not.toEqual([]);
  });

  it('erkennt die Chrome-Form: `parsererror` im XHTML-Namensraum unter der Original-Wurzel', () => {
    const result = parseCatalogue(CHROME_PARSER_ERROR_DOCUMENT_XML);

    expect(result.id).toBeNull();
    expect(result.diagnostics).not.toEqual([]);
  });

  it('erkennt einen eingebetteten `parsererror` auch im Mozilla-Namensraum', () => {
    const result = parseCatalogue(MOZILLA_EMBEDDED_PARSER_ERROR_DOCUMENT_XML);

    expect(result.id).toBeNull();
    expect(result.diagnostics).not.toEqual([]);
  });
});
