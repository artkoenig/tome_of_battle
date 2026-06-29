export const evaluateCondition = (cond, roster, selectionCounts, forceCategoryCounts) => {
  if (!cond) return false;
  let currentValue = 0;
  if (cond.field && cond.field.startsWith('limit::')) {
    currentValue = roster.costLimit || 0;
  } else if (cond.field) {
    let categoryTotal = 0;
    if (forceCategoryCounts) {
      Object.values(forceCategoryCounts).forEach(forceCounts => {
        if (forceCounts[cond.field]) categoryTotal += forceCounts[cond.field];
      });
    }
    currentValue = selectionCounts[cond.field] || categoryTotal || 0;
  }
  const targetValue = cond.value;

  switch (cond.type) {
    case 'equalTo':
      return currentValue === targetValue;
    case 'lessThan':
      return currentValue < targetValue;
    case 'greaterThan':
      return currentValue > targetValue;
    case 'notEqualTo':
      return currentValue !== targetValue;
    case 'lessThanOrEqualTo':
      return currentValue <= targetValue;
    case 'greaterThanOrEqualTo':
      return currentValue >= targetValue;
    default:
      return false;
  }
};

export const evaluateConditionGroup = (group, roster, selectionCounts, forceCategoryCounts) => {
  if (!group) return true;
  const condResults = group.conditions?.map(c => evaluateCondition(c, roster, selectionCounts, forceCategoryCounts)) || [];
  const groupResults = group.conditionGroups?.map(g => evaluateConditionGroup(g, roster, selectionCounts, forceCategoryCounts)) || [];
  
  const allResults = [...condResults, ...groupResults];
  if (allResults.length === 0) return true;

  if (group.type === 'or') {
    return allResults.some(r => r);
  } else if (group.type === 'not') {
    return !allResults.every(r => r);
  } else {
    return allResults.every(r => r);
  }
};

export const getModifiedConstraintValue = (con, modifiers, roster, selectionCounts, forceCategoryCounts) => {
  let finalValue = con.value;

  const sortedModifiers = [...(modifiers || [])].sort((a, b) => {
    if (a.type === 'set' && b.type !== 'set') return -1;
    if (a.type !== 'set' && b.type === 'set') return 1;
    return 0;
  });

  sortedModifiers.forEach(mod => {
    if (mod.field !== con.id) return;

    const condsPass = mod.conditions?.every(c => evaluateCondition(c, roster, selectionCounts, forceCategoryCounts)) !== false;
    const groupsPass = mod.conditionGroups?.every(g => evaluateConditionGroup(g, roster, selectionCounts, forceCategoryCounts)) !== false;

    if (condsPass && groupsPass) {
      let modAmount = mod.valueObject;

      if (mod.repeat) {
        let currentValue = 0;
        if (mod.repeat.field && mod.repeat.field.startsWith('limit::')) {
          currentValue = roster.costLimit || 0;
        } else if (mod.repeat.field) {
          currentValue = selectionCounts[mod.repeat.field] || forceCategoryCounts[mod.repeat.field] || 0;
        }

        const repVal = mod.repeat.value ? Math.floor(currentValue / mod.repeat.value) : 0;
        modAmount = mod.valueObject * repVal * (mod.repeat.repeats || 1);
      }

      if (mod.type === 'set') {
        finalValue = modAmount;
      } else if (mod.type === 'increment') {
        finalValue += modAmount;
      } else if (mod.type === 'decrement') {
        finalValue -= modAmount;
      }
    }
  });

  return finalValue;
};
