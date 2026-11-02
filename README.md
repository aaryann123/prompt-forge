# Prompt Forge

Prompt Forge turns a rough one-line idea into a structured, ready-to-paste prompt for Claude. Three
Claude agents work on it in turn: one interviews, one drafts, one critiques. It runs on your Mac
against your own `claude` CLI login, so it needs no API key and keeps no server.

![Prompt Forge showing a finished prompt](docs/screenshots/result.png)

## Why

Most of a prompt's quality comes from the decisions you had not written down yet: where the output
goes, what is out of scope, what "done" means. Writing those down mid-task is tedious, so they get
skipped and Claude guesses. A generic "improve my prompt" button tends to make the text longer
without asking you anything. Prompt Forge asks first, then writes, then has a second agent read the
draft cold before you see it.

## What it does

- **Asks 3 to 5 multiple-choice questions** about the gaps where a wrong guess would change the
  result, most consequential first, 2 to 4 options each. Skip any of them; skipped ones become
  `Assumption:` lines in the prompt that you can edit before pasting.
- **Drafts, critiques, revises.** A drafter writes the prompt (goal, scope and non-goals, behaviour,
  constraints, build order, acceptance checks). A critic reviews it as the Claude that will receive
  it, listing up to 6 problems. The drafter revises once. No loop.
- **Plain LLM calls through your CLI login.** Each step is `claude -p` with `--setting-sources ''` and
  `--tools ''`, so no hooks, plugins or `CLAUDE.md` leak into the prompt, and it runs on your
  existing Claude plan rather than an API key.
- **Renders the result as a document**, with headings and lists, plus Copy (raw markdown) and an
  in-place Edit.
- **Keeps a local history** in `history.json` next to the app: the last 200 prompts, written with an
  atomic rename so a crash cannot corrupt it. Reopen, edit or remove any of them.
- **Also a CLI.** `./forge "<idea>"` skips the interview and prints the finished prompt.
- **Optional Dock app.** A small Swift wrapper starts the server and shows it in a native
  WebKit window.

Expect 60 to 90 seconds for a full forge; the page shows which agent is working.

## Screenshots

| | |
|---|---|
| ![Home](docs/screenshots/home.png) | ![Questions](docs/screenshots/questions.png) |
| Idea | Questions |
| ![Forging](docs/screenshots/forging.png) | ![History](docs/screenshots/history.png) |
| Forging | History |

*Screenshots use canned model output from `Tools/fake-claude.js` and a synthetic history from
`Tools/make-demo-history.js` — nobody's actual prompts.*

## Quick start

Requires Node 18 or newer and the [Claude Code CLI](https://docs.claude.com/en/docs/claude-code)
signed in (`claude` on your PATH).

```bash
git clone https://github.com/aaryann123/prompt-forge.git
cd prompt-forge
npm run dev            # http://localhost:3456
```

Type an idea, press ⌘↩ (Ctrl-Enter elsewhere), answer what you like, press **Build prompt**.

To try it without a Claude login, point it at the stand-in model:

```bash
FORGE_CLAUDE=Tools/fake-claude.js npm run dev
```

To install the Dock app (macOS 13+, Xcode command line tools): `npm run install-app`.

## Requirements

| | |
|---|---|
| OS | Any OS for the web app and CLI. The Dock app is macOS 13+ only. |
| Node | 18 or newer. No npm dependencies. |
| Claude | The `claude` CLI, signed in. Found at `~/.claude/local/claude`, else on PATH; override with `FORGE_CLAUDE`. |
| Model | `claude-sonnet-5` by default; set `FORGE_MODEL` to change it. |
| Settings | `FORGE_PORT` (default 3456), `FORGE_HISTORY` (default `./history.json`). |

## How it's organised

```
forge           the pipeline: prompts for the three agents, claude -p calls, CLI entry
app.js          HTTP server and the whole UI as one inline page
main.swift      the Dock app: starts app.js and shows it in a WKWebView
icon.swift      draws the app icon (npm run icon)
Info.plist      bundle metadata for the Dock app
PRODUCT.md      design brief the UI was built against
Tools/          stand-in model, demo history, screenshot script
docs/           architecture, building, screenshots
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why it works the way it does and
[docs/BUILDING.md](docs/BUILDING.md) for running, extending and regenerating screenshots.

## Contributing

Pull requests are welcome.

- `npm test` runs the self-test of the question parser and brief builder; it needs no model.
- The agents' behaviour lives in three prompt strings at the top of `forge`. Change one, then run a
  real forge or two; the self-test cannot judge prompt quality.
- Use `Tools/fake-claude.js` and the demo history for UI work and screenshots. Never commit your
  own `history.json`.
- Good first projects: streaming the drafter's text as it arrives, a second critique pass behind a
  flag, exporting a prompt as a `.md` file.

## Credits and licence

Prompt Forge is MIT licensed — see [LICENSE](LICENSE). It calls the Claude Code CLI, which is
Anthropic's software under its own terms; Claude is a trademark of Anthropic.
