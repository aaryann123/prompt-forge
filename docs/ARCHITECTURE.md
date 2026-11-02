# Architecture

```
 browser / WKWebView
        │  POST /questions, /build, /history/*
        ▼
 app.js  (node:http, one inline page)
        │  require('./forge')
        ▼
 forge   questions(task)       → interviewer
         build(task, answers)  → drafter → critic → drafter (revise)
        │  execFile(claude -p ...) per step, prompt on stdin
        ▼
 claude CLI  (your login)
```

| File | Responsibility |
|---|---|
| `forge` | Agent system prompts, `ask()` (one `claude -p` call), `parseQuestions`, `brief`, `build`, CLI and `--selftest`. |
| `app.js` | Serves the page, validates and caps input, streams stage markers, reads and writes `history.json`. |
| `main.swift` | Native wrapper: spawns `node app.js` through a login shell, retries loading until the server is up, kills it on quit. |
| `icon.swift` | Draws the 1024 px icon that `npm run icon` turns into `AppIcon.icns`. |

## One call per agent, through the CLI

`ask(system, prompt)` runs `claude -p --model M --setting-sources '' --tools '' --system-prompt S`
with the prompt on stdin and `cwd` set to the temp directory. The empty setting sources and tool
list make it a plain completion: no hooks, plugins, MCP servers or project `CLAUDE.md` can steer the
output. Going through the CLI instead of the API means the forge runs on whatever plan the CLI is
signed in with. `--bare` was avoided because it demands an API key. Each call has a 180 s timeout
and an 8 MB output cap.

## The brief

Both the drafter and critic receive the same `<idea>` / `<answers>` block. Unanswered questions are
dropped; if nothing was answered the block says so and tells the drafter to label its defaults as
assumptions. The critic gets the draft inside `<prompt_under_review>`; the revision call gets the
draft and the review, with an instruction to ignore review points that would invent facts.

## Streaming progress without a websocket

`/build` writes `@draft\n`, `@critique\n`, `@revise\n` lines as each stage starts, then the final
prompt. The page reads the body with a stream reader, strips leading `@stage` lines and lights up the
matching step. A failure after headers are sent is reported as `@error\n` plus the message, since the
status code can no longer change.

## History

`history.json` is a JSON array, newest first, capped at 200. Writes go to `history.json.tmp` and are
renamed over the original. An unreadable file makes `/history` return 500 rather than being treated
as empty, so a corrupt file is never overwritten with `[]`.

## Things that bit us

- **The CLI's default model returned 404 on one account.** The model is now passed explicitly and
  can be changed with `FORGE_MODEL`.
- **A stale `claude` on PATH lacked `--tools`.** `forge` prefers the self-updating install at
  `~/.claude/local/claude`.
- **Models wrap JSON in fences or a sentence.** `parseQuestions` slices from the first `[` to the
  last `]` and drops malformed items; no questions just means the drafter works from assumptions.
- **WKWebView drops `confirm()` silently.** Remove uses a two-click "Really remove?" instead.
- **Dock apps start with a bare environment**, so `node` from nvm is not on PATH. The wrapper runs
  `zsh -lic 'exec node app.js'`. If the port is already taken (the server is running elsewhere), the
  child exits and the window uses the existing server.
- **⌘C/⌘V did nothing in the web view** until the app got an Edit menu.
