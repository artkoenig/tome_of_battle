import os

def main():
    with open('src/solver/validator.js', 'r') as f:
        lines = f.readlines()

    # Find the boundaries based on known line numbers
    catalogResolver = lines[0:144]
    modifierEvaluator = lines[260:353]
    rosterCounter1 = lines[146:259]
    rosterCounter2 = lines[354:418]
    validator = lines[422:]

    # Add imports to rosterCounter.js
    rosterCounter_imports = "import { findEntryInSystem, resolveEntry } from './catalogResolver.js';\n\n"
    
    with open('src/solver/catalogResolver.js', 'w') as f:
        f.writelines(catalogResolver)

    with open('src/solver/modifierEvaluator.js', 'w') as f:
        f.writelines(modifierEvaluator)

    with open('src/solver/rosterCounter.js', 'w') as f:
        f.write(rosterCounter_imports)
        f.writelines(rosterCounter1)
        f.write("\n")
        f.writelines(rosterCounter2)

    # Now for validator.js
    validator_imports = """import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue } from './modifierEvaluator.js';
import { getOptionDisplayCost, getSelectionTotalCost, calculateRosterCosts, computeRosterCounts } from './rosterCounter.js';

export { findEntryInSystem, resolveEntry } from './catalogResolver.js';
export { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue } from './modifierEvaluator.js';
export { getOptionDisplayCost, getSelectionTotalCost, calculateRosterCosts, computeRosterCounts } from './rosterCounter.js';

"""
    with open('src/solver/validator.js', 'w') as f:
        f.write(validator_imports)
        f.writelines(validator)

if __name__ == '__main__':
    main()
