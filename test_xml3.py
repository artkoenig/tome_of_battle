import xml.etree.ElementTree as ET

tree = ET.parse('/Users/artkoenig/Workspace/army_builder/catalogs/whfb6/Vampire Counts.cat')
root = tree.getroot()

def get_path(element, path=""):
    for child in element:
        name = child.attrib.get('name', '')
        tag = child.tag.split('}')[-1]
        current = f"{path} -> {tag}[{name}]"
        if name == 'Bloodline' and 'Thrall' in path:
            print("Found Bloodline:", current)
            for c in child.findall('./{*}selectionEntries/{*}selectionEntry', namespaces={'': 'http://www.battlescribe.net/schema/catalogueSchema'}):
                print("  Child:", c.attrib.get('name'))
            print("Looking for General:")
            for g in child.findall('.//{*}entryLink', namespaces={'': 'http://www.battlescribe.net/schema/catalogueSchema'}):
                if g.attrib.get('name') == 'General':
                    # Find the parent of General
                    for parent in child.iter():
                        if g in list(parent):
                            print("  General parent:", parent.tag, parent.attrib.get('name', ''))
        get_path(child, current)

get_path(root)
