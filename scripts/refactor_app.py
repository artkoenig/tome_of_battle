import os
import re

def main():
    with open('src/App.jsx', 'r') as f:
        content = f.read()

    # Imports to add
    import_statement = "import GlobalDebugSearch from './components/editor/GlobalDebugSearch';\nimport NewRosterModal from './components/editor/NewRosterModal';\n"
    content = content.replace(
        "import DebugEntryEditorModal from './components/editor/DebugEntryEditorModal';", 
        "import DebugEntryEditorModal from './components/editor/DebugEntryEditorModal';\n" + import_statement
    )

    # 1. Remove GlobalDebugSearch definition
    content = re.sub(r'function GlobalDebugSearch\(\{ systems, onSelectEntry \}\) \{.*?\n\}\n', '', content, flags=re.DOTALL)

    # 2. Replace the modal JSX block
    # It starts with:
    #      {isModalOpen && (
    #        <div className="modal-overlay">
    # Ends with
    #              </div>
    #            </form>
    #          </div>
    #        </div>
    #      )}
    # Let's match it using a precise regex
    
    modal_replacement = """      <NewRosterModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateRoster}
        systems={systems}
        newRosterName={newRosterName}
        setNewRosterName={setNewRosterName}
        newRosterSystemId={newRosterSystemId}
        handleSystemChange={handleSystemChange}
        newRosterCatId={newRosterCatId}
        setNewRosterCatId={setNewRosterCatId}
        newRosterLimit={newRosterLimit}
        setNewRosterLimit={setNewRosterLimit}
      />"""
      
    content = re.sub(
        r'\{isModalOpen && \(\s*<div className="modal-overlay">.*?<div className="modal-footer">.*?</div>\s*</form>\s*</div>\s*</div>\s*\)\}',
        modal_replacement,
        content,
        flags=re.DOTALL
    )

    with open('src/App.jsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
