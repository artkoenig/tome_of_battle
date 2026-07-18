Status: resolved
Type: chore
Blocked by: None

## Description
Root-`CLAUDE.md` ist ein Git-Symlink auf den absoluten, maschinenspezifischen
Pfad `/Users/artkoenig/.agents/AGENTS.md`. Der Link ist in jeder Umgebung
außer dem einen Mac tot (Cloud-Session, andere Contributor, CI). Die realen
Projektregeln liegen bereits real und getrackt in `.agents/AGENTS.md`.
`CLAUDE.md` soll stattdessen relativ auf `.agents/AGENTS.md` verweisen.

## Acceptance Criteria
- [ ] `CLAUDE.md` ist ein relativer Symlink auf `.agents/AGENTS.md` (oder eine
      gleichwertige, portable Lösung ohne absoluten Host-Pfad)
- [ ] `cat CLAUDE.md` liefert in diesem Checkout den Inhalt von
      `.agents/AGENTS.md`
- [ ] Der Link in README.md ("Contributor guidelines are available in
      CLAUDE.md") funktioniert wieder

## Comments
- CLAUDE.md von totem absolutem Symlink (/Users/artkoenig/.agents/AGENTS.md) auf relativen Symlink .agents/AGENTS.md umgestellt; portabel in allen Umgebungen.
