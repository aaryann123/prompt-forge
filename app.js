#!/usr/bin/env node
// Prompt Forge — local web UI over the ./forge pipeline (questions → build). Run: node app.js → http://localhost:3456
// ponytail: node stdlib only, single file, forge does the claude calls.
const http = require('http');
const fs = require('fs');
const path = require('path');
const forge = require('./forge');

// History: one JSON file next to the app, newest first.
const HIST = process.env.FORGE_HISTORY || path.join(__dirname, 'history.json');
function loadHist() {
  try { return JSON.parse(fs.readFileSync(HIST, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; } // unreadable file: fail loudly, never overwrite it with []
}
function saveHist(h) {
  // ponytail: whole-file rewrite, capped at 200; move to sqlite if it ever needs search or grows past that.
  fs.writeFileSync(HIST + '.tmp', JSON.stringify(h.slice(0, 200), null, 1));
  fs.renameSync(HIST + '.tmp', HIST); // atomic swap so a crash mid-write cannot corrupt history
}

const PORT = Number(process.env.FORGE_PORT) || 3456;

const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prompt Forge</title>
<style>
  /* Follows the system light/dark setting. Cool steel neutrals, one copper accent. */
  :root {
    color-scheme: light dark;
    --bg: light-dark(oklch(0.965 0.005 240), oklch(0.235 0.012 250));
    --surface: light-dark(oklch(0.995 0.002 240), oklch(0.278 0.014 250));
    --surface-2: light-dark(oklch(0.94 0.007 240), oklch(0.315 0.015 250));
    --border: light-dark(oklch(0.85 0.01 240), oklch(0.39 0.016 250));
    --ink: light-dark(oklch(0.24 0.015 250), oklch(0.95 0.005 240));
    --muted: light-dark(oklch(0.45 0.018 250), oklch(0.79 0.012 240));
    --accent: light-dark(oklch(0.55 0.13 50), oklch(0.77 0.12 62));
    --accent-hover: light-dark(oklch(0.5 0.13 50), oklch(0.82 0.12 62));
    --accent-ink: light-dark(oklch(0.99 0.005 60), oklch(0.2 0.03 50));
    --accent-wash: color-mix(in oklab, var(--accent) 12%, var(--surface));
    --danger: light-dark(oklch(0.5 0.17 25), oklch(0.8 0.11 25));
    --radius: 12px;
    --ease: cubic-bezier(.16, 1, .3, 1);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  ::selection { background: color-mix(in oklch, var(--accent) 30%, transparent); }
  html { scrollbar-color: var(--border) transparent; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 720px; margin: 0 auto; padding: 2.75rem 1.5rem 5rem; }

  header { display: flex; align-items: center; gap: .6rem; margin-bottom: 1.5rem; }
  header svg { width: 18px; height: 18px; color: var(--accent); flex: none; }
  h1 { font-size: 1.05rem; font-weight: 650; letter-spacing: -0.01em; margin: 0; }
  .tag { color: var(--muted); font-size: .9rem; margin: 0 0 0 .35rem; }

  .panel {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; box-shadow: 0 1px 2px oklch(0 0 0 / .05), 0 8px 24px -12px oklch(0 0 0 / .18);
    transition: border-color .2s var(--ease);
  }
  .panel:focus-within { border-color: var(--accent); }
  textarea {
    display: block; width: 100%; min-height: 7.5rem; resize: vertical;
    background: transparent; color: var(--ink); border: 0; outline: 0;
    font: inherit; font-size: 1.06rem; padding: 1.1rem 1.2rem; caret-color: var(--accent);
  }
  ::placeholder { color: var(--muted); opacity: 1; }

  .actions {
    display: flex; align-items: center; gap: 1rem;
    padding: .7rem .8rem; border-top: 1px solid var(--border); background: var(--surface-2);
  }
  button {
    font: inherit; font-size: .95rem; font-weight: 600; cursor: pointer;
    border: 0; border-radius: 8px; padding: .5rem 1.1rem;
    background: var(--accent); color: var(--accent-ink);
    transition: background .15s var(--ease), transform .12s var(--ease);
  }
  button:hover { background: var(--accent-hover); }
  button:active { transform: scale(.98); }
  button:disabled { opacity: .5; cursor: default; transform: none; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  textarea:focus-visible { outline: 0; } /* the panel border carries focus */
  kbd {
    font: 600 .72rem/1 inherit; opacity: .75; margin-left: .5rem;
    border: 1px solid currentColor; border-radius: 4px; padding: .12rem .32rem;
  }
  #status { color: var(--muted); font-size: .92rem; font-variant-numeric: tabular-nums; }
  #status.error { color: var(--danger); }

  .bar { height: 2px; background: var(--border); overflow: hidden; display: none; }
  .bar.on { display: block; }
  .bar i {
    display: block; height: 100%; width: 35%; background: var(--accent);
    animation: slide 1.4s cubic-bezier(.4,0,.6,1) infinite;
  }
  @keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(310%); } }

  /* the three agents, shown while the build runs */
  #stages { list-style: none; margin: 1.75rem 0 0; padding: 0; display: grid; gap: .15rem; }
  #stages li { display: flex; gap: .8rem; align-items: baseline; padding: .45rem .2rem; color: var(--muted); }
  #stages li::before {
    content: ""; width: .55rem; height: .55rem; border-radius: 50%; flex: none;
    border: 1.5px solid var(--border); transform: translateY(-.05rem);
  }
  #stages li.done::before { background: var(--accent); border-color: var(--accent); }
  #stages li.now { color: var(--ink); font-weight: 600; }
  #stages li.now::before { border-color: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
  #stages small { font-size: .88rem; font-weight: 400; color: var(--muted); }
  @keyframes pulse { 50% { background: var(--accent); } }

  #qs { margin-top: 1.75rem; }
  .hint { color: var(--muted); font-size: .95rem; margin: 0 0 1.25rem; max-width: 60ch; }
  fieldset { border: 0; margin: 0 0 1.6rem; padding: 0; min-width: 0; }
  legend { font-weight: 650; font-size: 1.02rem; padding: 0; margin-bottom: .6rem; text-wrap: balance; }
  .opts { display: grid; gap: .4rem; }
  .opts label {
    display: flex; gap: .7rem; align-items: baseline; cursor: pointer;
    padding: .6rem .85rem; border: 1px solid var(--border); border-radius: 9px; background: var(--surface);
    transition: border-color .15s var(--ease), background .15s var(--ease);
  }
  .opts label:hover { border-color: var(--muted); }
  .opts label:has(:checked) { border-color: var(--accent); background: var(--accent-wash); }
  .opts label:has(:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
  input[type=radio] { accent-color: var(--accent); margin: 0; transform: translateY(.1rem); outline: 0; }
  #extra {
    display: block; width: 100%; margin: 0 0 1.25rem; padding: .7rem .95rem; font: inherit;
    color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
    caret-color: var(--accent);
  }

  .ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  .ghost:hover { background: var(--surface-2); color: var(--ink); }
  #histBtn { margin-left: auto; font-size: .88rem; padding: .35rem .8rem; }
  #histBtn[aria-expanded=true] { color: var(--ink); border-color: var(--muted); }

  #hist { margin-top: 1.75rem; }
  #histList { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
  #histList li { display: flex; gap: .4rem; align-items: stretch; }
  .open {
    flex: 1; min-width: 0; text-align: left; display: flex; gap: 1rem; align-items: baseline;
    background: var(--surface); color: var(--ink); border: 1px solid var(--border); font-weight: 500;
    padding: .65rem .9rem; border-radius: 9px;
  }
  .open:hover { background: var(--surface); border-color: var(--accent); }
  .open span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .open time { color: var(--muted); font-size: .85rem; font-weight: 400; font-variant-numeric: tabular-nums; flex: none; }
  .rm { font-size: .85rem; padding: .35rem .7rem; }
  .rm.sure { color: var(--danger); border-color: var(--danger); }

  #result { margin-top: 2rem; }
  .btns { display: flex; gap: .5rem; }
  #editor {
    min-height: 60vh; field-sizing: content; resize: vertical; border: 1px solid var(--accent); border-radius: var(--radius);
    background: var(--surface); padding: 1.4rem 1.6rem; font-size: 1rem; line-height: 1.6;
  }
  .result-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .7rem; }
  .result-head h2 { font-size: .95rem; font-weight: 650; margin: 0; }
  #copy { background: var(--ink); color: var(--bg); }
  #copy:hover { background: var(--ink); opacity: .88; }
  #copy.done { background: var(--accent); color: var(--accent-ink); opacity: 1; }

  /* the forged prompt, set as a readable document rather than a code dump */
  .doc {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 1.6rem 1.8rem 1.8rem; overflow-wrap: break-word;
    box-shadow: 0 1px 2px oklch(0 0 0 / .05), 0 8px 24px -12px oklch(0 0 0 / .18);
  }
  .doc > * { max-width: 68ch; }
  .doc > :first-child { margin-top: 0; } .doc > :last-child { margin-bottom: 0; }
  .doc h2 { font-size: 1.3rem; line-height: 1.25; letter-spacing: -0.015em; margin: 0 0 1rem; text-wrap: balance; }
  .doc h3 { font-size: 1.04rem; margin: 1.9rem 0 .5rem; color: var(--accent); font-weight: 650; }
  .doc p { margin: 0 0 .85rem; }
  .doc ul, .doc ol { margin: 0 0 .95rem; padding-left: 1.3rem; }
  .doc li { margin-bottom: .4rem; } .doc li::marker { color: var(--muted); }
  .doc code, .doc pre { font: .88em/1.5 ui-monospace, "SF Mono", Menlo, monospace; background: var(--surface-2); border-radius: 5px; }
  .doc code { padding: .1em .35em; }
  .doc pre { padding: .8rem 1rem; white-space: pre-wrap; margin: 0 0 .95rem; }

  #result.reveal { animation: rise .5s var(--ease); }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); filter: blur(4px); } }
  @media (prefers-reduced-motion: reduce) {
    #result.reveal, #stages li.now::before { animation: none; }
    #stages li.now::before { background: var(--accent); }
    .bar i { animation: none; width: 100%; opacity: .5; }
    button, .panel, .opts label { transition: none; }
  }
