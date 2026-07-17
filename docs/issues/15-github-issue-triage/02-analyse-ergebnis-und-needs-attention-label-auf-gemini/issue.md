Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Baut auf Child-Issue 01 auf (Freigabe-/Implementierungs-Pfad bereits entfernt).
`analyze_issue` liefert heute noch `{labels, is_clear, questions,
implementation_plan}` über einen Anthropic-Call (`claude-opus-4-8`) und
appliziert ein freies, vom Modell gewähltes Label-Array. Das wird ersetzt
durch ein festes, einfaches Schema und einen Provider-Wechsel:

- Neues Rückgabeschema: `{is_clear: bool, questions: list[str],
  needs_attention: bool}`. `needs_attention=true` bedeutet: das Modell hält
  den Report für einen plausiblen Bug oder einen gut formulierten
  Feature-Request, der die Aufmerksamkeit des Maintainers verdient.
- Provider-Wechsel: `anthropic.Anthropic` → `google-genai`-Paket, Modell
  `gemini-3.1-flash-lite` (aktuelles Free-Tier-Flash-Lite-Modell laut
  [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
  — exakten Modellnamen und Client-Aufruf-Pattern bei der Umsetzung nochmal
  gegen die aktuelle offizielle Doku prüfen). Das bereits in GitHub Secrets
  hinterlegte `GEMINI_API_KEY` wird im Workflow als Env-Var reaktiviert
  (ersetzt `ANTHROPIC_API_KEY`); `pip install anthropic` im Workflow wird
  durch die entsprechende `google-genai`-Installation ersetzt.
- Label-Handling: statt des freien Label-Arrays wird nur noch das eine feste
  Label `needs-attention` gesetzt, wenn `needs_attention=true` ist. Der
  bestehende Kommentar-Loop (Rückfragen bei `is_clear=false`, gleiche
  Single-Comment-Konvention über `create_or_edit_agent_comment`) bleibt
  erhalten.
- Kein Entfernen des Labels in diesem Schritt (kein Re-Sync-Verhalten nötig) —
  das terminale Stop-Verhalten nach dem Setzen folgt in Child-Issue 03.

## Acceptance Criteria
- [ ] `analyze_issue` ruft die Gemini API auf (nicht mehr Anthropic) und gibt
      `{is_clear, questions, needs_attention}` zurück.
- [ ] Ein Issue, das als plausibler Bug/Feature-Request erkannt wird, erhält
      das Label `needs-attention`; es werden keine anderen/freien Labels mehr
      gesetzt.
- [ ] Ein unklares Issue erhält weiterhin einen Rückfrage-Kommentar (gleiche
      Single-Comment-Konvention wie bisher).
- [ ] Der Workflow verwendet `GEMINI_API_KEY` statt `ANTHROPIC_API_KEY` und
      installiert das `google-genai`-Paket statt `anthropic`.
- [ ] Unit-Test für `analyze_issue` mit gemocktem Gemini-Client (ersetzt/passt
      den bisherigen Anthropic-Mock an, sofern vorhanden).

## Comments
