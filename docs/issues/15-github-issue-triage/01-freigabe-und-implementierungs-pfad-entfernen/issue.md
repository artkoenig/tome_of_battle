Status: ready-for-agent
Type: refactor
Blocked by: None

## Description
`scripts/github_issue_agent.py` und `.github/workflows/issue_agent.yml`
implementieren heute nach menschlicher Freigabe (`/approve`, `approved`,
`genehmigt`, …, plus Autorisierungs-Check) einen direkten Implementierungs-Pfad
über `claude-code-action`, der Code committet und einen PR öffnet. Dieser Pfad
entfällt komplett — die Automation soll künftig nur noch analysieren,
nachfragen und labeln, nie mehr implementieren.

Entfernen:
- `is_agent_requested`, `analyze_comment`, `is_authorized`,
  `find_implementation_plan`, `build_implementation_prompt`.
- Den `should_implement`/`implementation_prompt`-GITHUB_OUTPUT sowie den davon
  abhängigen zweiten Workflow-Step mit `claude-code-action@v1`.
- Die Workflow-Permissions `contents: write` und `pull-requests: write` (nur
  `issues: write` bleibt).

Die restliche Logik (Anthropic-Call in `analyze_issue`, das bestehende freie
Label-Array, der Kommentar-Loop über `create_or_edit_agent_comment`) bleibt in
diesem Schritt unverändert — Schema-Wechsel und Provider-Wechsel folgen im
nächsten Child-Issue.

## Acceptance Criteria
- [ ] Kein Kommentar-Keyword (`/approve`, `approved`, `genehmigt`, `/agent`,
      `@github-actions`, `/close`, `/cancel`, `/resolve`) löst mehr eine
      Aktion aus — es gibt keinen Code-Pfad mehr, der darauf reagiert.
- [ ] Der Workflow enthält keinen `claude-code-action`-Step mehr; es kann kein
      PR mehr aus diesem Workflow entstehen.
- [ ] Die Workflow-Permissions umfassen nur noch `issues: write`.
- [ ] Ein neu geöffnetes bzw. kommentiertes Issue wird weiterhin analysiert
      und erhält weiterhin einen Kommentar (Rückfragen oder Analyse) wie
      bisher — nur der Freigabe-/Implementierungs-Pfad ist weg.

## Comments
