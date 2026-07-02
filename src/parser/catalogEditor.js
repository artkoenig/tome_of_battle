const getDOMParser = () => {
  if (typeof DOMParser !== 'undefined') {
    return DOMParser;
  }
  if (typeof globalThis !== 'undefined' && globalThis.DOMParser) {
    return globalThis.DOMParser;
  }
  if (typeof window !== 'undefined' && window.DOMParser) {
    return window.DOMParser;
  }
  throw new Error('DOMParser is not available. Ensure you are in a jsdom or browser environment.');
};

const getXMLSerializer = () => {
  if (typeof XMLSerializer !== 'undefined') {
    return XMLSerializer;
  }
  if (typeof globalThis !== 'undefined' && globalThis.XMLSerializer) {
    return globalThis.XMLSerializer;
  }
  if (typeof window !== 'undefined' && window.XMLSerializer) {
    return window.XMLSerializer;
  }
  throw new Error('XMLSerializer is not available. Ensure you are in a jsdom or browser environment.');
};

export function updateRawXml(system, entryId, type, localName, localCosts, localConstraints, localCharacteristics, localDescription, localPublicationId, localPage) {
  if (!system.rawXmls) return;

  let file = system.rawXmls.cat?.find(f => f.content.includes(entryId));
  if (!file) {
    file = system.rawXmls.gst?.find(f => f.content.includes(entryId));
  }
  if (!file) return;

  const DOMParserClass = getDOMParser();
  const parser = new DOMParserClass();
  const doc = parser.parseFromString(file.content, 'text/xml');

  const element = doc.querySelector(`[id="${entryId}"]`);
  if (!element) return;

  if (localName !== undefined) {
    element.setAttribute('name', localName);
  }

  if (localPublicationId !== undefined) {
    if (localPublicationId) {
      element.setAttribute('publicationId', localPublicationId);
    } else {
      element.removeAttribute('publicationId');
    }
  }

  if (localPage !== undefined) {
    if (localPage) {
      element.setAttribute('page', localPage);
    } else {
      element.removeAttribute('page');
    }
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

  const XMLSerializerClass = getXMLSerializer();
  const serializer = new XMLSerializerClass();
  file.content = serializer.serializeToString(doc);
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
