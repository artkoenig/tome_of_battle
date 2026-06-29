import os
import re

def refactor_parser():
    with open('src/solver/parser.test.js', 'r') as f:
        content = f.read()

    if "import { test, expect } from 'vitest';" not in content:
        content = "import { test, expect } from 'vitest';\n" + content

    content = content.replace("let testsPassed = 0;\nlet testsFailed = 0;\n", "")
    content = re.sub(r"function assert.*?}\n", "", content, flags=re.DOTALL)
    content = content.replace("console.log('--- RUNNING PARSER AND ZIP EXTRACTOR TESTS ---');\n", "")
    content = re.sub(r"console.log\(`\\nResults: .*?}\n\)\(\);\n", "});\n", content, flags=re.DOTALL)
    
    # Replace IIFEs
    content = re.sub(
        r"// Test 1: parseGameSystemXML\n\(function testParseGameSystem\(\) \{(.*?)\}\)\(\);",
        r"test('parseGameSystemXML', () => {\1});",
        content, flags=re.DOTALL
    )
    content = re.sub(
        r"// Test 2: parseCatalogueXML\n\(function testParseCatalogue\(\) \{(.*?)\}\)\(\);",
        r"test('parseCatalogueXML', () => {\1});",
        content, flags=re.DOTALL
    )
    content = re.sub(
        r"// Test 3: XML parser error handling for invalid root element\n\(function testParseInvalidXml\(\) \{(.*?)\}\)\(\);",
        r"test('XML parser error handling for invalid root element', () => {\1});",
        content, flags=re.DOTALL
    )
    # The last one might have been chopped by the console.log removal, let's just do a specific replace
    content = re.sub(
        r"// Test 4: ZIP Extraction via extractZipFiles and processImportedData\n\(async function testZipExtractionAndProcessing\(\) \{",
        r"test('ZIP Extraction via extractZipFiles and processImportedData', async () => {",
        content, flags=re.DOTALL
    )
    # The end of the async function:
    #   console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);
    #   ...
    # })();
    # We replaced it with "});\n" above, let's ensure it matches.

    # Replace asserts
    content = re.sub(
        r"assert\((.*?) === (.*?), '(.*?)'\);",
        r"expect(\1).toBe(\2);",
        content
    )
    content = re.sub(
        r"assert\((.*?)\.includes\((.*?)\), '(.*?)'\);",
        r"expect(\1).toContain(\2);",
        content
    )
    # assert(false, `testParseGameSystem threw: ${e.message}`);
    content = re.sub(
        r"assert\(false, `(.*?)`\);",
        r"expect.fail(`\1`);",
        content
    )
    content = re.sub(
        r"assert\(false, '(.*?)'\);",
        r"expect.fail('\1');",
        content
    )

    with open('src/solver/parser.test.js', 'w') as f:
        f.write(content)

refactor_parser()
