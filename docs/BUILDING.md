# Building

## Requirements

| | |
|---|---|
| Node | 18+ (the screenshot script needs 22+ for the built-in `WebSocket`) |
| Claude CLI | signed in; or use `Tools/fake-claude.js` |
| Dock app | macOS 13+, Xcode command line tools (`swiftc`, `sips`, `iconutil`) |
| Screenshots | Google Chrome (set `CHROME` if it is not in /Applications) |

## First run

```bash
npm run dev                       # web UI on http://localhost:3456
./forge "a tiny URL shortener"    # CLI, no interview
npm test                          # self-test, no model calls
```

## Layout

```
forge                 pipeline + CLI (CommonJS, executable)
app.js                server and inline UI
main.swift            Dock app wrapper
icon.swift            icon renderer
Info.plist            app bundle metadata
PRODUCT.md            design brief
Tools/fake-claude.js        stand-in for `claude -p`, answers by role with canned text
Tools/make-demo-history.js  writes a synthetic history file
Tools/screenshots.mjs       regenerates docs/screenshots/
docs/                 this file, ARCHITECTURE.md, screenshots/
```

Generated and ignored: `history.json`, `AppIcon.icns`, `Prompt Forge.app/`.

## The Dock app

```bash
npm run icon          # AppIcon.icns from icon.swift (build runs this if it is missing)
npm run build         # Prompt Forge.app in this folder
npm run install-app   # copies it to ~/Applications
```

The project path is baked in at compile time (`#filePath`), so rebuild if you move the folder. The
server's output goes to `~/Library/Logs/PromptForge.log`.

## Changing an agent

The three system prompts are the `INTERVIEWER`, `DRAFTER` and `CRITIC` constants in `forge`. The
revision instruction is inline in `build()`. After a change, run a few real forges with different
kinds of ideas (an app, a one-off script, a piece of writing) and read the results.

## Regenerating screenshots

```bash
node Tools/screenshots.mjs
```

It writes a demo history to a temp folder, starts `app.js` on port 3466 with
`FORGE_CLAUDE=Tools/fake-claude.js`, drives headless Chrome over the DevTools protocol at 800 CSS px
and 2x scale, and writes 1600 px PNGs. Open each one before committing.

## Not supported yet

The Dock app is macOS only. On Linux and Windows, use the web UI or the CLI.
