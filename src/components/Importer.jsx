import React, { useState, useEffect } from 'react';
import { Trash2, FileText, CheckCircle2, ShieldAlert, Edit, Download } from 'lucide-react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { collectSchemaWarnings } from '../parser/importSchemaGate';
import { getAllSystems, saveSystem, deleteSystem } from '../db/database';
import ConfirmationDialog from './editor/ConfirmationDialog';
import {
  loadCatalogIndex,
  fetchCatalogText,
  buildRawFileUrl,
  deriveRevisionState,
  CATALOG_SOURCES,
  REVISION_STATE,
} from '../db/catalogUpdate';

// Advisory schema warnings are logged to the console rather than shown in the UI
// (ADR 0016, Revision 2026-07-18): rendering them in the Importer caused a visible
// flash on first import, between the loading overlay and the Heerlager view. This
// mirrors the console-only pattern in `updateSystemFromCatalogIndex`.
function logSchemaWarnings(warnings) {
  if (warnings.length === 0) return;
  console.warn(
    'Schema advisory for imported game data:',
    warnings.map((warning) => warning.message)
  );
}

const REVISION_LABEL_PREFIX = 'Rev';
const REVISION_SEGMENT_SEPARATOR = ' · ';
const NEW_STATE_TEXT = 'neu';
const CURRENT_STATE_TEXT = 'aktuell';
const UPDATE_AVAILABLE_TEXT = 'Update verfügbar';
const LOCAL_REVISION_PREFIX = 'lokal';
const UNKNOWN_LOCAL_REVISION_TEXT = 'unbekannt';

// Visual tone of a revision status per ADR 0014's state matrix, mapped to the theme's
// helper classes: a subtle secondary text, the gold accent that flags an available
// update, and the neutral default for a self-uploaded (higher) local revision.
const REVISION_TONE = {
  SUBTLE: 'text-dim',
  ACCENT: 'text-gold',
  NEUTRAL: '',
};

/**
 * The `revision` from a catpkg index entry is an optional integer update counter
 * (see ADR 0014). Older or incomplete indices may omit it, so a non-numeric value
 * yields no label rather than an error.
 */
function formatRevisionLabel(revision) {
  if (typeof revision !== 'number') return null;
  return `${REVISION_LABEL_PREFIX} ${revision}`;
}

function formatLocalRevisionSegment(localFile) {
  const localRevision = localFile?.revision;
  const value = typeof localRevision === 'number' ? localRevision : UNKNOWN_LOCAL_REVISION_TEXT;
  return `${LOCAL_REVISION_PREFIX} ${value}`;
}

