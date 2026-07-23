Status: resolved
Type: feature
Blocked by: None

## Description
Aufklappbare Anzeige der Ausgaben/Befunde (Findings) für fehlschlagende oder abgebrochene Quality Gates:
1. Reines HTML/CSS (`<details class="gate-findings">`/`<summary>`) ohne JavaScript.
2. Darstellung der vollständigen Werkzeugausgabe (stdout/stderr) in einem formatierten Code-Block (`<pre><code>`).
3. Einbindung in `renderReport.js` bei Quality Gates mit `status === 'findings'` oder `status === 'not-run'`.
4. Unit-Tests in `renderReport.test.js` und Regenerieren von `docs/status/index.html`.
