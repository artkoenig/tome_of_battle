import xml.etree.ElementTree as ET

tree = ET.parse('/Users/artkoenig/Workspace/army_builder/catalogs/whfb6/Vampire Counts.cat')
root = tree.getroot()
ns = {'cat': 'http://www.battlescribe.net/schema/catalogueSchema'}

def get_path(element, path=""):
    for child in element:
        name = child.attrib.get('name', '')
        tag = child.tag.split('}')[-1]
        current = f"{path} -> {tag}[{name}]"
        if child.attrib.get('id') == '00bd-d8e5-9feb-0d1c':
            print("Found General at 3139:")
            print(current)
        if child.attrib.get('id') == 'b029-6b8a-cfd8-bdef':
            print("Found General at 2659:")
            print(current)
        get_path(child, current)

get_path(root)
