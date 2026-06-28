# Custom Agent Rules - Tome of Battle

## Browser Debugging and Automation Guidelines

Depending on the execution environment, you **MUST** select the correct method for browser automation, UI testing, and IndexedDB inspections:

### 1. Local Environment (macOS)
* **DO NOT** use the native `browser_subagent` or `open_browser_url` tools, as the Antigravity local Chrome mode is only supported on Linux and will fail on macOS.
* **INSTEAD**, write custom Node.js automation scripts inside the `src/solver/` directory using `puppeteer`:
  ```javascript
  import puppeteer from 'puppeteer';
  const browser = await puppeteer.launch({ headless: true });
  ```
* Run these scripts directly in the terminal via `run_command` (e.g., `node src/solver/my_test.js`) to interact with the local dev server and output database dumps, screenshots, or logs.

### 2. Cloud Environment (Linux)
* **DO** use the native `/browser` slash command and `browser_subagent` tool for automated browser tests, as the cloud runner provides a fully supported headless Chrome service.

## Git Push Guidelines
* **DO NOT** push commits automatically to the remote repository.
* When working locally, only make **local commits** to the git branch.
* Always wait for the user's **explicit approval** before executing a `git push` command.

## Testing Guidelines
* Every change to the business logic (e.g. parsing, XML import, cost calculations, constraint validation, resolving, etc.) **MUST** be accompanied by a corresponding unit test.
* All unit tests **MUST** pass successfully before compiling or completing a task.
