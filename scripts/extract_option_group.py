import os

def main():
    with open('src/components/editor/SelectionConfigurator.jsx', 'r') as f:
        lines = f.readlines()

    # findForceOfSelection: lines 13 to 29 (index 13-29)
    # OptionGroupComponent: lines 347 to end (index 347-)
    
    # Imports for OptionGroup
    option_group_imports = """import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus, Info } from 'lucide-react';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost } from '../../solver/validator';
import { isUniqueOptionTakenElsewhere } from '../../solver/optionsCollector';
import { useDebugMode } from '../../hooks/DebugContext';

"""
    find_force_code = "".join(lines[13:30]) + "\n"
    option_group_code = "".join(lines[347:])

    # Remove isUniqueOptionTakenElsewhere from option_group_code
    # It starts at "  const isUniqueOptionTakenElsewhere = (targetRes) => {"
    # And ends at "  };\n" before "  const filteredGroupConstraints ="
    
    with open('src/components/editor/OptionGroup.jsx', 'w') as f:
        f.write(option_group_imports)
        f.write(find_force_code)
        
        og_lines = lines[347:]
        # Remove lines 386 to 412 (isUniqueOptionTakenElsewhere logic)
        og_lines_filtered = og_lines[:386-347] + og_lines[413-347:]
        f.write("export default ")
        f.writelines(og_lines_filtered)

    # For SelectionConfigurator.jsx
    configurator_imports = lines[:13]
    # add import OptionGroupComponent from './OptionGroup';
    configurator_imports.insert(5, "import OptionGroupComponent from './OptionGroup';\n")
    
    configurator_body = lines[30:347]
    
    with open('src/components/editor/SelectionConfigurator.jsx', 'w') as f:
        f.writelines(configurator_imports)
        f.writelines(configurator_body)

if __name__ == '__main__':
    main()