</style>
<main>
  <header>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 2 2 12 12 22Z" fill="currentColor"/></svg>
    <h1>Prompt Forge</h1>
    <p class="tag">rough idea in, strong prompt out</p>
    <button id="histBtn" class="ghost" aria-expanded="false" aria-controls="hist">History</button>
  </header>

  <div class="panel">
    <textarea id="task" placeholder="What do you want built or done? A rough sentence is enough." autofocus></textarea>
    <div class="bar" id="bar"><i></i></div>
    <div class="actions">
      <button id="go">Forge<kbd>⌘↩</kbd></button>
      <span id="status" role="status"></span>
    </div>
  </div>

  <section id="hist" hidden>
    <ul id="histList"></ul>
    <p class="hint" id="histEmpty" hidden>Nothing forged yet. Every prompt you build is kept here.</p>
  </section>

  <ol id="stages" hidden>
    <li data-s="draft">Drafter <small>writes the prompt from your idea and answers</small></li>
    <li data-s="critique">Critic <small>reads it cold, the way Claude will</small></li>
    <li data-s="revise">Drafter <small>fixes what the critic found</small></li>
  </ol>

  <form id="qs" hidden>
    <p class="hint">A few gaps worth closing. Skip any you like; skipped ones become labelled assumptions you can edit.</p>
    <div id="qlist"></div>
    <input id="extra" type="text" placeholder="Anything else it should know? (optional)">
    <button id="buildBtn">Build prompt</button>
  </form>

  <section id="result" hidden>
    <div class="result-head"><h2>Your prompt</h2>
      <div class="btns"><button id="edit" class="ghost">Edit</button><button id="copy">Copy</button></div></div>
    <div class="doc" id="out"></div>
    <textarea id="editor" hidden aria-label="Edit prompt"></textarea>
  </section>
