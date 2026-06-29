/**
 * Compiles a flat list of entry paths and rule fields from a catalogue
 * to provide a context object for the Vision AI matching.
 */
export function getCatalogueContext(system, catalogueId) {
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
}

/**
 * Parses page number strings (e.g. "1,2,5-8,10") into an array of page numbers.
 */
export function parsePageNumbers(rangeStr) {
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
}

/**
 * Executes a Gemini Vision AI content generation request to find discrepancies.
 */
export async function runVisionAnalysis(apiKey, base64Image, catalogueEntries) {
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
                data: base64Image
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
  return JSON.parse(cleanJson);
}

export function updateRawXml(system, entryId, type, localName, localCosts, localConstraints, localCharacteristics, localDescription) {
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

  if (['entry', 'group', 'categoryLink', 'forceEntry'].includes(type)) {
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
}

export function findAndMutateJsonPatch(system, patch) {
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
  
  // Traverse root game system too
  traverse(system);
  system.sharedSelectionEntries?.forEach(traverse);
  system.sharedSelectionEntryGroups?.forEach(traverse);
  system.sharedProfiles?.forEach(traverse);
  system.sharedRules?.forEach(traverse);

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
}

export function searchEditableEntries(system, query) {
  if (!query || query.length < 2) return [];
  const results = [];
  const q = query.toLowerCase();

  const addEntry = (entry, catalogueName, path) => {
    const matchesName = entry.name && entry.name.toLowerCase().includes(q);
    const matchesId = entry.id && entry.id.toLowerCase().includes(q);
    if (matchesName || matchesId) {
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
    const matchesName = group.name && group.name.toLowerCase().includes(q);
    const matchesId = group.id && group.id.toLowerCase().includes(q);
    if (matchesName || matchesId) {
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
    const matchesName = profile.name && profile.name.toLowerCase().includes(q);
    const matchesId = profile.id && profile.id.toLowerCase().includes(q);
    if (matchesName || matchesId) {
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
    const matchesName = rule.name && rule.name.toLowerCase().includes(q);
    const matchesId = rule.id && rule.id.toLowerCase().includes(q);
    if (matchesName || matchesId) {
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

  // Search within the Game System (.gst) data itself
  const gstName = system.name || "Game System";
  
  system.sharedSelectionEntries?.forEach(se => {
    addEntry(se, gstName, gstName + " (Shared) -> " + se.name);
    traverse(se, gstName, gstName + " (Shared) -> " + se.name);
  });
  system.sharedSelectionEntryGroups?.forEach(seg => {
    addGroup(seg, gstName, gstName + " (Shared) -> " + seg.name);
    traverse(seg, gstName, gstName + " (Shared) -> " + seg.name);
  });
  system.sharedProfiles?.forEach(p => {
    addProfile(p, gstName, gstName + " (Shared) -> " + p.name);
  });
  system.sharedRules?.forEach(r => {
    addRule(r, gstName, gstName + " (Shared Rule) -> " + r.name);
  });

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
}

export function findExactEntryById(system, id) {
  if (!id) return null;
  const q = id.toLowerCase();
  let found = null;

  const check = (item, type, catalogueName, path) => {
    if (found) return;
    if (item && item.id && item.id.toLowerCase() === q) {
      found = {
        type,
        id: item.id,
        name: item.name || item.id,
        catalogueName,
        path,
        ref: item
      };
    }
  };

  const traverse = (item, catalogueName, path) => {
    if (found || !item) return;

    if (item.selectionEntries) {
      item.selectionEntries.forEach(se => {
        check(se, 'entry', catalogueName, path + " -> " + se.name);
        traverse(se, catalogueName, path + " -> " + se.name);
      });
    }
    if (item.entryLinks) {
      item.entryLinks.forEach(el => {
        check(el, 'entryLink', catalogueName, path + " -> Link: " + el.name);
        traverse(el, catalogueName, path + " -> Link: " + el.name);
      });
    }
    if (item.selectionEntryGroups) {
      item.selectionEntryGroups.forEach(seg => {
        check(seg, 'group', catalogueName, path + " -> Group: " + seg.name);
        traverse(seg, catalogueName, path + " -> Group: " + seg.name);
      });
    }
    if (item.profiles) {
      item.profiles.forEach(p => {
        check(p, 'profile', catalogueName, path + " -> Profile: " + p.name);
        traverse(p, catalogueName, path + " -> Profile: " + p.name);
      });
    }
    if (item.rules) {
      item.rules.forEach(r => {
        check(r, 'rule', catalogueName, path + " -> Rule: " + r.name);
        traverse(r, catalogueName, path + " -> Rule: " + r.name);
      });
    }
    if (item.categoryEntries) {
      item.categoryEntries.forEach(ce => {
        check(ce, 'category', catalogueName, path + " -> Category: " + ce.name);
        traverse(ce, catalogueName, path + " -> Category: " + ce.name);
      });
    }
    if (item.infoLinks) {
      item.infoLinks.forEach(il => {
        check(il, 'infoLink', catalogueName, path + " -> InfoLink: " + (il.name || il.targetId));
        traverse(il, catalogueName, path + " -> InfoLink: " + (il.name || il.targetId));
      });
    }
    if (item.forceEntries) {
      item.forceEntries.forEach(fe => {
        check(fe, 'forceEntry', catalogueName, path + " -> Force: " + fe.name);
        traverse(fe, catalogueName, path + " -> Force: " + fe.name);
      });
    }
    if (item.categoryLinks) {
      item.categoryLinks.forEach(cl => {
        check(cl, 'categoryLink', catalogueName, path + " -> CatLink: " + (cl.name || cl.targetId));
        traverse(cl, catalogueName, path + " -> CatLink: " + (cl.name || cl.targetId));
      });
    }
  };

  const gstName = system.name || "Game System";
  check(system, 'system', gstName, gstName);
  traverse(system, gstName, gstName);

  system.sharedSelectionEntries?.forEach(se => {
    check(se, 'entry', gstName, gstName + " (Shared) -> " + se.name);
    traverse(se, gstName, gstName + " (Shared) -> " + se.name);
  });
  system.sharedSelectionEntryGroups?.forEach(seg => {
    check(seg, 'group', gstName, gstName + " (Shared Group) -> " + seg.name);
    traverse(seg, gstName, gstName + " (Shared Group) -> " + seg.name);
  });
  system.sharedProfiles?.forEach(p => {
    check(p, 'profile', gstName, gstName + " (Shared Profile) -> " + p.name);
    traverse(p, gstName, gstName + " (Shared Profile) -> " + p.name);
  });
  system.sharedRules?.forEach(r => {
    check(r, 'rule', gstName, gstName + " (Shared Rule) -> " + r.name);
    traverse(r, gstName, gstName + " (Shared Rule) -> " + r.name);
  });
  system.categoryEntries?.forEach(ce => {
    check(ce, 'category', gstName, gstName + " (Category) -> " + ce.name);
    traverse(ce, gstName, gstName + " (Category) -> " + ce.name);
  });

  if (system.catalogues) {
    for (const cat of system.catalogues) {
      if (found) break;
      check(cat, 'catalogue', cat.name, cat.name);
      traverse(cat, cat.name, cat.name);

      cat.sharedSelectionEntries?.forEach(se => {
        check(se, 'entry', cat.name, cat.name + " (Shared) -> " + se.name);
        traverse(se, cat.name, cat.name + " (Shared) -> " + se.name);
      });
      cat.sharedSelectionEntryGroups?.forEach(seg => {
        check(seg, 'group', cat.name, cat.name + " (Shared Group) -> " + seg.name);
        traverse(seg, cat.name, cat.name + " (Shared Group) -> " + seg.name);
      });
      cat.sharedProfiles?.forEach(p => {
        check(p, 'profile', cat.name, cat.name + " (Shared Profile) -> " + p.name);
        traverse(p, cat.name, cat.name + " (Shared Profile) -> " + p.name);
      });
      cat.sharedRules?.forEach(r => {
        check(r, 'rule', cat.name, cat.name + " (Shared Rule) -> " + r.name);
        traverse(r, cat.name, cat.name + " (Shared Rule) -> " + r.name);
      });
      cat.categoryEntries?.forEach(ce => {
        check(ce, 'category', cat.name, cat.name + " (Category) -> " + ce.name);
        traverse(ce, cat.name, cat.name + " (Category) -> " + ce.name);
      });
    }
  }

  return found;
}
