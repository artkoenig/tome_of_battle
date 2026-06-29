import os
import re

def main():
    with open('src/components/RosterEditor.jsx', 'r') as f:
        content = f.read()

    # 1. Add imports
    import_statement = "import UnitSelectionCard from './editor/UnitSelectionCard';\nimport CatalogStatBlock from './editor/CatalogStatBlock';\n"
    # Find import SelectionConfigurator and put them after
    content = content.replace(
        "import SelectionConfigurator from './editor/SelectionConfigurator';", 
        "import SelectionConfigurator from './editor/SelectionConfigurator';\n" + import_statement
    )

    # 2. Remove renderMiniProfile and renderUnitUpgrades
    # We can use regex to remove them safely.
    content = re.sub(r'const renderMiniProfile = \(selection\) => \{.*?\n  };\n', '', content, flags=re.DOTALL)
    content = re.sub(r'const renderUnitUpgrades = \(selection\) => \{.*?\n  };\n', '', content, flags=re.DOTALL)

    # 3. Replace CatalogStatBlock
    catalog_stat_block_replacement = """        {/* Selected Catalog Entry Stat Details */}
        <CatalogStatBlock 
          selectedCatalogEntry={selectedCatalogEntry} 
          setSelectedCatalogEntry={setSelectedCatalogEntry} 
        />"""
    # Replace from `{/* Selected Catalog Entry Stat Details */}` to the end of the `selectedCatalogEntry && (` block
    # It ends with `        )}` before `{/* Selected Selections on Roster grouped by category links */}`
    
    content = re.sub(
        r'\{\/\* Selected Catalog Entry Stat Details \*\/}.*?\n        \)\}',
        catalog_stat_block_replacement,
        content,
        flags=re.DOTALL
    )

    # 4. Replace UnitSelectionCard blocks.
    # Block 1 starts with `                            .map(selection => {`
    # and ends with `                              );` \n `                            })}`
    unit_card_jsx = """                              <UnitSelectionCard
                                key={selection.id}
                                selection={selection}
                                selectedRosterSelection={selectedRosterSelection}
                                setSelectedRosterSelection={setSelectedRosterSelection}
                                roster={roster}
                                system={system}
                                validationErrors={validationErrors}
                                costTypeLabel={costTypeLabel}
                                removeUnit={removeUnit}
                                copyUnit={copyUnit}
                                updateSubSelection={updateSubSelection}
                                activeCatalogue={activeCatalogue}
                                setSelectedCatalogEntry={setSelectedCatalogEntry}
                              />"""

    # We need to replace the return (...) inside .map(selection => { ... })
    # Let's replace the inner return (...) with `return ( unit_card_jsx );`
    # We can match `return (\n <div \n key={selection.id} ...`
    
    content = re.sub(
        r'return \(\n\s*<div \n\s*key=\{selection\.id\}.*?SelectionConfigurator.*?</div>\n\s*\);',
        "return (\n" + unit_card_jsx + "\n                            );",
        content,
        flags=re.DOTALL
    )

    # Block 2 (uncategorized selections) starts with `                    {uncategorizedSelections.map(selection => {`
    # It has `return (\n <div key={selection.id} className="selection-node"> ...`
    content = re.sub(
        r'return \(\n\s*<div key=\{selection\.id\} className="selection-node">.*?SelectionConfigurator.*?</div>\n\s*\);',
        "return (\n" + unit_card_jsx + "\n                        );",
        content,
        flags=re.DOTALL
    )

    with open('src/components/RosterEditor.jsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
