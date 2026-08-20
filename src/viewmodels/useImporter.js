import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { deleteSystem } from '../db/database';
import { fetchCatalogText, buildRawFileUrl, deriveRevisionState, REVISION_STATE } from '../db/catalogUpdate';
import { loadAvailableSystemsFromSources } from '../db/catalogSourceIndex';
import { completeSystemImport, SYSTEM_IMPORT_STATUS } from '../db/systemImport';
import {
  catalogueDirectoryFromIndex,
  catalogueDirectoryFromLinks,
} from '../parser/libraryDependencies';
import { useTranslation } from '../i18n/useTranslation';
import { t as translate } from '../i18n/i18nStore';

/**
 * ViewModel der Import-Hülle (ADR-0038).
 *
 * Hier sind die früheren `components/importer/importMessages.js` und
 * `components/importer/revisionDisplay.js` aufgegangen: beide waren
 * Anzeige-Ableitungen dieses einen Bildschirms.
 *
 * Die **installierten** Systeme leitet der Bildschirm nicht mehr selbst aus der
 * Datenbank ab (AC3 des Issues 0165): sie kommen als Prop aus derselben Quelle
 * wie überall sonst (`useAppData`). Zwei Listen konnten auseinanderlaufen — ein
 * frisch importiertes System stand im Importer, aber noch nicht im Editor.
 */

// Trennzeichen sind Zeichensetzung, kein übersetzbarer Wortlaut.
const ITEM_SEPARATOR = '; ';
const REFERENCE_SEPARATOR = ', ';
const REVISION_LABEL_PREFIX = 'Rev';
const REVISION_SEGMENT_SEPARATOR = ' · ';
const REVISION_LABEL_BASE_CLASS = 'bundle-revision-label';

// Ton eines Revisionsstands nach der Zustandsmatrix von ADR 0014, abgebildet
// auf die Hilfsklassen des Themes.
export const REVISION_TONE = {
  SUBTLE: 'text-dim',
  ACCENT: 'text-gold',
  NEUTRAL: '',
};

const quoteCatalogueName = (value) => `„${value}"`;

/**
 * Nennt jeden fehlenden Bibliothekskatalog samt der Kataloge, die ihn
 * brauchen, damit der Nutzer genau weiß, was er ergänzen muss.
 * @param {{ id: string, name: string, requiredBy: string[] }[]} missingDependencies
 */
export function buildMissingLibraryDependencyMessage(missingDependencies, t = translate) {
  const requiredByLabel = t('importer.missingDeps.requiredBy');
  const details = missingDependencies
    .map((dependency) => {
      const quotedName = quoteCatalogueName(dependency.name);
      if (dependency.requiredBy.length === 0) return quotedName;
      const references = dependency.requiredBy.map(quoteCatalogueName).join(REFERENCE_SEPARATOR);
      return `${quotedName} (${requiredByLabel} ${references})`;
    })
    .join(ITEM_SEPARATOR);
  return `${t('importer.missingDeps.headline')} ${t('importer.missingDeps.instruction')} ${details}.`;
}

/**
 * Die Bestätigung nach dem Speichern eines Systems, für beide Importwege
 * gleich. Sind Kataloge am Parsen gescheitert, meldet sie den Import als
 * unvollständig statt eine Vollständigkeit zu bestätigen, die der gespeicherte
 * Stand nicht hat.
 * @param {object} system das gespeicherte System.
 * @param {import('../parser/xmlParser').CatalogueParseFailure[]} [failedCatalogues]
 */
export function buildImportSuccessMessage(system, failedCatalogues = [], t = translate) {
  const importedCount = system.catalogues?.length ?? 0;
  if (failedCatalogues.length === 0) {
    return t('importer.importSuccess.complete', { name: system.name, count: importedCount });
  }
  return t('importer.importSuccess.incomplete', {
    name: system.name,
    importedCount,
    expectedCount: importedCount + failedCatalogues.length,
  });
}

/**
 * Nennt jeden Katalog, der nicht geparst werden konnte, damit die
 * Unvollständigkeit im Moment ihres Entstehens sichtbar ist.
 * @param {import('../parser/xmlParser').CatalogueParseFailure[]} failedCatalogues
 */
