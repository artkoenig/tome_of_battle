import http from 'node:http';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data');
const LOG_DIR = path.join(__dirname, 'logs');
const CRAWL_SCRIPT = path.join('scripts', 'generate-rules-index.js');
const PORT = process.env.PORT || 3001;

/** Events the server itself contributes to the crawl stream. */
const ServerEvent = {
  LogFile: 'log-file',
  CrawlerError: 'crawler-error',
  RunFinished: 'run-finished',
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

function parseSynonymsText(text) {
  const trimmed = text.trimStart();
  const prefix = 'export const SYNONYMS = ';
  if (!trimmed.startsWith(prefix)) throw new Error('Unexpected synonyms.js format');
  let jsonStr = trimmed.slice(prefix.length).trimEnd();
  if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
  // Convert single-quoted JS object literal to valid JSON
  jsonStr = jsonStr
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']');
  return JSON.parse(jsonStr);
}

function serializeSynonyms(obj) {
  const json = JSON.stringify(obj, null, 2);
  const singleQuoted = json.replace(/"([^"]+)": "([^"]*)"/g, "'$1': '$2'");
  return `export const SYNONYMS = ${singleQuoted};\n`;
}

async function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const method = req.method;

  try {
    if (method === 'GET' && url.pathname === '/api/data') {
      const [rulesIndex, synonymsRaw] = await Promise.all([
        fs.readFile(path.join(DATA_DIR, 'rules-index.json'), 'utf-8'),
        fs.readFile(path.join(DATA_DIR, 'synonyms.js'), 'utf-8'),
      ]);
      return sendJSON(res, 200, {
        rulesIndex: JSON.parse(rulesIndex),
        synonyms: parseSynonymsText(synonymsRaw),
      });
    }

    if (method === 'PUT' && url.pathname === '/api/rules-index') {
      const body = await requestBody(req);
      const data = JSON.parse(body);
      await fs.writeFile(
        path.join(DATA_DIR, 'rules-index.json'),
        JSON.stringify(data, null, 2) + '\n',
        'utf-8',
      );
      return sendJSON(res, 200, { ok: true });
    }

    if (method === 'PUT' && url.pathname === '/api/synonyms') {
      const body = await requestBody(req);
      const data = JSON.parse(body);
      await fs.writeFile(
        path.join(DATA_DIR, 'synonyms.js'),
        serializeSynonyms(data),
        'utf-8',
      );
      return sendJSON(res, 200, { ok: true });
    }

    if (method === 'POST' && url.pathname === '/api/crawl') {
      return streamCrawl(res);
    }

    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: err.message });
  }
}

let crawlRunning = false;

function newLogFilePath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIR, `crawl-${stamp}.log`);
}

/**
 * Runs the crawl script as a child process and forwards its NDJSON event
 * stream to the client while teeing it into a per-run log file. The response
 * stays open for the whole run so the editor can render live progress; a
 * disconnected client never aborts the crawl itself.
 */
async function streamCrawl(res) {
  if (crawlRunning) {
    return sendJSON(res, 409, { error: 'Es läuft bereits ein Crawl.' });
  }
  crawlRunning = true;
  try {
    await runCrawlIntoStream(res);
  } catch (error) {
    crawlRunning = false;
    throw error;
  }
}

function runCrawlIntoStream(res) {
  return fs.mkdir(LOG_DIR, { recursive: true }).then(() => {
    const logPath = newLogFilePath();
    const logStream = createWriteStream(logPath, { encoding: 'utf-8' });

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });

    const writeLine = line => {
      logStream.write(line);
      if (!res.writableEnded) res.write(line);
    };
    const emit = event =>
      writeLine(JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n');

    emit({ type: ServerEvent.LogFile, path: path.relative(PROJECT_ROOT, logPath) });

    const child = spawn('node', [CRAWL_SCRIPT, '--events'], { cwd: PROJECT_ROOT });

    readline.createInterface({ input: child.stdout }).on('line', line => {
      if (!line.trim()) return;
      try {
        JSON.parse(line);
        writeLine(line + '\n');
      } catch {
        emit({ type: ServerEvent.CrawlerError, message: line });
      }
    });

    readline.createInterface({ input: child.stderr }).on('line', line => {
      if (line.trim()) emit({ type: ServerEvent.CrawlerError, message: line });
    });

    child.on('error', error => emit({ type: ServerEvent.CrawlerError, message: error.message }));

    let finished = false;
    const finish = exitCode => {
      if (finished) return;
      finished = true;
      emit({ type: ServerEvent.RunFinished, exitCode, ok: exitCode === 0 });
      logStream.end();
      if (!res.writableEnded) res.end();
      crawlRunning = false;
    };

    child.on('close', finish);
    child.on('error', () => finish(null));
  });
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleAPI(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  🛠  Rules URL Editor\n  ${url}\n`);
});
