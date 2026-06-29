import os
import re

def main():
    with open('src/components/PlayMode.jsx', 'r') as f:
        content = f.read()

    # 1. Add imports
    content = content.replace(
        "import BottomSheet from './editor/BottomSheet';",
        "import BottomSheet from './editor/BottomSheet';\nimport usePlayState from '../hooks/usePlayState';\nimport PlayUnitDetails from './play/PlayUnitDetails';"
    )

    # 2. Replace state and helpers
    state_and_helpers_start = r"  const \[roster, setRoster\] = useState\(initialRoster\);"
    state_and_helpers_end = r"  const getGroupedAndSortedSelections = \(\) => \{"
    
    # We will replace all the state and helper functions with the hook call
    replacement = """  const [roster, setRoster] = useState(initialRoster);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSummaryOpen, setSaveSummaryOpen] = useState(false);
  const [saveSummaryData, setSaveSummaryData] = useState({ title: '', breakdown: [] });
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, title: '', content: [] });

  const { gameState, adjustTracker, getUnitCurrentWounds, handleAdjustWound } = usePlayState(initialRoster, setRoster, saveRoster);

  const handleMouseEnter = (e, title, content) => {
    if (window.innerWidth <= 900 || content.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipState({
      visible: true,
      x: rect.left,
      y: rect.bottom + 8,
      title,
      content
    });
  };

  const handleMouseLeave = () => {
    setTooltipState(s => ({ ...s, visible: false }));
  };

  const getGroupedAndSortedSelections = () => {"""

    # Because there's a lot of code, we will find indices instead of using full regex.
    start_idx = content.find("  const [roster, setRoster] = useState(initialRoster);")
    end_idx = content.find("  // Filter and group roster selections based on search query and categories\n  const getGroupedAndSortedSelections = () => {")
    
    if start_idx != -1 and end_idx != -1:
        content = content[:start_idx] + replacement + content[end_idx + len("  const getGroupedAndSortedSelections = () => {"):]

    # 3. Replace the inner mapping
    jsx_start = content.find("              {group.selections.map(selection => {")
    jsx_end = content.find("            </div>\n          </div>\n        ))}")
    
    if jsx_start != -1 and jsx_end != -1:
        jsx_replacement = """              {group.selections.map(selection => (
                <PlayUnitDetails
                  key={selection.id}
                  selection={selection}
                  system={system}
                  roster={roster}
                  showDebugIds={showDebugIds}
                  gameState={gameState}
                  handleAdjustWound={handleAdjustWound}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setSaveSummaryData={setSaveSummaryData}
                  setSaveSummaryOpen={setSaveSummaryOpen}
                />
              ))}
"""
        content = content[:jsx_start] + jsx_replacement + content[jsx_end:]

    # Remove unused imports
    content = content.replace("import { MODEL_COUNT_PROFILE_TYPES } from '../solver/constants';\n", "")
    content = content.replace("import {\n  getArmourSave as getArmourSaveLogic,\n  getWardSave as getWardSaveLogic,\n  extractModelProfiles,\n  extractUpgradeProfiles,\n  hasBlessing\n} from '../solver/rulesEvaluator';\n", "")

    with open('src/components/PlayMode.jsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
