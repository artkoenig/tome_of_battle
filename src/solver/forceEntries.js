/**
 * Lookup-Helfer für Force Entries (Kontingente/Heeresstrukturen).
 * Force Entries können sowohl in der .gst als auch in einzelnen Katalogen
 * deklariert und beliebig verschachtelt sein.
 */

export function findForceEntryById(system, forceEntryId) {
  if (!system || !forceEntryId) return null;
  if (system.forceEntries) {
    const found = findForceEntryInList(system.forceEntries, forceEntryId);
    if (found) return found;
  }
  if (system.catalogues) {
    for (const cat of system.catalogues) {
      if (cat.forceEntries) {
        const found = findForceEntryInList(cat.forceEntries, forceEntryId);
        if (found) return found;
      }
    }
  }
  return null;
}

function findForceEntryInList(list, id) {
  for (const fe of list) {
    if (fe.id === id) return fe;
    if (fe.forceEntries) {
      const sub = findForceEntryInList(fe.forceEntries, id);
      if (sub) return sub;
    }
  }
  return null;
}

export function getAvailableForceEntries(systemDef, catId) {
  if (!systemDef) return [];
  const entries = [];

  if (systemDef.forceEntries) {
    systemDef.forceEntries.forEach(fe => {
      if (fe.hidden !== true) {
        entries.push(fe);
      }
    });
  }

  if (systemDef.catalogues && catId) {
    const selectedCat = systemDef.catalogues.find(c => c.id === catId);
    if (selectedCat && selectedCat.forceEntries) {
      selectedCat.forceEntries.forEach(fe => {
        if (fe.hidden !== true) {
          entries.push(fe);
        }
      });
    }
  }

  return entries;
}
