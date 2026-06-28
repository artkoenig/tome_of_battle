import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, CheckCircle2, AlertTriangle, ShieldAlert, Edit, ArrowLeft, Download } from 'lucide-react';
import JSZip from 'jszip';
import { extractZipFiles } from '../parser/zipExtractor';
import { processImportedData } from '../parser/xmlParser';
import { saveSystem, getAllSystems, deleteSystem } from '../db/database';
import { resolveEntry, findEntryInSystem } from '../solver/validator';

const searchEditableEntries = (system, query) => {
  if (!query || query.length < 2) return [];
  const results = [];
  const q = query.toLowerCase();

  const addEntry = (entry, catalogueName, path) => {
    if (entry.name && entry.name.toLowerCase().includes(q)) {
      results.push({
        type: 'entry',
        id: entry.id,
        name: entry.name,
        catalogueName,
        path,
        ref: entry
      });
    }
  };

  const addGroup = (group, catalogueName, path) => {
    if (group.name && group.name.toLowerCase().includes(q)) {
      results.push({
        type: 'group',
        id: group.id,
        name: group.name,
        catalogueName,
        path,
        ref: group
      });
    }
  };

  const addProfile = (profile, catalogueName, path) => {
    if (profile.name && profile.name.toLowerCase().includes(q)) {
      results.push({
        type: 'profile',
        id: profile.id,
        name: profile.name,
        catalogueName,
        path,
        ref: profile
      });
    }
  };

  const addRule = (rule, catalogueName, path) => {
    if (rule.name && rule.name.toLowerCase().includes(q)) {
      results.push({
        type: 'rule',
        id: rule.id,
        name: rule.name,
        catalogueName,
        path,
        ref: rule
      });
    }
  };

  const traverse = (item, catalogueName, path) => {
    if (!item) return;

    if (item.selectionEntries) {
      item.selectionEntries.forEach(se => {
        addEntry(se, catalogueName, path + " -> " + se.name);
        traverse(se, catalogueName, path + " -> " + se.name);
      });
    }
    if (item.entryLinks) {
      item.entryLinks.forEach(el => {
        if (el.constraints?.length > 0) {
          addEntry(el, catalogueName, path + " -> Link: " + el.name);
        }
      });
    }
    if (item.selectionEntryGroups) {
      item.selectionEntryGroups.forEach(seg => {
        addGroup(seg, catalogueName, path + " -> Group: " + seg.name);
        traverse(seg, catalogueName, path + " -> Group: " + seg.name);
      });
    }
    if (item.profiles) {
      item.profiles.forEach(p => {
        addProfile(p, catalogueName, path + " -> Profile: " + p.name);
      });
    }
    if (item.rules) {
      item.rules.forEach(r => {
        addRule(r, catalogueName, path + " -> Rule: " + r.name);
      });
    }
  };

  system.catalogues?.forEach(cat => {
    traverse(cat, cat.name, cat.name);

    cat.sharedSelectionEntries?.forEach(se => {
      addEntry(se, cat.name, cat.name + " (Shared) -> " + se.name);
      traverse(se, cat.name, cat.name + " (Shared) -> " + se.name);
    });
    cat.sharedSelectionEntryGroups?.forEach(seg => {
      addGroup(seg, cat.name, cat.name + " (Shared) -> " + seg.name);
      traverse(seg, cat.name, cat.name + " (Shared) -> " + seg.name);
    });
    cat.sharedProfiles?.forEach(p => {
      addProfile(p, cat.name, cat.name + " (Shared) -> " + p.name);
    });
    cat.sharedRules?.forEach(r => {
      addRule(r, cat.name, cat.name + " (Shared Rule) -> " + r.name);
    });
  });

  return results.slice(0, 50);
};

const updateRawXml = (system, entryId, type, localName, localCosts, localConstraints, localCharacteristics, localDescription) => {
  if (!system.rawXmls) return;

  let file = system.rawXmls.cat?.find(f => f.content.includes(entryId));
  if (!file) {
    file = system.rawXmls.gst?.find(f => f.content.includes(entryId));
  }
  if (!file) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(file.content, 'text/xml');

  const element = doc.querySelector(`[id="${entryId}"]`);
  if (!element) return;

  if (localName !== undefined) {
    element.setAttribute('name', localName);
  }

  if (type === 'entry') {
    Object.entries(localCosts).forEach(([typeId, val]) => {
      const costEl = element.querySelector(`cost[typeId="${typeId}"]`);
      if (costEl) {
        costEl.setAttribute('value', parseFloat(val) || 0);
      }
    });
  }

  if (type === 'entry' || type === 'group') {
    Object.entries(localConstraints).forEach(([conId, val]) => {
      const conEl = element.querySelector(`constraint[id="${conId}"]`);
      if (conEl) {
        conEl.setAttribute('value', parseFloat(val) || 0);
      }
    });
  }

  if (type === 'profile') {
    Object.entries(localCharacteristics).forEach(([name, val]) => {
      const charEl = Array.from(element.querySelectorAll('characteristic')).find(c => c.getAttribute('name') === name);
      if (charEl) {
        charEl.textContent = val;
      }
    });
  }

  if (type === 'rule') {
    let descEl = element.querySelector('description');
    if (!descEl) {
      descEl = doc.createElement('description');
      element.appendChild(descEl);
    }
    descEl.textContent = localDescription;
  }

  const serializer = new XMLSerializer();
  file.content = serializer.serializeToString(doc);
};

