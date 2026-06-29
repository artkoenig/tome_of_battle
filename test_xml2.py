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
            for c in child.findall('.//{*}selectionEntry'):
                print("  Child:", c.attrib.get('name'))
        get_path(child, current)

get_path(root)