// Per-state presentation (suffix segments appended after the available revision, plus
// tone). Keyed by state so a new state is added here rather than in a growing switch.
const REVISION_STATE_PRESENTATION = {
  [REVISION_STATE.NEW]: () => ({ segments: [NEW_STATE_TEXT], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.CURRENT]: () => ({ segments: [CURRENT_STATE_TEXT], tone: REVISION_TONE.SUBTLE }),
  [REVISION_STATE.OUTDATED]: (localFile) => ({
    segments: [formatLocalRevisionSegment(localFile), UPDATE_AVAILABLE_TEXT],
    tone: REVISION_TONE.ACCENT,
  }),
  [REVISION_STATE.AHEAD]: (localFile) => ({
    segments: [formatLocalRevisionSegment(localFile)],
    tone: REVISION_TONE.NEUTRAL,
  }),
};

/**
 * Builds the full revision display for one catalog file, comparing the available
 * revision against the locally stored file (or `null` when it is not imported). Returns
 * `{ text, tone }` per ADR 0014's state matrix, or `null` when no available revision is
 * known (nothing to show).
 */
function buildRevisionDisplay(availableRevision, localFile) {
  const availableLabel = formatRevisionLabel(availableRevision);
  if (availableLabel === null) return null;

  const state = deriveRevisionState(availableRevision, localFile);
  const { segments, tone } = REVISION_STATE_PRESENTATION[state](localFile);
  return {
    text: [availableLabel, ...segments].join(REVISION_SEGMENT_SEPARATOR),
    tone,
  };
}

function revisionLabelClassName(tone) {
  return ['bundle-revision-label', tone].filter(Boolean).join(' ');
}

// A catalogueLink pulls shared entries from another (library) catalogue into the
// referencing one. Deselecting that target while keeping a catalogue that links to it
// would silently drop those shared entries on the next roster resolution, so the bundle
// import guards against a selection that omits such a dependency.
const MISSING_LIBRARY_DEPENDENCY_MESSAGE = {
  headline: 'Import abgebrochen: Ein ausgewählter Katalog verweist auf einen nicht ausgewählten Bibliothekskatalog.',
  instruction: 'Bitte wähle folgende Kataloge zusätzlich aus, um einen vollständigen Import sicherzustellen:',
  requiredByLabel: 'benötigt von',
  itemSeparator: '; ',
  referenceSeparator: ', ',
};

/**
 * Finds catalogueLinks in the loaded catalogues whose target is a real, selectable
 * catalogue that the user left out of the current selection. Such a target is a shared
 * (library) catalogue the referencing catalogue depends on; importing without it yields a
 * silently incomplete dataset. Targets that are already selected, or that are not part of
 * the available catalogues at all, are ignored.
 *
 * @param {{ id: string, name?: string, catalogueLinks?: { targetId?: string, name?: string }[] }[]} loadedCatalogues
 *   the fully parsed catalogues of the current selection (their catalogueLinks are read).
 * @param {Set<string>} selectedCatalogueIds ids the user chose to import.
 * @param {{ id: string, name?: string }[]} availableCatalogues every catalogue the user
 *   could have selected (from the catalog index).
 * @returns {{ id: string, name: string, requiredBy: string[] }[]} one entry per missing
 *   dependency, deduplicated by target id.
 */
export function findMissingLibraryDependencies(loadedCatalogues, selectedCatalogueIds, availableCatalogues) {
  const availableCatalogueById = new Map(availableCatalogues.map(catalogue => [catalogue.id, catalogue]));
  const missingDependencyById = new Map();

  for (const loadedCatalogue of loadedCatalogues ?? []) {
    for (const catalogueLink of loadedCatalogue.catalogueLinks ?? []) {
      const targetId = catalogueLink.targetId;
      if (!targetId || selectedCatalogueIds.has(targetId)) continue;

      const availableTarget = availableCatalogueById.get(targetId);
      if (!availableTarget) continue;

      const dependency = missingDependencyById.get(targetId) ?? {
        id: targetId,
        name: availableTarget.name ?? catalogueLink.name ?? targetId,
        requiredBy: [],
      };
      const referencingName = loadedCatalogue.name ?? loadedCatalogue.id;
      if (referencingName && !dependency.requiredBy.includes(referencingName)) {
        dependency.requiredBy.push(referencingName);
      }
      missingDependencyById.set(targetId, dependency);
    }
  }

  return [...missingDependencyById.values()];
}

function quoteCatalogueName(value) {
  return `„${value}"`;
}

function buildMissingLibraryDependencyMessage(missingDependencies) {
  const { headline, instruction, requiredByLabel, itemSeparator, referenceSeparator } =
    MISSING_LIBRARY_DEPENDENCY_MESSAGE;
  const details = missingDependencies
    .map(dependency => {
      const quotedName = quoteCatalogueName(dependency.name);
      if (dependency.requiredBy.length === 0) return quotedName;
      const references = dependency.requiredBy.map(quoteCatalogueName).join(referenceSeparator);
      return `${quotedName} (${requiredByLabel} ${references})`;
    })
    .join(itemSeparator);
  return `${headline} ${instruction} ${details}.`;
}

export function transformIndexToSystems(index) {
  if (!index?.repositoryFiles) return [];

  const gsType = 'gamesystem';
  const catType = 'catalogue';

  const gameSystemEntries = index.repositoryFiles.filter(
    entry => (entry.type || '').toLowerCase() === gsType
  );
  const catalogueEntries = index.repositoryFiles.filter(
    entry => (entry.type || '').toLowerCase() === catType
  );

  return gameSystemEntries.map(gs => ({
    id: gs.id,
    name: gs.name,
    gst: {
      id: gs.id,
      name: gs.name,
      // `path` is the real repository file name; the name+extension form is only a
      // fallback for a legacy index without it (see catalogUpdate.rawFileName).
      fileName: gs.path ?? `${gs.name}.gst`,
      revision: gs.revision
    },
    catalogues: catalogueEntries.map(cat => ({
        id: cat.id,
        name: cat.name,
        fileName: cat.path ?? `${cat.name}.cat`,
        revision: cat.revision
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }));
}

/**
 * Tags every system parsed from one source's index with that source's `rawBaseUrl`, so
 * the import later fetches its files from the right fork (ADR 0018). No display label is
 * stored or derived: the system is shown under its own catalog `name`, straight from the
 * parsed index.
 */
function withSourceRawBaseUrl(systems, rawBaseUrl) {
  return systems.map(system => ({ ...system, rawBaseUrl }));
}

/**
 * A selection map that marks every catalogue of a system as selected. Used to preselect
 * all factions whenever a system becomes the active one in the dropdown.
 */
function buildAllSelectedCats(system) {
  const selected = {};
  (system?.catalogues ?? []).forEach(cat => {
    selected[cat.id] = true;
  });
  return selected;
}

/**
 * Loads and merges the available systems of every configured catalog source into one
 * flat list (ADR 0018 — no extra selection step; both systems share the one dropdown).
 * A source whose index is unreachable contributes nothing rather than failing the whole
 * list, so one source being offline never hides the other. `anyIndexReachable` stays
 * true as long as at least one source's index loaded (even if it held no systems), so
 * the caller only reports an outage when every source is unreachable — not when a
 * reachable index is simply empty.
 *
 * @returns {Promise<{ systems: Array, anyIndexReachable: boolean }>}
 */
export async function loadAvailableSystemsFromSources(fetchText) {
  const perSource = await Promise.all(
    CATALOG_SOURCES.map(async (source) => {
      const index = await loadCatalogIndex(fetchText, source.indexUrl);
      const systems = index ? withSourceRawBaseUrl(transformIndexToSystems(index), source.rawBaseUrl) : [];
      return { reachable: index !== null, systems };
    })
  );
  return {
    systems: perSource.flatMap(result => result.systems),
    anyIndexReachable: perSource.some(result => result.reachable),
  };
}

export default function Importer({ onSystemImported, showAsEmptyState = false }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [systemToDelete, setSystemToDelete] = useState(null);

  // States for pre-bundled catalog import
  const [availableSystems, setAvailableSystems] = useState([]);
  const [selectedBundleSysId, setSelectedBundleSysId] = useState('');
  const [selectedCats, setSelectedCats] = useState({});

  useEffect(() => {
    loadSystems();
    fetchAvailableSystems();
  }, []);

  const loadSystems = async () => {
    try {
      const data = await getAllSystems();
      setSystems(data);
    } catch (e) {
      console.error("Error loading systems", e);
    }
  };

  const fetchAvailableSystems = async () => {
    try {
      const { systems, anyIndexReachable } = await loadAvailableSystemsFromSources(fetchCatalogText);
      if (systems.length > 0) {
        setAvailableSystems(systems);
        setSelectedBundleSysId(systems[0].id);
        setSelectedCats(buildAllSelectedCats(systems[0]));
      } else if (!anyIndexReachable) {
        setError('Der Katalog-Index ist derzeit nicht erreichbar. Bitte versuche es später erneut.');
      }
    } catch (e) {
      console.warn("Could not load catalog index from fork", e);
      if (availableSystems.length === 0) {
        setError('Keine Spieldaten zum Import verfügbar. Der Katalog-Index konnte nicht geladen werden.');
      }
    }
  };

  const handleSystemChange = (sysId) => {
    setSelectedBundleSysId(sysId);
    const system = availableSystems.find(s => s.id === sysId);
    setSelectedCats(buildAllSelectedCats(system));
  };

  const handleToggleCat = (catId) => {
    setSelectedCats(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleToggleAllCats = (checked) => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;
    const nextCats = {};
    system.catalogues.forEach(cat => {
      nextCats[cat.id] = checked;
    });
    setSelectedCats(nextCats);
  };

  const handleImportBundle = async () => {
    const system = availableSystems.find(s => s.id === selectedBundleSysId);
    if (!system) return;

    const selectedCatList = system.catalogues.filter(cat => selectedCats[cat.id]);
    
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const gstUrl = buildRawFileUrl(system.rawBaseUrl, system.gst.fileName);
      const gstRes = await fetch(gstUrl);
      if (!gstRes.ok) throw new Error(`Fehler beim Laden des Spielsystems: ${gstRes.statusText}`);
      const gstText = await gstRes.text();
      const gstFiles = [{ name: system.gst.fileName, content: gstText }];

      const catFiles = await Promise.all(selectedCatList.map(async (cat) => {
        const catUrl = buildRawFileUrl(system.rawBaseUrl, cat.fileName);
        const catRes = await fetch(catUrl);
        if (!catRes.ok) throw new Error(`Fehler beim Laden des Katalogs ${cat.name}: ${catRes.statusText}`);
        const catText = await catRes.text();
        return { name: cat.fileName, content: catText };
      }));

      logSchemaWarnings(await collectSchemaWarnings(gstFiles, catFiles));

      const systemData = processImportedData(gstFiles, catFiles);

      const selectedCatalogueIds = new Set(selectedCatList.map(cat => cat.id));
      const missingLibraryDependencies = findMissingLibraryDependencies(
        systemData.catalogues,
        selectedCatalogueIds,
        system.catalogues
      );
      if (missingLibraryDependencies.length > 0) {
        setError(buildMissingLibraryDependencyMessage(missingLibraryDependencies));
        return;
      }

      systemData.rawXmls = {
        gst: gstFiles,
        cat: catFiles
      };

      await deleteSystem(systemData.id);
      await saveSystem(systemData);

      setSuccessMsg(`Das System "${systemData.name}" mit ${systemData.catalogues.length} Katalogen wurde erfolgreich importiert!`);
      loadSystems();
      // Await the parent so it has already switched to the Heerlager view before
      // `finally` clears `loading` and unmounts this Importer — no visible flash.
      if (onSystemImported) await onSystemImported();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Importieren der Spieldaten: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = async (file) => {
    setError(null);
    setSuccessMsg(null);

    if (!file.name.endsWith('.zip')) {
      setError('Bitte lade eine gültige .zip-Datei hoch.');
      return;
    }

    setLoading(true);
    try {
      const { gstFiles, catFiles } = await extractZipFiles(file);
      logSchemaWarnings(await collectSchemaWarnings(gstFiles, catFiles));
      const systemData = processImportedData(gstFiles, catFiles);
      systemData.rawXmls = {
        gst: gstFiles,
        cat: catFiles
      };
      await deleteSystem(systemData.id);
      await saveSystem(systemData);
      setSuccessMsg(`Das System "${systemData.name}" mit ${systemData.catalogues.length} Katalogen wurde erfolgreich importiert!`);
      loadSystems();
      // Await the parent so it has already switched to the Heerlager view before
      // `finally` clears `loading` and unmounts this Importer — no visible flash.
      if (onSystemImported) await onSystemImported();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Verarbeiten der Datei: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    const sys = systems.find(s => s.id === id);
    if (sys) {
      setSystemToDelete(sys);
    }
  };

  const handleExport = async (sys) => {
    try {
      if (!sys.rawXmls) {
        setError('Dieses Spielsystem wurde vor dem Update importiert und besitzt keine XML-Originaldateien in der Datenbank. Bitte importiere das Spielsystem (.zip) erneut, um den Export nutzen zu können.');
        return;
      }

      const zip = new JSZip();
      sys.rawXmls.gst?.forEach(f => {
        zip.file(f.name, f.content);
      });
      sys.rawXmls.cat?.forEach(f => {
        zip.file(f.name, f.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sys.name}_original.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccessMsg(`Spielsystem "${sys.name}" erfolgreich als .zip (Originalformat) exportiert!`);
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Exportieren des Spielsystems als ZIP: ${e.message}`);
    }
  };

  const renderBundleImporter = () => {
    if (availableSystems.length === 0) return null;

    const selectedSystem = availableSystems.find(s => s.id === selectedBundleSysId);
    const selectedCount = selectedSystem ? selectedSystem.catalogues.filter(cat => selectedCats[cat.id]).length : 0;
    const allChecked = selectedSystem ? selectedSystem.catalogues.every(cat => selectedCats[cat.id]) : false;
    // The locally stored counterpart of the selected system (already loaded via
    // getAllSystems — no extra DB access) drives the "new/current/outdated/ahead" state.
    const storedSystem = selectedSystem ? systems.find(s => s.id === selectedSystem.id) ?? null : null;
    const selectedSystemRevisionDisplay = selectedSystem
      ? buildRevisionDisplay(selectedSystem.gst.revision, storedSystem)
      : null;

    return (
      <div className="gothic-panel bundle-importer-panel full-width">
        <h3 className="text-subheading">Vordefinierte Spieldaten importieren</h3>
        <p className="text-dim text-body">
          Importiere ein komplettes Spielsystem inklusive ausgewählter Fraktionen direkt aus den mitgelieferten Dateien.
        </p>

        <div className="bundle-form-group">
          <div className="bundle-form-group-header">
            <label className="text-label text-gold">Spielsystem:</label>
            {selectedSystemRevisionDisplay && (
              <span
                className={revisionLabelClassName(selectedSystemRevisionDisplay.tone)}
                data-testid="selected-system-revision"
              >
                {selectedSystemRevisionDisplay.text}
              </span>
            )}
          </div>
          <select
            value={selectedBundleSysId}
            onChange={(e) => handleSystemChange(e.target.value)}
            disabled={loading}
          >
            {availableSystems.map(sys => (
              <option key={sys.id} value={sys.id}>{sys.name}</option>
            ))}
          </select>
        </div>

        {selectedSystem && (
          <div className="bundle-form-group">
            <div className="bundle-importer-header">
              <label className="text-label text-gold">Kataloge ({selectedCount} ausgewählt):</label>
              <button 
                type="button" 
                className="btn-gold btn-sm"
                onClick={() => handleToggleAllCats(!allChecked)}
                disabled={loading}
              >
                {allChecked ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
            <div className="bundle-catalog-list-container">
              {selectedSystem.catalogues.map(cat => {
                const storedCatalogue = storedSystem?.catalogues?.find(c => c.id === cat.id) ?? null;
                const catalogueRevisionDisplay = buildRevisionDisplay(cat.revision, storedCatalogue);
                return (
                  <label key={cat.id} className="bundle-catalog-item-label">
                    <input
                      type="checkbox"
                      checked={!!selectedCats[cat.id]}
                      onChange={() => handleToggleCat(cat.id)}
                      disabled={loading}
                      aria-label={cat.name}
                    />
                    <span className="text-body">{cat.name}</span>
                    {catalogueRevisionDisplay && (
                      <span
                        className={revisionLabelClassName(catalogueRevisionDisplay.tone)}
                        data-testid={`catalog-revision-${cat.id}`}
                      >
                        {catalogueRevisionDisplay.text}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="bundle-importer-actions">
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleImportBundle}
            disabled={loading || selectedCount === 0}
          >
            Importieren
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`container ${showAsEmptyState ? 'empty-state-wrapper' : ''}`}>
      {error && (
        <div className="validation-error-item" style={{ borderColor: 'var(--color-danger)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert className="text-danger" size={20} />
          <span className="text-danger">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="validation-error-item" style={{ borderColor: 'var(--color-success)', background: 'rgba(27,115,64,0.05)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 className="text-success" size={20} />
          <span className="text-success">{successMsg}</span>
        </div>
      )}

      {loading && (
        <div className="modal-overlay">
          <div className="loader-overlay-content">
            <div className="gothic-spinner" />
            <h3 className="text-subheading text-gold">Beschwöre Spieldaten...</h3>
            <span className="text-body text-dim">Verarbeite XML-Dateien, bitte warten...</span>
          </div>
        </div>
      )}

      {showAsEmptyState ? (
        <div className="empty-importer-layout">
          <div className="empty-importer-text-center">
            <div className="empty-state-image empty-importer-image empty-importer-image-centered" />
            <h2 className="empty-state-title empty-state-title-large">Willkommen bei Tome of Battle</h2>
            <p className="empty-state-text text-dim">
              Dein Buch des Wissens ist noch leer. Um Armeen ausheben zu können, benötigst du zunächst Spieldaten im BattleScribe-Format. 
            </p>
          </div>

          {renderBundleImporter()}
        </div>
      ) : (
        <div className="importer-layout">
          {renderBundleImporter()}
        </div>
      )}

      <input 
        type="file" 
        id="file-upload" 
        style={{ display: 'none' }} 
        accept=".zip"
        onChange={handleFileInput}
      />

      {!showAsEmptyState && (
        <div className="margin-top-md">
          <h2>Importierte Spielsysteme</h2>
          {systems.length === 0 ? (
            <p className="text-dim" style={{ textAlign: 'center', padding: '20px 0' }}>Keine Spielsysteme in der Datenbank vorhanden.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {systems.map((sys) => (
                <div 
                  key={sys.id} 
                  className="catalog-item"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, paddingRight: '16px' }}>
                    <FileText className="text-gold" size={24} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {sys.name}
                      </h4>
                      <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                        {sys.catalogues?.length || 0} Fraktionskataloge geladen
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      className="btn-gold square-btn"
                      onClick={() => handleExport(sys)}
                      title="Spielsystem exportieren (.zip)"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="btn-danger square-btn"
                      onClick={() => handleDelete(sys.id)}
                      title="System löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Confirmation Dialog for deleting System */}
      <ConfirmationDialog
        isOpen={!!systemToDelete}
        onClose={() => setSystemToDelete(null)}
        onConfirm={async () => {
          if (!systemToDelete) return;
          const id = systemToDelete.id;
          setSystemToDelete(null);
          try {
            await deleteSystem(id);
            loadSystems();
            if (onSystemImported) onSystemImported();
          } catch (e) {
            console.error(e);
            setError('Fehler beim Löschen des Spielsystems.');
          }
        }}
        title="Spielsystem löschen"
        message={
          <>
            Bist du sicher, dass du das Spielsystem <strong>{systemToDelete?.name}</strong> und alle zugehörigen Kataloge löschen möchtest?
          </>
        }
        confirmLabel="Löschen"
        isDanger={true}
      />
    </div>
  );
}