const getCatalogueContext = (system, catalogueId) => {
  const catalogue = system.catalogues?.find(c => c.id === catalogueId);
  if (!catalogue) return [];

  const list = [];
  const addEntry = (se, path) => {
    const profiles = [];
    if (se.profiles) {
      se.profiles.forEach(p => {
        profiles.push({
          id: p.id,
          name: p.name,
          stats: p.characteristics?.map(c => `${c.name}:${c.value}`).join(', ')
        });
      });
    }

    const rules = [];
    if (se.rules) {
      se.rules.forEach(r => {
        rules.push({
          id: r.id,
          name: r.name,
          description: r.description
        });
      });
    }

    list.push({
      id: se.id,
      type: 'entry',
      name: se.name,
      path,
      points: se.costs?.find(c => c.typeId === 'pts' || c.name === 'pts' || c.typeId === 'ecfa-8486-4f6c-c249')?.value,
      profiles,
      rules,
      constraints: se.constraints?.map(con => ({
        id: con.id,
        type: con.type,
        value: con.value,
        field: con.field,
        scope: con.scope
      }))
    });
  };

  const addGroup = (seg, path) => {
    list.push({
      id: seg.id,
      type: 'group',
      name: seg.name,
      path,
      constraints: seg.constraints?.map(con => ({
        id: con.id,
        type: con.type,
        value: con.value,
        field: con.field,
        scope: con.scope
      }))
    });
  };

  const traverse = (item, path) => {
    if (!item) return;
    if (item.selectionEntries) {
      item.selectionEntries.forEach(se => {
        addEntry(se, path + " -> " + se.name);
        traverse(se, path + " -> " + se.name);
      });
    }
    if (item.selectionEntryGroups) {
      item.selectionEntryGroups.forEach(seg => {
        addGroup(seg, path + " -> Group: " + seg.name);
        traverse(seg, path + " -> Group: " + seg.name);
      });
    }
  };

  traverse(catalogue, catalogue.name);

  catalogue.sharedSelectionEntries?.forEach(se => {
    addEntry(se, catalogue.name + " (Shared) -> " + se.name);
    traverse(se, catalogue.name + " (Shared) -> " + se.name);
  });
  catalogue.sharedSelectionEntryGroups?.forEach(seg => {
    addGroup(seg, catalogue.name + " (Shared Group) -> " + seg.name);
    traverse(seg, catalogue.name + " (Shared Group) -> " + seg.name);
  });

  return list;
};

const findAndMutateJsonPatch = (system, patch) => {
  let foundRef = null;

  const traverse = (item) => {
    if (foundRef) return;
    if (item.id === patch.id) {
      foundRef = item;
      return;
    }
    if (item.selectionEntries) {
      item.selectionEntries.forEach(traverse);
    }
    if (item.entryLinks) {
      item.entryLinks.forEach(traverse);
    }
    if (item.selectionEntryGroups) {
      item.selectionEntryGroups.forEach(traverse);
    }
    if (item.profiles) {
      item.profiles.forEach(traverse);
    }
    if (item.rules) {
      item.rules.forEach(traverse);
    }
  };

  system.catalogues?.forEach(cat => {
    traverse(cat);
    cat.sharedSelectionEntries?.forEach(traverse);
    cat.sharedSelectionEntryGroups?.forEach(traverse);
    cat.sharedProfiles?.forEach(traverse);
    cat.sharedRules?.forEach(traverse);
  });

  if (!foundRef) return false;

  const localCosts = {};
  const localConstraints = {};
  const localCharacteristics = {};
  let localName = foundRef.name;
  let localDescription = foundRef.description;

  if (patch.field === 'name') {
    foundRef.name = patch.newValue;
    localName = patch.newValue;
  } else if (patch.field.startsWith('cost-')) {
    const typeId = patch.field.replace('cost-', '');
    if (foundRef.costs) {
      const cost = foundRef.costs.find(c => c.typeId === typeId);
      if (cost) {
        cost.value = parseFloat(patch.newValue) || 0;
        localCosts[typeId] = patch.newValue;
      }
    }
  } else if (patch.field.startsWith('constraint-')) {
    const conId = patch.field.replace('constraint-', '');
    if (foundRef.constraints) {
      const con = foundRef.constraints.find(c => c.id === conId);
      if (con) {
        con.value = parseFloat(patch.newValue) || 0;
        localConstraints[conId] = patch.newValue;
      }
    }
  } else if (patch.field.startsWith('characteristic-')) {
    const charName = patch.field.replace('characteristic-', '');
    if (foundRef.characteristics) {
      const char = foundRef.characteristics.find(c => c.name === charName);
      if (char) {
        char.value = patch.newValue;
        localCharacteristics[charName] = patch.newValue;
      }
    }
  } else if (patch.field === 'description') {
    foundRef.description = patch.newValue;
    localDescription = patch.newValue;
  }

  updateRawXml(system, patch.id, patch.type, localName, localCosts, localConstraints, localCharacteristics, localDescription);
  return true;
};

