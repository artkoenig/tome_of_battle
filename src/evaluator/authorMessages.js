/**
 * **Autor-Meldungen des Katalogs** (ADR-0022/0028) — *was sagt der Katalogautor?*
 *
 * Ein `add`-Modifikator auf `field="error"`/`"warning"`/`"info"` haengt einen
 * Meldungstext an den Knoten, an dem er greift; die Effektiv-Werte-Schicht sammelt
 * sie je Knoten (`effectiveState.authorMessagesOf`). Dieses Modul ist die eine
 * Stelle, die daraus die **anzeigefertige** Form macht: derselbe Text, aber mit
 * aufgeloesten BattleScribe-Text-Tokens.
 *
 * ── Rendern ist keine Uebersetzung (ADR-0028) ────────────────────────────────
 * Der Text bleibt in Katalogsprache — er wird weder uebersetzt noch umformuliert.
 * Aufgeloest wird allein, was BattleScribe selbst aufloest: das Token `{this}`,
 * das fuer den Namen des tragenden Eintrags steht. „Unangetastet" aus ADR-0022
 * verbietet die *Uebersetzung*, nicht die native Token-Darstellung; `{this}` waere
 * fuer den Leser schlicht sinnlos.
 *
 * Die Zuordnung ist eine **Tabelle**, kein Sonderfall-`if`: ein kuenftig belegtes
 * Token ist ein weiterer Eintrag. Ein Token **ohne** Eintrag bleibt verbatim
 * stehen — es gibt keine offizielle, vollstaendige Token-Spezifikation, und ein
 * erfundenes Token waere schlimmer als ein stehengebliebenes. In den
 * Fixture-Katalogen ist `{this}` das einzige vorkommende Token (7 Fundstellen, alle
 * in `modifier/@value` von `field="error"`/`"warning"`).
 */

/**
 * Muster eines BattleScribe-Text-Tokens: ein Bezeichner in geschweiften Klammern.
 * Es erkennt auch **unbelegte** Tokens — nur so kann die Tabelle unten
 * entscheiden, sie unveraendert stehen zu lassen, statt sie nie zu sehen.
 */
const TEXT_TOKEN_PATTERN = /\{[a-zA-Z]+\}/g;

/**
 * Die **belegten** Tokens und ihr Wert. `{this}` ist der Eintrag, an dem die
 * Meldung haengt — sein **effektiver** Name, also der Stand nach allen greifenden
 * Namens-Modifikatoren, nicht der rohe Katalogname.
 */
const TOKEN_VALUES = new Map([
  ['{this}', (node, effective) => effective.nameOf(node)],
]);

/**
 * Ersetzt die belegten Text-Tokens eines Katalogtexts durch ihren Wert. Ein
 * unbelegtes Token und ein Token ohne bestimmbaren Wert (ein Knoten ganz ohne
 * Namen) bleiben unveraendert stehen.
 */
function renderTextTokens(text, node, effective) {
  return text.replace(TEXT_TOKEN_PATTERN, token => {
    const valueOf = TOKEN_VALUES.get(token);
    if (valueOf === undefined) return token;
    const value = valueOf(node, effective);
    return value === null || value === undefined ? token : value;
  });
}

/**
 * Die Autor-Meldungen eines Knotens in Anwendungsreihenfolge, je mit ihrem
 * sprachfreien Schweregrad und dem Katalogtext mit **aufgeloesten Text-Tokens**.
 *
 * Sie sind die eine Quelle beider Berichtssichten: der Faehigkeitsdatensatz des
 * Slots fuehrt sie, und dieselben Meldungen erscheinen als Meldungen der Herkunft
 * `AUTHOR_MESSAGE` in der Meldungsliste. Zweimal zu rendern hiesse, zwei Texte zu
 * fuehren, die auseinanderlaufen koennen.
 *
 * @param {object} node  der tragende Knoten.
 * @param {import('./effectiveState.js').EffectiveState} effective  effektiver Zustand.
 * @returns {ReadonlyArray<{ severity: string, text: string }>}
 */
export function renderedAuthorMessagesOf(node, effective) {
  const messages = effective.authorMessagesOf(node);
  if (messages.length === 0) return messages;
  return messages.map(message => Object.freeze({
    severity: message.severity,
    text: renderTextTokens(message.text, node, effective),
  }));
}
