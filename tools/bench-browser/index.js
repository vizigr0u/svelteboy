import { createServer } from 'node:http';
import { readFile, access, mkdir, copyFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.wasm': 'application/wasm',
  '.bin':  'application/octet-stream',
  '.gb':   'application/octet-stream',
  '.gbc':  'application/octet-stream',
};

const root = resolve(new URL('.', import.meta.url).pathname, '../..');
const libsDir = resolve(new URL('.', import.meta.url).pathname, 'lib');

// On Linux, try to ensure libasound.so.2 is available for Firefox
async function ensureLinuxLibs() {
  if (process.platform !== 'linux') return;
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';

  // Check if libasound is already resolvable
  try { execSync('ldconfig -p | grep libasound.so.2', { stdio: 'pipe' }); return; } catch {}

  // Check if already extracted
  const soPath = resolve(libsDir, 'libasound.so.2');
  try { await access(soPath); process.env.LD_LIBRARY_PATH = libsDir + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''); return; } catch {}

  // Try to extract from .deb in project root
  const benchDir = resolve(new URL('.', import.meta.url).pathname);
  const debGlob = execSync(`ls "${benchDir}"/libasound*.deb 2>/dev/null || true`, { encoding: 'utf8' }).trim();
  if (!debGlob) { process.stderr.write('[bench] libasound.so.2 not found; Firefox may fail to launch\n'); return; }

  const deb = debGlob.split('\n')[0];
  await mkdir(libsDir, { recursive: true });
  const tmpDir = resolve(libsDir, '_extract');
  await mkdir(tmpDir, { recursive: true });
  execSync(`dpkg -x "${deb}" "${tmpDir}"`, { stdio: 'pipe' });
  const soSrc = execSync(`find "${tmpDir}" -name "libasound.so.2*" -not -type l | head -1`, { encoding: 'utf8' }).trim();
  if (soSrc) {
    await copyFile(soSrc, soPath);
    process.env.LD_LIBRARY_PATH = libsDir + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
  }
}

function startServer() {
  return new Promise((res, rej) => {
    const server = createServer(async (req, rsp) => {
      const pathname = req.url.split('?')[0];
      const dec = s => decodeURIComponent(s);
      let filePath;
      if (pathname.startsWith('/build/')) {
        filePath = resolve(root, 'build', dec(pathname.slice('/build/'.length)));
      } else if (pathname.startsWith('/roms/')) {
        filePath = resolve(root, 'roms', dec(pathname.slice('/roms/'.length)));
      } else if (pathname.startsWith('/tools/')) {
        filePath = resolve(root, dec(pathname.slice(1)));
      } else {
        rsp.writeHead(404); rsp.end('not found'); return;
      }
      try {
        const data = await readFile(filePath);
        const mime = MIME[extname(filePath)] || 'application/octet-stream';
        rsp.writeHead(200, { 'Content-Type': mime });
        rsp.end(data);
      } catch {
        rsp.writeHead(404); rsp.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
    server.on('error', rej);
  });
}

const args = process.argv.slice(2);
const browserFlag = args.indexOf('--browser');
const browserName = browserFlag >= 0 ? args[browserFlag + 1] : 'firefox';
const romArgs = browserFlag >= 0
  ? args.filter((_, i) => i !== browserFlag && i !== browserFlag + 1)
  : args;

if (romArgs.length < 2) {
  console.error('usage: index.js <bootfile> <romfile> [--browser firefox|chromium|webkit]');
  process.exit(1);
}

const bootPath = romArgs[0];
const romPath  = romArgs[1];

const browsers = { chromium, firefox, webkit };
const BrowserType = browsers[browserName];
if (!BrowserType) {
  console.error(`unknown browser: ${browserName}. Use firefox, chromium, or webkit.`);
  process.exit(1);
}

await ensureLinuxLibs();

const { server, port } = await startServer();
const browser = await BrowserType.launch();
const page = await browser.newPage();

page.on('console', msg => {
  const type = msg.type();
  if (type === 'error' || type === 'warning') process.stderr.write(`[browser:${type}] ${msg.text()}\n`);
  else process.stdout.write(`[browser] ${msg.text()}\n`);
});
page.on('pageerror', err => process.stderr.write(`[browser:pageerror] ${err.message}\n`));

const bootParam = `/roms/${bootPath.replace(/^roms\//, '')}`;
const romParam  = `/roms/${romPath.replace(/^roms\//, '')}`;
const url = `http://127.0.0.1:${port}/tools/bench-browser/bench.html?boot=${encodeURIComponent(bootParam)}&rom=${encodeURIComponent(romParam)}`;

await page.goto(url, { waitUntil: 'domcontentloaded' });

const result = await page.waitForFunction(
  () => window.__benchResult || window.__benchError,
  null,
  { timeout: 300_000 }
);

const value = await result.jsonValue();
await browser.close();
server.close();

if (typeof value === 'string') {
  console.error('Benchmark error:', value);
  process.exit(1);
}

console.log(`Avg: ${value.avg}, Low: ${value.low}, High: ${value.high}`);
