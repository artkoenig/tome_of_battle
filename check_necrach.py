import xml.etree.ElementTree as ET

tree = ET.parse('/Users/artkoenig/Workspace/army_builder/catalogs/whfb6/Vampire Counts.cat')
root = tree.getroot()

for entry in root.findall('.//{*}selectionEntry'):
    if entry.attrib.get('name') == 'Necrach' and entry.attrib.get('id') == 'bb37-616b-6963-09b8':
        print("Necrach direct children:")
        for child in entry:
            print("  -", child.tag.split('}')[-1])