</main>
<script>
  const $ = id => document.getElementById(id);
  const task = $('task'), go = $('go'), status = $('status'), bar = $('bar'), qs = $('qs'), stages = $('stages'),
        qlist = $('qlist'), extra = $('extra'), result = $('result'), out = $('out'), copy = $('copy');
  const hist = $('hist'), histBtn = $('histBtn'), histList = $('histList'), edit = $('edit'), editor = $('editor');
  let timer, copyText = '', asked = [], current = null; // current = history id of the prompt on screen

  // Runs one server step. The response may start with "@stage" lines (progress); the rest is the payload.
  async function step(label, url, body, done) {
    if (go.disabled) return;
    go.disabled = $('buildBtn').disabled = true; bar.classList.add('on');
    status.classList.remove('error');
    const t0 = Date.now(), secs = () => Math.round((Date.now() - t0) / 1000) + 's';
    status.textContent = label + ' · 0s';
    timer = setInterval(() => { status.textContent = label + ' · ' + secs(); }, 1000);
    try {
      const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '', failed = !r.ok;
      for (;;) {
        const { value, done: end } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        for (let m; (m = buf.match(/^@(\\w+)\\n/)); buf = buf.slice(m[0].length)) {
          if (m[1] === 'error') failed = true; else setStage(m[1]);
        }
        if (end) break;
      }
      if (failed) throw new Error(buf);
      done(buf);
      status.textContent = 'Done in ' + secs();
    } catch (e) {
      status.textContent = String(e.message || e).slice(0, 200);
      status.classList.add('error');
      if (!stages.hidden) { stages.hidden = true; qs.hidden = !asked.length; } // give the answers back for a retry
    }
    clearInterval(timer); bar.classList.remove('on'); go.disabled = $('buildBtn').disabled = false;
  }

  function setStage(name) {
    let seen = false;
    for (const li of stages.children) {
      const now = li.dataset.s === name;
      li.className = now ? 'now' : seen ? '' : 'done';
      seen = seen || now;
    }
  }

  function interview() {
    const t = task.value.trim();
    if (!t) return;
    qs.hidden = result.hidden = stages.hidden = true; toggleHist(false);
    step('Finding the gaps', '/questions', { task: t }, text => {
      asked = JSON.parse(text);
      if (!asked.length) return setTimeout(buildPrompt); // nothing worth asking: go straight to the build
      qlist.replaceChildren(...asked.map((x, i) => {
        const fs = document.createElement('fieldset'), lg = document.createElement('legend'),
              opts = document.createElement('div');
        lg.textContent = x.q; opts.className = 'opts';
        x.options.forEach(o => {
          const l = document.createElement('label'), r = document.createElement('input'), s = document.createElement('span');
          r.type = 'radio'; r.name = 'q' + i; r.value = o; s.textContent = o;
          l.append(r, s); opts.append(l);
        });
        fs.append(lg, opts);
        return fs;
      }));
      extra.value = ''; qs.hidden = false;
    });
  }

  function buildPrompt() {
    const answers = asked.map((x, i) => ({ q: x.q, a: (qs.querySelector('input[name=q' + i + ']:checked') || {}).value || '' }));
    if (extra.value.trim()) answers.push({ q: 'Anything else', a: extra.value.trim() });
    qs.hidden = true; stages.hidden = false; setStage('draft');
    window.scrollTo(0, 0);
    step('Forging', '/build', { task: task.value.trim(), answers }, text => {
      showResult(text.trim(), null);
      fetch('/history').then(r => r.json()).then(h => { if (h[0] && h[0].prompt === copyText) current = h[0].id; }).catch(() => {});
    });
  }

  function showResult(text, id) {
    copyText = text; current = id;
    out.innerHTML = render(text);
    setEditing(false);
    stages.hidden = qs.hidden = true; result.hidden = false;
    result.classList.remove('reveal'); void result.offsetWidth; result.classList.add('reveal');
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    result.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function setEditing(on) {
    editor.hidden = !on; out.hidden = on;
    edit.textContent = on ? 'Save' : 'Edit';
    if (on) { editor.value = copyText; editor.focus(); }
  }
  edit.onclick = async () => {
    if (editor.hidden) return setEditing(true);
    copyText = editor.value.trim();
    out.innerHTML = render(copyText);
    setEditing(false);
    if (!current) return;
    const r = await fetch('/history/save', { method: 'POST', body: JSON.stringify({ id: current, prompt: copyText }) }).catch(() => null);
    status.classList.toggle('error', !(r && r.ok));
    status.textContent = r && r.ok ? 'Saved to history' : 'Edit kept here, but saving to history failed';
  };

  async function toggleHist(show) {
    hist.hidden = !show; histBtn.setAttribute('aria-expanded', show);
    if (!show) return;
    let items = [];
    try { const r = await fetch('/history'); if (!r.ok) throw new Error(await r.text()); items = await r.json(); }
    catch (e) { status.textContent = String(e.message).slice(0, 200); status.classList.add('error'); }
    $('histEmpty').hidden = items.length > 0;
    histList.replaceChildren(...items.map(x => {
      const li = document.createElement('li'), open = document.createElement('button'), label = document.createElement('span'),
            when = document.createElement('time'), rm = document.createElement('button');
      label.textContent = x.task;
      when.textContent = new Date(x.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      open.className = 'open'; open.append(label, when);
      open.onclick = () => { task.value = x.task; asked = []; toggleHist(false); showResult(x.prompt, x.id); };
      rm.className = 'ghost rm'; rm.textContent = 'Remove';
      rm.onclick = async () => { // two clicks instead of confirm(): WKWebView silently drops JS dialogs
        if (!rm.classList.contains('sure')) {
          rm.classList.add('sure'); rm.textContent = 'Really remove?';
          return setTimeout(() => { rm.classList.remove('sure'); rm.textContent = 'Remove'; }, 3000);
        }
        const r = await fetch('/history/delete', { method: 'POST', body: JSON.stringify({ id: x.id }) });
        if (r.ok) { li.remove(); if (current === x.id) current = null; $('histEmpty').hidden = histList.children.length > 0; }
      };
      li.append(open, rm);
      return li;
    }));
  }
  histBtn.onclick = () => toggleHist(hist.hidden);

  // ponytail: just enough markdown for a prompt (headings, lists, bold, code); Copy still gives the raw text.
  function render(md) {
    const BT = String.fromCharCode(96), FENCE = BT + BT + BT;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const inline = s => esc(s).replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>').replace(/\\*([^*\\s][^*]*?)\\*/g, '<em>$1</em>')
      .replace(new RegExp(BT + '([^' + BT + ']+)' + BT, 'g'), '<code>$1</code>');
    let html = '', list = '', para = [], code = null;
    const flush = () => {
      if (para.length) { html += '<p>' + inline(para.join(' ')) + '</p>'; para = []; }
      if (list) { html += '</' + list + '>'; list = ''; }
    };
    for (const line of md.split('\\n')) {
      let m;
      if (code !== null) { if (line.trim().startsWith(FENCE)) { html += '<pre>' + esc(code) + '</pre>'; code = null; } else code += line + '\\n'; }
      else if (line.trim().startsWith(FENCE)) { flush(); code = ''; }
      else if ((m = line.match(/^(#{1,4})\\s+(.*)/))) { flush(); const h = m[1].length === 1 ? 'h2' : 'h3'; html += '<' + h + '>' + inline(m[2]) + '</' + h + '>'; }
      else if ((m = line.match(/^\\s*([-*]|\\d+[.)])\\s+(.*)/))) {
        const kind = /\\d/.test(m[1]) ? 'ol' : 'ul';
        if (list !== kind) { flush(); html += '<' + kind + '>'; list = kind; }
        html += '<li>' + inline(m[2]) + '</li>';
      }
      else if (!line.trim()) flush();
      else { if (list) flush(); para.push(line.trim()); }
    }
    if (code !== null) html += '<pre>' + esc(code) + '</pre>';
    flush();
    return html;
  }

  go.onclick = interview;
  task.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); interview(); } };
  qs.onsubmit = e => { e.preventDefault(); buildPrompt(); };
  copy.onclick = async () => {
    let ok = true;
    const text = editor.hidden ? copyText : editor.value; // copying mid-edit gives what you see
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy'); ta.remove();
    }
    copy.textContent = ok ? 'Copied' : 'Copy failed'; copy.classList.toggle('done', ok);
    setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1500);
  };
