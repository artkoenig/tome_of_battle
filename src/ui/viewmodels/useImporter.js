import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  readSystemArchive,
  importSystem,
  deleteSystem,
  loadAvailableSystems,
  catalogueDirectoryFromIndex,
  catalogueDirectoryFromLinks,
  SYSTEM_IMPORT_STATUS,
} from '../../data/services/systemLibrary';
import { buildRawFileUrl } from '../../data/services/catalogRevisions';
import { useTranslation } from '../i18n/useTranslation';
import {
  buildMissingLibraryDependencyMessage,
  buildImportSuccessMessage,
  buildFailedCatalogueMessage,
} from './importerMessages';
import { revisionLabelClassName } from './importerRevisionDisplay';
import { allSelectedCatalogues, buildBundleView } from './importerBundle';
import { hasRawXmls, downloadSystemArchive } from './systemArchiveExport';

/**
 * ViewModel der Import-Hülle (ADR-0038).
 *
 * Die Anzeige-Ableitungen liegen seit Issue 0176 neben dem Hook statt in ihm:
 * die Meldungen in `importerMessages.js`, die Revisionsanzeige in
 * `importerRevisionDisplay.js`, die Bündel-Ansicht in `importerBundle.js` und
 * der Archiv-Download in `systemArchiveExport.js`. Hier bleibt der Ablauf.
 *
 * Die **installierten** Systeme leitet der Bildschirm nicht selbst aus der
 * Datenbank ab (AC3 des Issues 0165): sie kommen als Prop aus derselben Quelle
 * wie überall sonst (`useAppData`). Zwei Listen konnten auseinanderlaufen — ein
 * frisch importiertes System stand im Importer, aber noch nicht im Editor.
 */

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
      const { systems: indexSystems, anyIndexReachable } = await loadAvailableSystems();
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
    const result = await importSystem({ gstFiles, catFiles, catalogueDirectory });

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
      const { gstFiles, catFiles } = await readSystemArchive(file);
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
    if (!hasRawXmls(system)) {
      setError(t('importer.error.noRawXml'));
      return;
    }
    try {
      await downloadSystemArchive(system);
      setSuccessMsg(t('importer.success.systemExported', { name: system.name }));
    } catch (e) {
      console.error(e);
      setError(t('importer.error.systemExportFailed', { message: e.message }));
    }
  }, [t]);

  const bundle = useMemo(
    () => buildBundleView({ availableSystems, selectedBundleSysId, selectedCats, systems }, t),
    [availableSystems, selectedBundleSysId, selectedCats, systems, t, language]
  );

  // Wie viele Kataloge ein installiertes Spielsystem mitbringt — die Liste
  // zeigt die Zahl, leitet sie aber nicht im Render ab (ADR-0038).
  const catalogueCounts = useMemo(
    () => new Map(systems.map(system => [system.id, system.catalogues?.length ?? 0])),
    [systems]
  );

  return {
    systems,
    catalogueCounts,
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
