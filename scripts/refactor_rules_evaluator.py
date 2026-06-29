import os
import re

def refactor_rules_evaluator():
    with open('src/solver/rulesEvaluator.test.js', 'r') as f:
        content = f.read()

    if "import { test, expect } from 'vitest';" not in content:
        content = "import { test, expect } from 'vitest';\n" + content

    content = content.replace("console.log('--- RUNNING RULES EVALUATOR TESTS ---');", "")
    
    content = re.sub(
        r"const test1Passed = (.*?);\nconsole\.log\('Test 1 - extractModelProfiles: ', test1Passed \? 'PASSED' : 'FAILED'\);",
        r"test('extractModelProfiles', () => {\n  expect(\1).toBe(true);\n});",
        content, flags=re.DOTALL
    )
    
    content = re.sub(
        r"const test2Passed = (.*?);\nconsole\.log\('Test 2 - extractUpgradeProfiles: ', test2Passed \? 'PASSED' : 'FAILED'\);",
        r"test('extractUpgradeProfiles', () => {\n  expect(\1).toBe(true);\n});",
        content, flags=re.DOTALL
    )
    
    content = re.sub(
        r"const test3Passed = (.*?);\nconsole\.log\('Test 3 - hasBlessing: ', test3Passed \? 'PASSED' : 'FAILED'\);",
        r"test('hasBlessing', () => {\n  expect(\1).toBe(true);\n});",
        content, flags=re.DOTALL
    )
    
    content = re.sub(
        r"const test4Passed = (.*?);\nconsole\.log\('Test 4 - getArmourSave: ', test4Passed \? 'PASSED' : `FAILED .*?`\);",
        r"test('getArmourSave', () => {\n  expect(\1).toBe(true);\n});",
        content, flags=re.DOTALL
    )
    
    content = re.sub(
        r"const test5Passed = (.*?);\nconsole\.log\('Test 5 - getWardSave: ', test5Passed \? 'PASSED' : `FAILED .*?`\);",
        r"test('getWardSave', () => {\n  expect(\1).toBe(true);\n});",
        content, flags=re.DOTALL
    )
    
    content = re.sub(r"const allEvaluatorTestsPassed = .*?\nif \(allEvaluatorTestsPassed\) \{.*\} else \{.*?\}\n", "", content, flags=re.DOTALL)
    
    with open('src/solver/rulesEvaluator.test.js', 'w') as f:
        f.write(content)

refactor_rules_evaluator()