</script>`;

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
  } else if (req.method === 'GET' && req.url === '/history') {
    try { const h = JSON.stringify(loadHist()); res.writeHead(200, { 'content-type': 'application/json' }).end(h); }
    catch (e) { res.writeHead(500).end('history unreadable: ' + e.message); }
  } else if (req.method === 'POST' && ['/questions', '/build', '/history/save', '/history/delete'].includes(req.url)) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { task, answers, id, prompt } = JSON.parse(body);
        if (req.url.startsWith('/history/')) {
          const h = loadHist(), i = h.findIndex(x => x.id === id);
          if (i < 0) return res.writeHead(404).end('no such prompt');
          if (req.url === '/history/delete') h.splice(i, 1);
          else h[i].prompt = String(prompt || '').slice(0, 60000);
          saveHist(h);
          return res.writeHead(200).end('ok');
        }
        const t = String(task || '').trim().slice(0, 4000);
        if (!t) return res.writeHead(400).end('empty request');
        const a = (Array.isArray(answers) ? answers : []).slice(0, 8)
          .map(x => ({ q: String(x.q || '').slice(0, 300), a: String(x.a || '').slice(0, 1000) }));
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        if (req.url === '/questions') return res.end(JSON.stringify(await forge.questions(t)));
        const built = await forge.build(t, a, stage => res.write('@' + stage + '\n'));
        try { saveHist([{ id: Date.now().toString(36), at: new Date().toISOString(), task: t, answers: a, prompt: built }, ...loadHist()]); }
        catch (e) { console.error('history not saved:', e.message); } // the prompt still reaches the user
        res.end(built);
      } catch (e) { res.headersSent ? res.end('@error\nforge failed: ' + e.message) : res.writeHead(500).end('forge failed: ' + e.message); }
    });
  } else res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log('Prompt Forge → http://localhost:' + PORT));