export default function Importer({ onSystemImported }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [editingSystem, setEditingSystem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const [localName, setLocalName] = useState('');
  const [localCosts, setLocalCosts] = useState({});
  const [localConstraints, setLocalConstraints] = useState({});
  const [localCharacteristics, setLocalCharacteristics] = useState({});
  const [localDescription, setLocalDescription] = useState('');

  const [activeTab, setActiveTab] = useState('manual');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pageRange, setPageRange] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [analysisLogs, setAnalysisLogs] = useState([]);
  const [detectedPatches, setDetectedPatches] = useState([]);

  useEffect(() => {
    if (editingSystem) {
      const results = searchEditableEntries(editingSystem, searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, editingSystem]);

  const handleSelectEntry = (res) => {
    setSelectedEntry(res);
    setLocalName(res.ref.name || '');
    
    const costsMap = {};
    if (res.type === 'entry' && res.ref.costs) {
      res.ref.costs.forEach(c => {
        costsMap[c.typeId] = c.value || 0;
      });
    }
    setLocalCosts(costsMap);

    const constraintsMap = {};
    if ((res.type === 'entry' || res.type === 'group') && res.ref.constraints) {
      res.ref.constraints.forEach(con => {
        constraintsMap[con.id] = con.value || 0;
      });
    }
    setLocalConstraints(constraintsMap);

    const characteristicsMap = {};
    if (res.type === 'profile' && res.ref.characteristics) {
      res.ref.characteristics.forEach(ch => {
        characteristicsMap[ch.name] = ch.value || '';
      });
    }
    setLocalCharacteristics(characteristicsMap);

    setLocalDescription(res.ref.description || '');
  };

  const handleSave = async () => {
    try {
      selectedEntry.ref.name = localName;
      if (selectedEntry.type === 'entry') {
        if (selectedEntry.ref.costs) {
          selectedEntry.ref.costs.forEach(c => {
            if (localCosts[c.typeId] !== undefined) {
              c.value = parseFloat(localCosts[c.typeId]) || 0;
            }
          });
        }
        if (selectedEntry.ref.constraints) {
          selectedEntry.ref.constraints.forEach(con => {
            if (localConstraints[con.id] !== undefined) {
              con.value = parseFloat(localConstraints[con.id]) || 0;
            }
          });
        }
      } else if (selectedEntry.type === 'group') {
        if (selectedEntry.ref.constraints) {
          selectedEntry.ref.constraints.forEach(con => {
            if (localConstraints[con.id] !== undefined) {
              con.value = parseFloat(localConstraints[con.id]) || 0;
            }
          });
        }
      } else if (selectedEntry.type === 'profile') {
        if (selectedEntry.ref.characteristics) {
          selectedEntry.ref.characteristics.forEach(ch => {
            if (localCharacteristics[ch.name] !== undefined) {
              ch.value = localCharacteristics[ch.name];
            }
          });
        }
      } else if (selectedEntry.type === 'rule') {
        selectedEntry.ref.description = localDescription;
      }

      updateRawXml(editingSystem, selectedEntry.id, selectedEntry.type, localName, localCosts, localConstraints, localCharacteristics, localDescription);

      await saveSystem(editingSystem);
      setSuccessMsg(`"${localName}" erfolgreich gespeichert!`);
      setSelectedEntry(null);
      loadSystems();
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError('Fehler beim Speichern der Änderungen.');
    }
  };

  const handleExport = async (sys) => {
    try {
      if (!sys.rawXmls) {
        const jsonString = JSON.stringify(sys, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sys.name}_modified.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setSuccessMsg(`Spielsystem "${sys.name}" erfolgreich als JSON exportiert (keine XML-Originaldateien vorhanden).`);
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
      link.download = `${sys.name}_modified.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccessMsg(`Spielsystem "${sys.name}" erfolgreich als .zip (Originalformat) exportiert!`);
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Exportieren des Spielsystems: ${e.message}`);
    }
  };

  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('PDF.js konnte nicht geladen werden.'));
      document.head.appendChild(script);
    });
  };

  const parsePageNumbers = (rangeStr) => {
    const pages = new Set();
    const parts = rangeStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            pages.add(i);
          }
        }
      } else {
        const pageNum = parseInt(trimmed, 10);
        if (!isNaN(pageNum)) {
          pages.add(pageNum);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleStartAnalysis = async () => {
    if (!apiKey) {
      setError('Bitte trage einen Gemini API-Schlüssel ein.');
      return;
    }
    if (!selectedCatalogId) {
      setError('Bitte wähle zuerst eine Fraktion (Katalog) aus.');
      return;
    }
    if (!pdfFile) {
      setError('Bitte lade ein Armeebuch-PDF hoch.');
      return;
    }
    if (!pageRange) {
      setError('Bitte gib einen Seitenbereich an.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisLogs([{ type: 'info', message: 'Lese Armeebuch-PDF ein...' }]);
    setDetectedPatches([]);
    setError(null);
    setSuccessMsg(null);

    try {
      const pagesToProcess = parsePageNumbers(pageRange);
      if (pagesToProcess.length === 0) {
        throw new Error('Ungültiger Seitenbereich. Bitte verwende Zahlen (z. B. "55-70" oder "60").');
      }

      setAnalysisProgress('Lade PDF.js Renderer...');
      const pdfjsLib = await loadPdfJs();

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const catalogueEntries = getCatalogueContext(editingSystem, selectedCatalogId);
      if (catalogueEntries.length === 0) {
        throw new Error('Es wurden keine Einträge für den ausgewählten Katalog gefunden.');
      }

      setAnalysisLogs(prev => [...prev, {
        type: 'info',
        message: `${catalogueEntries.length} Fraktions-Einträge für den Abgleich geladen.`
      }]);

      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageNum = pagesToProcess[i];
        if (pageNum < 1 || pageNum > pdfDoc.numPages) {
          setAnalysisLogs(prev => [...prev, {
            type: 'error',
            message: `Seite ${pageNum} existiert nicht im PDF (max: ${pdfDoc.numPages}). Überspringe.`
          }]);
          continue;
        }

        setAnalysisProgress(`Rendere Seite ${pageNum} (${i + 1} von ${pagesToProcess.length})...`);
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        setAnalysisProgress(`Analysiere Seite ${pageNum} via Gemini Vision KI...`);
        setAnalysisLogs(prev => [...prev, {
          type: 'info',
          message: `Sende Seite ${pageNum} an Gemini Vision API...`
        }]);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Du bist ein präziser Tabletop-Regelprüfer.
Hier ist das offizielle Armeebuch-Layout (Bild) und eine JSON-Liste aller Datenbankeinträge unserer Fraktion:
${JSON.stringify(catalogueEntries, null, 2)}

Deine Aufgabe ist es, die Werte im Bild (Soll-Werte) mit den Werten in der JSON-Liste (Ist-Werte) abzugleichen.
Finde Abweichungen bei:
1. Profilwerten (M, WS, BS, S, T, W, I, A, Ld)
2. Punktekosten (z.B. Ausrüstung, Einheiten, Mounts)
3. Limits/Regeln (z.B. maximale Punkte für magische Ausrüstung in Kategorien, oft in 'Magic and Traits' oder 'Magic Items')

Für jede Abweichung, gib ein JSON-Objekt in einer Liste zurück. Verwende folgende Struktur:
- "id": Die ID des Eintrags aus unserer Liste.
- "type": "entry" | "profile" | "group" | "rule"
- "field":
  * "cost-[typeId]" (z.B. "cost-pts" oder "cost-ecfa-8486-4f6c-c249" für Punkte)
  * "constraint-[id]" (z.B. "constraint-6462-adf4-4373-7820")
  * "characteristic-[name]" (z.B. "characteristic-MW" oder "characteristic-A")
  * "description" (für Regelbeschreibungen)
- "originalValue": Der aktuelle Wert aus unserer Liste.
- "newValue": Der korrekte Wert laut Armeebuch-Seite.
- "reason": Kurze deutsche Begründung (z.B. "Laut Armeebuch Seite 55 beträgt das Limit 50 Punkte").

Gibt NUR das rohe JSON-Array zurück (beginnend mit [ und endend mit ]). Verwende KEIN Markdown-Fencing (wie \`\`\`json). Wenn keine Abweichungen gefunden wurden, gib ein leeres Array [] zurück.`
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Data
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API Error (HTTP ${response.status}): ${errText}`);
        }

        const resData = await response.json();
        const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleanJson = textResponse.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        
        let patches = [];
        try {
          patches = JSON.parse(cleanJson);
        } catch (pe) {
          console.warn("Failed parsing JSON response from model:", textResponse);
          setAnalysisLogs(prev => [...prev, {
            type: 'error',
            message: `[Seite ${pageNum}] Fehler beim Verarbeiten der Antwort der Vision KI. Überspringe.`
          }]);
          continue;
        }

        if (!Array.isArray(patches) || patches.length === 0) {
          setAnalysisLogs(prev => [...prev, {
            type: 'info',
            message: `[Seite ${pageNum}] Keine Abweichungen festgestellt.`
          }]);
        } else {
          setAnalysisLogs(prev => [...prev, {
            type: 'info',
            message: `[Seite ${pageNum}] ${patches.length} Abweichung(en) gefunden!`
          }]);
          
          patches.forEach(p => {
            setAnalysisLogs(prev => [...prev, {
              type: 'patch',
              message: `-> Korrektur für "${p.id}" (${p.field}): ${p.originalValue} -> ${p.newValue} (${p.reason})`
            }]);
            setDetectedPatches(prev => [...prev, p]);
          });
        }
      }

      setAnalysisProgress('Abgleich abgeschlossen!');
      setAnalysisLogs(prev => [...prev, {
        type: 'info',
        message: 'KI-Abgleich erfolgreich beendet. Überprüfe die Abweichungen und wende sie an.'
      }]);
    } catch (err) {
      console.error(err);
      setAnalysisLogs(prev => [...prev, {
        type: 'error',
        message: `Kritischer Fehler: ${err.message}`
      }]);
      setError(`Fehler beim Massen-Abgleich: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyPatches = async () => {
    try {
      const sys = { ...editingSystem };
      let count = 0;

      detectedPatches.forEach(patch => {
        const result = findAndMutateJsonPatch(sys, patch);
        if (result) {
          count++;
        }
      });

      await saveSystem(sys);
      setEditingSystem(sys);
      setSuccessMsg(`${count} Korrekturen erfolgreich in die Spieldaten und XMLs eingespielt!`);
      setDetectedPatches([]);
      loadSystems();
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Übernehmen der Korrekturen: ${e.message}`);
    }
  };

  useEffect(() => {
    loadSystems();
  }, []);

  const loadSystems = async () => {
    try {
      const data = await getAllSystems();
      setSystems(data);
    } catch (e) {
      console.error("Error loading systems", e);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setSuccessMsg(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    setError(null);
    setSuccessMsg(null);
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.json')) {
      setError('Bitte lade eine gültige .zip-Datei oder eine exportierte .json-Datei hoch.');
      return;
    }

    setLoading(true);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const systemData = JSON.parse(text);
        
        if (!systemData.id || !systemData.name || !systemData.catalogues) {
          throw new Error('Ungültiges Format: Die JSON-Datei enthält kein gültiges Spielsystem.');
        }

        await saveSystem(systemData);
        setSuccessMsg(`Das modifizierte System "${systemData.name}" wurde erfolgreich importiert!`);
      } else {
        const { gstFiles, catFiles } = await extractZipFiles(file);
        const systemData = processImportedData(gstFiles, catFiles);
        systemData.rawXmls = {
          gst: gstFiles,
          cat: catFiles
        };
        await saveSystem(systemData);
        setSuccessMsg(`Das System "${systemData.name}" mit ${systemData.catalogues.length} Katalogen wurde erfolgreich importiert!`);
      }
      loadSystems();
      if (onSystemImported) onSystemImported();
    } catch (e) {
      console.error(e);
      setError(`Fehler beim Verarbeiten der Datei: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Bist du sicher, dass du dieses Spielsystem löschen möchtest? Alle zugehörigen Listen gehen verloren.')) {
      try {
        await deleteSystem(id);
        setSuccessMsg('System gelöscht.');
        loadSystems();
        if (onSystemImported) onSystemImported();
      } catch (e) {
        setError('Fehler beim Löschen des Systems.');
      }
    }
  };

  if (editingSystem) {
    return (
      <div className="container">
        <div className="gothic-panel">
          <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-gold-dim)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className="btn-gold btn-sm" 
                onClick={() => { setEditingSystem(null); setSelectedEntry(null); setSearchQuery(''); setError(null); setSuccessMsg(null); }}
                style={{ padding: '4px 8px' }}
              >
                <ArrowLeft size={16} />
              </button>
              <h2 style={{ margin: 0 }} className="font-serif text-gold">Daten anpassen: {editingSystem.name}</h2>
            </div>
          </div>

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

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-dark)' }}>
            <button 
              className={`btn-sm`}
              onClick={() => setActiveTab('manual')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === 'manual' ? 'rgba(226,183,66,0.1)' : 'transparent',
                color: activeTab === 'manual' ? 'var(--text-gold)' : 'var(--text-dim)',
                border: '1px solid var(--border-dark)',
                borderBottom: activeTab === 'manual' ? '1px solid transparent' : '1px solid var(--border-dark)',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Manuelle Suche &amp; Editor
            </button>
            <button 
              className={`btn-sm`}
              onClick={() => setActiveTab('auto')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === 'auto' ? 'rgba(226,183,66,0.1)' : 'transparent',
                color: activeTab === 'auto' ? 'var(--text-gold)' : 'var(--text-dim)',
                border: '1px solid var(--border-dark)',
                borderBottom: activeTab === 'auto' ? '1px solid transparent' : '1px solid var(--border-dark)',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Automatischer Massen-Abgleich (PDF)
            </button>
          </div>

          {activeTab === 'manual' && (
            <div>
              {!selectedEntry ? (
            <div>
              <p className="text-dim" style={{ marginBottom: '16px', fontFamily: 'var(--font-body)' }}>
                Suche nach Einheiten, Upgrades, Ausrüstungs-Kategorien oder Profilen, um deren Werte (Punkte, Profile, Limits) direkt anzupassen.
              </p>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Suche nach Name (mind. 2 Zeichen)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-parchment)',
                    border: '1px solid var(--border-gold-dim)',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)'
                  }}
                />
              </div>

              {/* Search Results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {searchResults.map((res) => (
                  <div 
                    key={`${res.type}-${res.id}`} 
                    className="flex-between hover-row"
                    onClick={() => handleSelectEntry(res)}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--border-dark)',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '2px 6px', 
                          borderRadius: '3px',
                          backgroundColor: res.type === 'entry' ? 'rgba(226,183,66,0.1)' : res.type === 'group' ? 'rgba(59,130,246,0.1)' : res.type === 'profile' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: res.type === 'entry' ? 'var(--text-gold)' : res.type === 'group' ? '#60a5fa' : res.type === 'profile' ? '#34d399' : '#f87171',
                          border: `1px solid ${res.type === 'entry' ? 'var(--border-gold-dim)' : res.type === 'group' ? 'rgba(59,130,246,0.3)' : res.type === 'profile' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                        }}>
                          {res.type === 'entry' ? 'Einheit/Option' : res.type === 'group' ? 'Kategorie/Gruppe' : res.type === 'profile' ? 'Profil' : 'Regel/Beschreibung'}
                        </span>
                        <strong style={{ fontSize: '0.95rem' }} className="font-serif">{res.name}</strong>
                      </div>
                      <div className="text-dim" style={{ fontSize: '0.75rem', marginTop: '4px', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                        {res.path}
                      </div>
                    </div>
                  </div>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-dim" style={{ textAlign: 'center', padding: '12px', fontFamily: 'var(--font-body)' }}>
                    Keine Einträge für "{searchQuery}" gefunden.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Editing Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3 className="font-serif text-gold" style={{ margin: 0 }}>Eintrag bearbeiten: {selectedEntry.name}</h3>
                  <div className="text-dim" style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px', fontFamily: 'var(--font-body)' }}>{selectedEntry.path}</div>
                </div>
                <button 
                  className="btn-gold btn-sm"
                  onClick={() => setSelectedEntry(null)}
                >
                  Zurück zur Suche
                </button>
              </div>

              <div style={{ padding: '16px', border: '1px solid var(--border-gold-dim)', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {/* Type Badge */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    padding: '2px 6px', 
                    borderRadius: '3px',
                    backgroundColor: selectedEntry.type === 'entry' ? 'rgba(226,183,66,0.1)' : selectedEntry.type === 'group' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                    color: selectedEntry.type === 'entry' ? 'var(--text-gold)' : selectedEntry.type === 'group' ? '#60a5fa' : '#34d399',
                    border: `1px solid ${selectedEntry.type === 'entry' ? 'var(--border-gold-dim)' : selectedEntry.type === 'group' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`
                  }}>
                    {selectedEntry.type === 'entry' ? 'Einheit/Option' : selectedEntry.type === 'group' ? 'Kategorie/Gruppe' : 'Profil'}
                  </span>
                  <span className="text-dim font-sans" style={{ fontSize: '0.8rem', marginLeft: '12px' }}>
                    ID: {selectedEntry.id}
                  </span>
                </div>

                {/* Name Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Name</label>
                  <input 
                    type="text" 
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-dark)',
                      color: 'var(--text-parchment)',
                      border: '1px solid var(--border-dark)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-body)'
                    }}
                  />
                </div>

                {/* Costs Editor (for Selection Entries) */}
                {selectedEntry.type === 'entry' && selectedEntry.ref.costs?.length > 0 && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Punktekosten</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedEntry.ref.costs.map((c) => (
                        <div key={c.typeId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', width: '100px', fontFamily: 'var(--font-body)' }}>{c.name || 'Punkte'}:</span>
                          <input 
                            type="number" 
                            value={localCosts[c.typeId] || 0}
                            onChange={(e) => setLocalCosts({ ...localCosts, [c.typeId]: e.target.value })}
                            style={{
                              width: '100px',
                              padding: '6px 8px',
                              backgroundColor: 'var(--bg-dark)',
                              color: 'var(--text-parchment)',
                              border: '1px solid var(--border-dark)',
                              borderRadius: '4px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-body)'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Profile Characteristics Editor */}
                {selectedEntry.type === 'profile' && selectedEntry.ref.characteristics?.length > 0 && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Profilwerte</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                      {selectedEntry.ref.characteristics.map((ch) => (
                        <div key={ch.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{ch.name}</span>
                          <input 
                            type="text" 
                            value={localCharacteristics[ch.name] || ''}
                            onChange={(e) => setLocalCharacteristics({ ...localCharacteristics, [ch.name]: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px',
                              textAlign: 'center',
                              backgroundColor: 'var(--bg-dark)',
                              color: 'var(--text-parchment)',
                              border: '1px solid var(--border-dark)',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-body)'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints Editor */}
                {(selectedEntry.type === 'entry' || selectedEntry.type === 'group') && selectedEntry.ref.constraints?.length > 0 && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Regeln &amp; Limits (Constraints)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedEntry.ref.constraints.map((con) => (
                        <div 
                          key={con.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            border: '1px solid var(--border-dark)',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0,0,0,0.1)'
                          }}
                        >
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                            <strong>{con.type === 'max' ? 'Maximal' : 'Mindestens'}:</strong>
                            <span style={{ marginLeft: '6px', color: 'var(--text-dim)' }}>
                              {con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' ? 'Punkte' : 'Auswahlen'} (Scope: {con.scope})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="number" 
                              value={localConstraints[con.id] || 0}
                              onChange={(e) => setLocalConstraints({ ...localConstraints, [con.id]: e.target.value })}
                              style={{
                                width: '80px',
                                padding: '6px 8px',
                                backgroundColor: 'var(--bg-dark)',
                                color: 'var(--text-parchment)',
                                border: '1px solid var(--border-dark)',
                                borderRadius: '4px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-body)'
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Rule Description Editor */}
                {selectedEntry.type === 'rule' && (
                  <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Beschreibung (Regeltext)</label>
                    <textarea 
                      value={localDescription}
                      onChange={(e) => setLocalDescription(e.target.value)}
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-dark)',
                        color: 'var(--text-parchment)',
                        border: '1px solid var(--border-dark)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-body)',
                        lineHeight: '1.4'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-primary" 
                  onClick={handleSave}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Speichern
                </button>
                <button 
                  className="btn-gold" 
                  onClick={() => setSelectedEntry(null)}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
              )}
            </div>
          )}

          {activeTab === 'auto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p className="text-dim" style={{ fontFamily: 'var(--font-body)' }}>
                Nutze Gemini Vision KI, um ein gescanntes PDF-Armeebuch einzulesen, Abweichungen (Punkte, Profile, Limits) automatisch zu erkennen und zu korrigieren.
              </p>

              {/* Gemini API Key Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>Gemini API-Schlüssel</label>
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value); }}
                  placeholder="AIzaSy..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-parchment)',
                    border: '1px solid var(--border-gold-dim)',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {/* Catalogue Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>1. Fraktion (Katalog) auswählen</label>
                <select 
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-parchment)',
                    border: '1px solid var(--border-gold-dim)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)'
                  }}
                >
                  <option value="">-- Fraktion wählen --</option>
                  {editingSystem.catalogues?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* PDF Uploader Zone (locked until Catalogue selected) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>2. Armeebuch-PDF hochladen</label>
                {!selectedCatalogId ? (
                  <div style={{ 
                    padding: '24px', 
                    border: '1px dashed var(--border-dark)', 
                    borderRadius: '4px', 
                    backgroundColor: 'rgba(0,0,0,0.1)', 
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                    fontStyle: 'italic',
                    fontFamily: 'var(--font-body)'
                  }}>
                    Wähle zuerst eine Fraktion aus, um den PDF-Upload freizuschalten.
                  </div>
                ) : (
                  <div 
                    style={{ 
                      padding: '24px', 
                      border: '2px dashed var(--border-gold-dim)', 
                      borderRadius: '4px', 
                      backgroundColor: 'rgba(255,255,255,0.01)', 
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => document.getElementById('pdf-upload-input').click()}
                  >
                    <input 
                      type="file" 
                      id="pdf-upload-input" 
                      style={{ display: 'none' }} 
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setPdfFile(e.target.files[0]);
                        }
                      }}
                    />
                    {pdfFile ? (
                      <div style={{ color: 'var(--text-gold)' }}>
                        <strong>{pdfFile.name}</strong> ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB) geladen
                      </div>
                    ) : (
                      <div className="text-dim" style={{ fontFamily: 'var(--font-body)' }}>
                        Klicke hier, um das Armeebuch-PDF auszuwählen (nur gescanntes PDF)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Page Range Input (locked until PDF uploaded) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-gold)', fontFamily: 'var(--font-body)' }}>3. Seitenbereich angeben (z.B. "55-70" oder "60")</label>
                <input 
                  type="text"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  disabled={!pdfFile}
                  placeholder="z.B. 55-70"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-parchment)',
                    border: '1px solid var(--border-gold-dim)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)'
                  }}
                />
              </div>

              {/* Start Control */}
              <div style={{ marginTop: '10px' }}>
                <button 
                  className="btn-primary" 
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing || !apiKey || !selectedCatalogId || !pdfFile || !pageRange}
                  style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                >
                  {isAnalyzing ? 'Abgleich läuft...' : 'Automatischer KI-Abgleich starten'}
                </button>
                {isAnalyzing && (
                  <div style={{ marginTop: '12px', color: 'var(--text-gold)', fontStyle: 'italic', textAlign: 'center', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>
                    {analysisProgress}
                  </div>
                )}
              </div>

              {/* Log Console & Proposed Patches */}
              {analysisLogs.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h3 className="font-serif text-gold" style={{ marginBottom: '10px' }}>KI-Protokoll &amp; gefundene Abweichungen</h3>
                  <div style={{ 
                    padding: '12px 16px', 
                    border: '1px solid var(--border-gold-dim)', 
                    borderRadius: '4px', 
                    backgroundColor: 'rgba(0,0,0,0.3)', 
                    maxHeight: '250px', 
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {analysisLogs.map((log, idx) => (
                      <div key={idx} style={{ 
                        color: log.type === 'error' ? 'var(--color-danger)' : log.type === 'patch' ? '#34d399' : 'var(--text-dim)' 
                      }}>
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detectedPatches.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handleApplyPatches}
                    style={{ width: '100%', padding: '12px', backgroundColor: '#1b7340', borderColor: '#1b7340', fontSize: '1.05rem', fontWeight: 'bold' }}
                  >
                    Alle {detectedPatches.length} Korrekturen anwenden &amp; XMLs patchen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="gothic-panel">
        <h1>...</h1>
        <p className="text-dim" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Lade BSData Repository ZIP-Archive hoch (z.B. von BSData/wh40k-10th-edition). 
          Die Dateien werden komplett lokal auf deinem Gerät verarbeitet und in einer Browser-Datenbank gespeichert.
        </p>

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

        <div 
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload').click()}
        >
          <input 
            type="file" 
            id="file-upload" 
            style={{ display: 'none' }} 
            accept=".zip,.json"
            onChange={handleFileInput}
          />
          <Upload className="drop-zone-icon" size={48} style={{ margin: '0 auto 12px' }} />
          <h3>Ziehe BSData .zip oder exportierte .json hierher</h3>
          <p className="text-dim">oder klicke, um deine Dateien zu durchsuchen</p>
          {loading && (
            <div style={{ marginTop: '16px', color: 'var(--text-gold)' }}>
              <span className="font-serif">Beschwöre Spieldaten... (Verarbeite XML)</span>
            </div>
          )}
        </div>
      </div>

      <div className="gothic-panel" style={{ marginTop: '24px' }}>
        <h2>Importierte Spielsysteme</h2>
        {systems.length === 0 ? (
          <p className="text-dim" style={{ textAlign: 'center', padding: '20px 0' }}>
            Keine Spielsysteme geladen. Bitte importiere oben ein BSData-System (.zip).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {systems.map((sys) => (
              <div 
                key={sys.id} 
                className="flex-between" 
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid var(--border-dark)', 
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText className="text-gold" size={24} />
                  <div>
                    <h4 style={{ margin: 0 }}>{sys.name}</h4>
                    <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                      {sys.catalogues?.length || 0} Fraktionskataloge geladen
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn-gold btn-sm" 
                    onClick={() => { setEditingSystem(sys); setSearchQuery(''); setSelectedEntry(null); setError(null); setSuccessMsg(null); }}
                    title="Daten anpassen"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="btn-gold btn-sm" 
                    onClick={() => handleExport(sys)}
                    title="System exportieren (.json)"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                  >
                    <Download size={16} />
                  </button>
                  <button 
                    className="btn-danger btn-sm" 
                    onClick={() => handleDelete(sys.id)}
                    title="System löschen"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostic Panel */}
      <div className="gothic-panel" style={{ marginTop: '24px' }}>
        <h2>Tome-Diagnostik</h2>
        <p className="text-dim" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
          Wenn bestimmte Ausrüstungsgegenstände oder Optionen nicht angezeigt werden, führe diese Diagnose aus und kopiere das Ergebnis hierher.
        </p>
        <button 
          onClick={async () => {
            const allSystems = await getAllSystems();
            const matches = [];
            
            allSystems.forEach(sys => {
              sys.catalogues?.forEach(cat => {
                const checkList = (list, path = "") => {
                  if (!list) return;
                  list.forEach(entry => {
                    const entryName = entry.name || "";
                    if (entryName.toLowerCase().includes("wizard") || 
                        entryName.toLowerCase().includes("arcane") || 
                        entryName.toLowerCase().includes("zauberer") ||
                        entryName.toLowerCase().includes("gegenstände") ||
                        entryName.toLowerCase().includes("relic") ||
                        entryName.toLowerCase().includes("mirror") ||
                        entryName.toLowerCase().includes("scroll") ||
                        entryName.toLowerCase().includes("stone") ||
                        entryName.toLowerCase().includes("magic") ||
                        entry.id === "36ea-06e6-53d9-6b07" ||
                        entry.id === "cbbf-b0c7-561e-bcd8") {
                      
                      matches.push({
                        system: sys.name,
                        catalogue: cat.name,
                        cataloguesInSystem: sys.catalogues.map(c => c.name),
                        path: path + " -> " + entryName + ` (id: ${entry.id}, targetId: ${entry.targetId || 'none'}, type: ${entry.type || 'none'})`,
                        selectionEntriesCount: entry.selectionEntries?.length || 0,
                        entryLinksCount: entry.entryLinks?.length || 0,
                        selectionEntryGroupsCount: entry.selectionEntryGroups?.length || 0,
                        rawChildren: (entry.selectionEntries || []).map(c => `${c.name} (${c.type})`).concat((entry.entryLinks || []).map(c => `${c.name} (${c.type}, target: ${c.targetId})`))
                      });
                    }
                    checkList(entry.selectionEntries, path + " -> " + entryName);
                    checkList(entry.entryLinks, path + " -> " + entryName);
                    checkList(entry.selectionEntryGroups, path + " -> " + entryName);
                  });
                };
                
                checkList(cat.selectionEntries, "root selectionEntries");
                checkList(cat.entryLinks, "root entryLinks");
                checkList(cat.sharedSelectionEntries, "sharedSelectionEntries");
                checkList(cat.sharedSelectionEntryGroups, "sharedSelectionEntryGroups");
              });
            });

            document.getElementById('diag-output').value = JSON.stringify(matches, null, 2);
          }}
        >
          Diagnose-Scan ausführen
        </button>
        <textarea 
          id="diag-output" 
          rows={10} 
          readOnly 
          style={{ 
            marginTop: '12px', 
            width: '100%', 
            fontFamily: 'monospace', 
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-dark)',
            color: 'var(--text-parchment)',
            border: '1px solid var(--border-gold-dim)'
          }}
          placeholder="Diagnose-Ergebnisse erscheinen hier nach dem Klick..."
        />
      </div>
    </div>
  );
}
