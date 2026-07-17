Status: ready-for-agent
Type: feature
Blocked by: [02]

## Description
Baut auf Child-Issue 02 auf (`needs-attention`-Label existiert bereits als
Konzept). Sobald ein Issue das Label `needs-attention` trägt, soll die
Automation komplett aufhören, darauf zu reagieren — der Maintainer übernimmt
ab dann manuell. Weitere Kommentare auf einem bereits gelabelten Issue dürfen
weder einen erneuten Gemini-API-Call auslösen noch den Bot-Kommentar oder das
Label verändern.

Neue Funktion `has_attention_label(issue_labels: list[str]) -> bool` (reine
Funktion, keine I/O) wird als allererster Check am Anfang des Skripts
aufgerufen, bevor irgendetwas anderes passiert (auch vor dem Aufbau des
Gemini-Clients). Liefert sie `true`, bricht das Skript sofort ab.

## Acceptance Criteria
- [ ] `has_attention_label(...)` ist eine unit-getestete, reine Funktion ohne
      I/O.
- [ ] Trägt ein Issue bereits `needs-attention`, macht ein weiterer
      Kommentar/`issue_comment`-Event keinen Gemini-API-Call und ändert weder
      den Bot-Kommentar noch irgendein Label.
- [ ] Ein frisch geöffnetes Issue (noch ohne Label) durchläuft die Analyse wie
      in Child-Issue 02 beschrieben ganz normal.

## Comments
