#!/usr/bin/env node
// Regenerates docs/screenshots/ against synthetic data: a throwaway history file
// (Tools/make-demo-history.js) and canned model output (Tools/fake-claude.js), so no Claude
// login is needed and nothing from a real history.json can end up in an image.
// Drives headless Chrome over the DevTools protocol at 2x, 800 CSS px wide -> 1600 px PNGs.
//   node Tools/screenshots.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/screenshots');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_PORT = 3466, CDP_PORT = 9333; // not 3456, so a running Prompt Forge is left alone
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmp = mkdtempSync(join(tmpdir(), 'forge-shots-'));
const hist = join(tmp, 'history.json');
execFileSync('node', [join(ROOT, 'Tools/make-demo-history.js'), hist]);
const env = { ...process.env, FORGE_PORT: String(APP_PORT), FORGE_HISTORY: hist, FORGE_CLAUDE: join(ROOT, 'Tools/fake-claude.js'), FAKE_CLAUDE_DELAY: '1500' };
const server = spawn('node', [join(ROOT, 'app.js')], { env, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${join(tmp, 'chrome')}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

async function waitFor(fn, what, ms = 15000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(150)) { try { const v = await fn(); if (v) return v; } catch {} }
  throw new Error(`timed out waiting for ${what}`);
}

try {
  const page = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((t) => t.type === 'page'), 'chrome');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  const until = (expr, what) => waitFor(() => js(expr), what);
  const theme = (scheme) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  const size = (height) => send('Emulation.setDeviceMetricsOverride', { width: 800, height, deviceScaleFactor: 2, mobile: false });
  async function shot(name) {
    await js(`window.scrollTo(0, 0)`); await sleep(500);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
    console.log('wrote', name);
  }

  await waitFor(async () => (await fetch(`http://127.0.0.1:${APP_PORT}/`)).ok, 'app');
  await send('Page.enable');
  await theme('light'); await size(620);
  await send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/` });
  await until(`document.readyState === 'complete'`, 'page load');
  await js(`document.getElementById('task').value = 'a command line tool that renames my photos by the date they were taken'`);
  await shot('home.png');

  await size(1250);
  await js(`document.getElementById('go').click()`);
  await until(`!document.getElementById('qs').hidden`, 'questions');
  await js(`[...document.querySelectorAll('#qlist fieldset')].forEach((f, i) => f.querySelectorAll('input')[i === 3 ? 0 : 1].click())`);
  await shot('questions.png');

  await theme('dark'); await size(620);
  await js(`document.getElementById('buildBtn').click()`);
  await until(`document.querySelector('#stages li.now')?.dataset.s === 'critique'`, 'critic stage');
  await shot('forging.png');

  await size(1500);
  await until(`!document.getElementById('result').hidden`, 'result');
  await shot('result.png');

  await theme('light'); await size(760);
  await send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/` });
  await until(`document.readyState === 'complete'`, 'reload');
  await js(`document.getElementById('histBtn').click()`);
  await until(`document.querySelectorAll('#histList li').length > 1`, 'history');
  await shot('history.png');
  ws.close();
} finally {
  chrome.kill(); server.kill();
  await sleep(300);
  rmSync(tmp, { recursive: true, force: true });
}
