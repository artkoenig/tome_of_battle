import os
import re

def refactor_options_collector():
    with open('src/solver/optionsCollector.test.js', 'r') as f:
        content = f.read()

    if "import { test, expect } from 'vitest';" not in content:
        content = "import { test, expect } from 'vitest';\n" + content

    content = content.replace("let testsPassed = 0;\nlet testsFailed = 0;\n", "")
    content = re.sub(r"function assert.*?}\n", "", content, flags=re.DOTALL)
    content = content.replace("console.log('--- RUNNING OPTIONS COLLECTOR TESTS ---');\n", "")
    content = re.sub(r"console.log\(`\\nResults: .*?}\n", "", content, flags=re.DOTALL)
    
    # Replace the IIFEs with test blocks
    content = re.sub(
        r"// Test 1: .*?\n\(function testUnselectedUpgrade\(\) \{(.*?)\}\)\(\);",
        r"test('should return top-level options but not recurse into unselected upgrades', () => {\1});",
        content, flags=re.DOTALL
    )
    content = re.sub(
        r"// Test 2: .*?\n\(function testSelectedUpgrade\(\) \{(.*?)\}\)\(\);",
        r"test('should return nested options if their parent is selected', () => {\1});",
        content, flags=re.DOTALL
    )
    content = re.sub(
        r"// Test 3: .*?\n\(function testSelectionEntryGroup\(\) \{(.*?)\}\)\(\);",
        r"test('should recurse into entryLinks of type selectionEntryGroup', () => {\1});",
        content, flags=re.DOTALL
    )

    # Replace assert(...) with expect(...)
    content = re.sub(
        r"assert\((.*?) !== undefined, '(.*?)'\);",
        r"expect(\1).toBeDefined();",
        content
    )
    content = re.sub(
        r"assert\((.*?) === undefined, '(.*?)'\);",
        r"expect(\1).toBeUndefined();",
        content
    )
    content = re.sub(
        r"assert\((.*?) === '(.*?)', '(.*?)'\);",
        r"expect(\1).toBe('\2');",
        content
    )
    content = re.sub(
        r"assert\((.*?), '(.*?)'\);",
        r"expect(\1).toBeTruthy();",
        content
    )

    with open('src/solver/optionsCollector.test.js', 'w') as f:
        f.write(content)

refactor_options_collector()
