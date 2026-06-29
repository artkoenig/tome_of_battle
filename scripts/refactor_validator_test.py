import os
import re

def refactor_validator():
    with open('src/solver/validator.test.js', 'r') as f:
        content = f.read()

    content = content.replace("console.log('--- RUNNING SOLVER & VALIDATOR TESTS ---');\n", "")

    # Replace tests
    content = re.sub(
        r"console\.log\('Test \d+ - (.*?): ',(.*?) \? 'PASSED' : .*?\);",
        r"test('\1', () => {\n  expect(\2).toBeTruthy();\n});",
        content
    )
    
    # Remove process.exit blocks at the end
    content = re.sub(r"if \(\n.*?\n\) \{\n  console.log\('ALL TESTS SUCCESSFUL!'\);\n  process.exit\(0\);\n\} else \{\n  console.error\('SOME TESTS FAILED.'\);\n  process.exit\(1\);\n\}", "", content, flags=re.DOTALL)
    
    with open('src/solver/validator.test.js', 'w') as f:
        f.write(content)

refactor_validator()
