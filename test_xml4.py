import xml.etree.ElementTree as ET

tree = ET.parse('/Users/artkoenig/Workspace/army_builder/catalogs/whfb6/Vampire Counts.cat')
root = tree.getroot()
ns = {'': 'http://www.battlescribe.net/schema/catalogueSchema'}

for entry in root.findall('.//{*}selectionEntry'):
    if entry.attrib.get('name') == 'Vampire Thrall':
        for child in entry.iter():
            if child.tag.endswith('entryLink') and child.attrib.get('name') == 'General':
                # find path to child
                path = []
                curr = child
                while curr != entry:
                    # find parent
                    for p in entry.iter():
                        if curr in list(p):
                            path.insert(0, p.tag.split('}')[-1] + f"[{p.attrib.get('name', '')}]")
                            curr = p
                            break
                print(" -> ".join(path) + f" -> entryLink[{child.attrib.get('name')}] at line?")