export function buildFailedCatalogueMessage(failedCatalogues, t = translate) {
  const details = failedCatalogues
    .map((failure) => `${quoteCatalogueName(failure.fileName)} (${failure.message})`)
    .join(ITEM_SEPARATOR);
  return `${t('importer.failedCatalogues.headline')} ${details}. ${t('importer.failedCatalogues.consequence')}`;
}

/**
 * Die `revision` eines catpkg-Index-Eintrags ist ein optionaler Zähler (ADR
 * 0014). Ältere oder unvollständige Indizes lassen ihn weg — ein nicht
 * numerischer Wert ergibt daher kein Label statt eines Fehlers.
 */
function formatRevisionLabel(revision) {
  if (typeof revision !== 'number') return null;
  return `${REVISION_LABEL_PREFIX} ${revision}`;
}

function formatLocalRevisionSegment(localFile, t) {
  const localRevision = localFile?.revision;
  const value = typeof localRevision === 'number' ? localRevision : t('importer.revision.unknown');
  return `${t('importer.revision.localPrefix')} ${value}`;
}

// Darstellung je Zustand (Zusatz-Segmente nach der verfügbaren Revision, plus
// Ton). Nach Zustand geschlüsselt, damit ein neuer Zustand hier ergänzt wird
// statt in einer wachsenden Fallunterscheidung.
const REVISION_STATE_PRESENTATION = {
  [REVISION_STATE.NEW]: (_localFile, t) => ({ segments: [t('importer.revision.new')], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.CURRENT]: (_localFile, t) => ({ segments: [t('importer.revision.current')], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.OUTDATED]: (localFile, t) => ({
    segments: [formatLocalRevisionSegment(localFile, t), t('importer.revision.updateAvailable')],
    tone: REVISION_TONE.ACCENT,
  }),
  [REVISION_STATE.AHEAD]: (localFile, t) => ({
    segments: [formatLocalRevisionSegment(localFile, t)],
    tone: REVISION_TONE.NEUTRAL,
  }),
};

/**
 * Die vollständige Revisionsanzeige einer Katalogdatei: die verfügbare
 * Revision gegen die lokal gespeicherte (`null`, wenn nicht importiert).
 * Ergibt `{ text, tone }` nach der Zustandsmatrix von ADR 0014, oder `null`,
 * wenn keine verfügbare Revision bekannt ist.
 */
export function buildRevisionDisplay(availableRevision, localFile, t = translate) {
  const availableLabel = formatRevisionLabel(availableRevision);
  if (availableLabel === null) return null;

  const state = deriveRevisionState(availableRevision, localFile);
  const { segments, tone } = REVISION_STATE_PRESENTATION[state](localFile, t);
  return {
    text: [availableLabel, ...segments].join(REVISION_SEGMENT_SEPARATOR),
    tone,
  };
}

export function revisionLabelClassName(tone) {
  return [REVISION_LABEL_BASE_CLASS, tone].filter(Boolean).join(' ');
}

/**
 * Eine Auswahl-Map, die jeden Katalog eines Systems als gewählt markiert.
 */
function allSelectedCatalogues(system) {
  const selected = {};
  (system?.catalogues ?? []).forEach(catalogue => { selected[catalogue.id] = true; });
  return selected;
}

/**
 * @param {{
 *   systems?: object[],
 *   onSystemImported?: () => Promise<void>|void,
 *   onReportError?: (message: string) => void,
 * }} args
 */
export function useImporter({ systems = [], onSystemImported, onReportError } = {}) {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [systemToDelete, setSystemToDelete] = useState(null);

  const [availableSystems, setAvailableSystems] = useState([]);
  const [selectedBundleSysId, setSelectedBundleSysId] = useState('');
  const [selectedCats, setSelectedCats] = useState({});

  const fetchAvailableSystems = useCallback(async () => {
    try {
      const { systems: indexSystems, anyIndexReachable } =
        await loadAvailableSystemsFromSources(fetchCatalogText);
      if (indexSystems.length > 0) {
        setAvailableSystems(indexSystems);
        setSelectedBundleSysId(indexSystems[0].id);
        setSelectedCats(allSelectedCatalogues(indexSystems[0]));
      } else if (!anyIndexReachable) {
        setError(t('importer.error.indexUnreachable'));
      }
    } catch (e) {
      console.warn('Could not load catalog index from fork', e);
      // Nur wenn noch keine Auswahl steht, ist der Fehler für den Nutzer
      // relevant — sonst kann er mit dem geladenen Index weiterarbeiten.
      if (availableSystems.length === 0) setError(t('importer.error.noDataAvailable'));
    }
  }, [t, availableSystems]);

  // Bewusst nur beim Mounten: der Lader ist bei jedem Render eine neue Funktion
  // und setzt Zustand, den er im Fehlerfall selbst wieder liest. In die
  // Abhängigkeitsliste aufgenommen, würde jeder erfolgreiche Abruf die
  // Identität ändern und den Effekt erneut auslösen — eine Endlosschleife aus
  // Netzabrufen. Der Katalog-Index wird deshalb einmal je Bildschirmaufruf
  // geladen; ein Ref hält dafür die jüngste Fassung des Laders.
  const fetchAvailableSystemsRef = useRef(fetchAvailableSystems);
  fetchAvailableSystemsRef.current = fetchAvailableSystems;
  useEffect(() => {
    fetchAvailableSystemsRef.current();
  }, []);

  const selectSystem = useCallback((systemId) => {
    setSelectedBundleSysId(systemId);
    setSelectedCats(allSelectedCatalogues(availableSystems.find(s => s.id === systemId)));
  }, [availableSystems]);

  const toggleCatalogue = useCallback((catalogueId) => {
    setSelectedCats(previous => ({ ...previous, [catalogueId]: !previous[catalogueId] }));
  }, []);

  const toggleAllCatalogues = useCallback((checked) => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;
    const next = {};
    system.catalogues.forEach(catalogue => { next[catalogue.id] = checked; });
    setSelectedCats(next);
  }, [availableSystems, selectedBundleSysId]);

  /**
   * Führt den gemeinsamen Importabschluss für die rohen XML-Dateien beider
   * Importwege aus und spiegelt sein Ergebnis in der Oberfläche.
   */
  const finishImport = useCallback(async (gstFiles, catFiles, catalogueDirectory) => {
    const result = await completeSystemImport({ gstFiles, catFiles, catalogueDirectory });

    if (result.status === SYSTEM_IMPORT_STATUS.MISSING_LIBRARY_DEPENDENCIES) {
      setError(buildMissingLibraryDependencyMessage(result.missingDependencies, t));
      return;
    }

    const failedCatalogues = result.failedCatalogues ?? [];
    if (failedCatalogues.length > 0) {
      const failureMessage = buildFailedCatalogueMessage(failedCatalogues, t);
      setError(failureMessage);
      if (onReportError) onReportError(failureMessage);
    }
    setSuccessMsg(buildImportSuccessMessage(result.system, failedCatalogues, t));
    // Die eine Systemliste neu einlesen lassen: der Bildschirm hält keine
    // eigene mehr.
    if (onSystemImported) await onSystemImported();
  }, [t, onReportError, onSystemImported]);

  const importSelectedBundle = useCallback(async () => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;

    const selectedCatList = system.catalogues.filter(catalogue => selectedCats[catalogue.id]);

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const gstUrl = buildRawFileUrl(system.rawBaseUrl, system.gst.fileName);
      const gstRes = await fetch(gstUrl);
      if (!gstRes.ok) throw new Error(t('importer.error.systemLoadFailed', { status: gstRes.statusText }));
      const gstFiles = [{ name: system.gst.fileName, content: await gstRes.text() }];

      const catFiles = await Promise.all(selectedCatList.map(async (catalogue) => {
        const catRes = await fetch(buildRawFileUrl(system.rawBaseUrl, catalogue.fileName));
        if (!catRes.ok) {
          throw new Error(t('importer.error.catalogueLoadFailed', { name: catalogue.name, status: catRes.statusText }));
        }
        return { name: catalogue.fileName, content: await catRes.text() };
      }));

      // Der Katalog-Index kennt jeden wählbaren Katalog, ein dort nicht
      // gelistetes Link-Ziel ist also stromaufwärts kaputt.
      await finishImport(gstFiles, catFiles, catalogueDirectoryFromIndex(system.catalogues));
    } catch (e) {
      console.error(e);
      setError(t('importer.error.importFailed', { message: e.message }));
    } finally {
      setLoading(false);
    }
  }, [availableSystems, selectedBundleSysId, selectedCats, finishImport, t]);

  const importUploadedFile = useCallback(async (file) => {
    setError(null);
    setSuccessMsg(null);

    if (!file.name.endsWith('.zip')) {
      setError(t('importer.error.invalidZip'));
      return;
    }

    setLoading(true);
    try {
      const { gstFiles, catFiles } = await extractZipFiles(file);
      // Ein hochgeladenes Archiv hat keinen Index, der seine Kataloge
      // begrenzt — jedes fehlende Link-Ziel kann der Nutzer ergänzen.
      await finishImport(gstFiles, catFiles, catalogueDirectoryFromLinks());
    } catch (e) {
      console.error(e);
      setError(t('importer.error.fileProcessingFailed', { message: e.message }));
    } finally {
      setLoading(false);
    }
  }, [finishImport, t]);

  const pickUploadFile = useCallback(async (event) => {
    if (event.target.files && event.target.files[0]) {
      await importUploadedFile(event.target.files[0]);
    }
  }, [importUploadedFile]);

  const requestDelete = useCallback((systemId) => {
    const system = systems.find(s => s.id === systemId);
    if (system) setSystemToDelete(system);
  }, [systems]);

  const cancelDelete = useCallback(() => setSystemToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!systemToDelete) return;
    const id = systemToDelete.id;
    setSystemToDelete(null);
    try {
      await deleteSystem(id);
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError(t('importer.error.systemDeleteFailed'));
    }
  }, [systemToDelete, onSystemImported, t]);

  const exportSystem = useCallback(async (system) => {
    try {
      if (!system.rawXmls) {
        setError(t('importer.error.noRawXml'));
        return;
      }

      const zip = new JSZip();
      system.rawXmls.gst?.forEach(file => zip.file(file.name, file.content));
      system.rawXmls.cat?.forEach(file => zip.file(file.name, file.content));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${system.name}_original.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessMsg(t('importer.success.systemExported', { name: system.name }));
    } catch (e) {
      console.error(e);
      setError(t('importer.error.systemExportFailed', { message: e.message }));
    }
  }, [t]);

  const bundle = useMemo(() => {
    const selectedSystem = availableSystems.find(s => s.id === selectedBundleSysId) ?? null;
    if (!selectedSystem) {
      return {
        hasIndex: availableSystems.length > 0,
        selectedSystem: null,
        selectedCount: 0,
        allChecked: false,
        revisionDisplay: null,
        catalogues: [],
      };
    }

    // Das lokal gespeicherte Gegenstück des gewählten Systems stammt aus
    // derselben Liste wie überall sonst — kein zweiter Datenbankzugriff.
    const storedSystem = systems.find(s => s.id === selectedSystem.id) ?? null;

    return {
      hasIndex: true,
      selectedSystem,
      selectedCount: selectedSystem.catalogues.filter(c => selectedCats[c.id]).length,
      allChecked: selectedSystem.catalogues.every(c => selectedCats[c.id]),
      revisionDisplay: buildRevisionDisplay(selectedSystem.gst.revision, storedSystem, t),
      catalogues: selectedSystem.catalogues.map(catalogue => ({
        ...catalogue,
        isSelected: !!selectedCats[catalogue.id],
        revisionDisplay: buildRevisionDisplay(
          catalogue.revision,
          storedSystem?.catalogues?.find(c => c.id === catalogue.id) ?? null,
          t
        ),
      })),
    };
  }, [availableSystems, selectedBundleSysId, selectedCats, systems, t, language]);

  return {
    systems,
    availableSystems,
    selectedBundleSysId,
    bundle,
    revisionLabelClassName,
    loading,
    error,
    successMsg,
    systemToDelete,
    selectSystem,
    toggleCatalogue,
    toggleAllCatalogues,
    importSelectedBundle,
    pickUploadFile,
    requestDelete,
    cancelDelete,
    confirmDelete,
    exportSystem,
  };
}
