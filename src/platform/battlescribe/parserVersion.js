/**
 * Der Stand des Katalog-Parsers, mit dem ein gespeichertes System erzeugt wurde.
 *
 * Ein System in der IndexedDB traegt diese Zahl als `parserVersion` (gesetzt von
 * `processImportedData`, also auf jedem Weg: Datei-Import, Bundle-Import und
 * Katalog-Update). Die Start-Migration (`src/platform/persistence/migrations.js`) parst ein
 * gespeichertes System nur dann neu, wenn sein Marker von dieser Zahl abweicht —
 * ohne den Marker lief der vollstaendige Neu-Parse aller Kataloge bei jedem
 * `loadAllData`, und entwertete dabei den identitaetsbasierten
 * Auswertungs-Cache (`src/contexts/ruleengine/acl/evaluationCache.js`).
 *
 * **Erhoehen**, sobald `src/platform/battlescribe/` etwas anderes aus derselben XML macht —
 * ein neues Feld, eine korrigierte Ableitung, eine geaenderte Form. Genau dann
 * ist ein einmaliger Neu-Parse aller gespeicherten Systeme faellig, und die
 * Erhoehung ist das, was ihn ausloest.
 *
 * `1` ist der erste vergebene Stand: der Parser, wie ihn Issue 0168 vorfand.
 * Ein gespeichertes System ohne Marker stammt aus der Zeit davor und wird genau
 * einmal neu geparst.
 */
export const PARSER_VERSION = 1;
