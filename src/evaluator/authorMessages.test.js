/**
 * Autor-Meldungen und ihr Token-Rendering (`authorMessages.js`, ADR-0028).
 *
 * Geprueft wird gegen einen schlanken Effektiv-Zustands-Doppelgaenger: das Modul
 * liest daraus nur die Meldungen eines Knotens und dessen effektiven Namen. Der
 * Ende-zu-Ende-Beleg an echten Katalogtexten liegt in den E2E-Szenarien; hier geht
 * es um die Regel selbst — **rendern ist keine Uebersetzung**.
 */

import { describe, it, expect } from 'vitest';
import { renderedAuthorMessagesOf } from './authorMessages.js';
import { MessageSeverity } from './model.js';

const NODE = Object.freeze({ id: 'node' });

/**
 * Ein Effektiv-Zustand, der genau die zwei Zugriffe beantwortet, die das Modul
 * macht: die Meldungen eines Knotens und seinen effektiven Namen.
 */
function effectiveStateWith(messages, name) {
  return {
    authorMessagesOf: () => messages,
    nameOf: () => name,
  };
}

/** Eine Autor-Meldung in der Form, die die Effektiv-Werte-Schicht ablegt. */
function message(text, severity = MessageSeverity.ERROR) {
  return { severity, text };
}

describe('renderedAuthorMessagesOf: belegte Text-Tokens (ADR-0028)', () => {
  it('ersetzt `{this}` durch den effektiven Namen des tragenden Knotens', () => {
    // Der belegte Katalogfall aus ADR-0028 (Ogre Kingdoms, Eintrag „Gnoblars").
    const effective = effectiveStateWith(
      [message('You cannot have more units of {this} than you have units of Ogre Bulls')],
      'Gnoblars',
    );

    expect(renderedAuthorMessagesOf(NODE, effective)).toEqual([
      { severity: MessageSeverity.ERROR, text: 'You cannot have more units of Gnoblars than you have units of Ogre Bulls' },
    ]);
  });

  it('ersetzt jedes Vorkommen des Tokens, nicht nur das erste', () => {
    const effective = effectiveStateWith([message('{this} requires 1+ other {this}')], 'Amazon');

    expect(renderedAuthorMessagesOf(NODE, effective)[0].text).toBe('Amazon requires 1+ other Amazon');
  });

  it('nimmt den **effektiven** Namen, nicht den Katalognamen', () => {
    // Ein Namens-Modifikator hat gegriffen; die Meldung nennt den Stand danach.
    const effective = effectiveStateWith([message('{this} is mandatory')], 'Gnoblars (Border Patrol)');

    expect(renderedAuthorMessagesOf(NODE, effective)[0].text).toBe('Gnoblars (Border Patrol) is mandatory');
  });

  it('laesst ein unbekanntes Token verbatim stehen (kein erfundenes Token)', () => {
    const effective = effectiveStateWith([message('{parent} allows {this}')], 'Rider');

    expect(renderedAuthorMessagesOf(NODE, effective)[0].text).toBe('{parent} allows Rider');
  });

  it('laesst `{this}` stehen, wenn der Knoten gar keinen Namen traegt', () => {
    // Lieber ein stehengebliebenes Token als ein „null" im Katalogtext.
    const effective = effectiveStateWith([message('{this} is mandatory')], null);

    expect(renderedAuthorMessagesOf(NODE, effective)[0].text).toBe('{this} is mandatory');
  });
});

describe('renderedAuthorMessagesOf: der Text bleibt sonst unangetastet', () => {
  it('reicht einen Text ohne Token unveraendert durch — inklusive Sonderzeichen', () => {
    // Geschuetzte Leerzeichen (U+00A0) und Anfuehrungszeichen kommen in den
    // Katalogtexten vor; sie duerfen nicht normalisiert werden.
    const catalogText = 'Please enable "Allow special characters?"';
    const effective = effectiveStateWith([message(catalogText)], 'Skrag the Slaughterer');

    expect(renderedAuthorMessagesOf(NODE, effective)[0].text).toBe(catalogText);
  });

  it('uebernimmt den Schweregrad des Katalogs unveraendert und haelt die Reihenfolge', () => {
    const effective = effectiveStateWith([
      message('first', MessageSeverity.INFO),
      message('second', MessageSeverity.WARNING),
    ], 'Bruiser');

    expect(renderedAuthorMessagesOf(NODE, effective)).toEqual([
      { severity: MessageSeverity.INFO, text: 'first' },
      { severity: MessageSeverity.WARNING, text: 'second' },
    ]);
  });

  it('liefert fuer einen Knoten ohne Meldungen eine leere Liste', () => {
    expect(renderedAuthorMessagesOf(NODE, effectiveStateWith([], 'Warrior'))).toEqual([]);
  });
});
