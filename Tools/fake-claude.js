#!/usr/bin/env node
// Stand-in for `claude -p` so the UI can be demoed and screenshotted without a Claude login.
// Answers by role (read from --system-prompt) with canned text. Point forge at it:
//   FORGE_CLAUDE=Tools/fake-claude.js node app.js
// FAKE_CLAUDE_DELAY=<ms> slows each call down (default 600) so the stage list is visible.
const args = process.argv.slice(2);
const system = args[args.indexOf('--system-prompt') + 1] || '';

const QUESTIONS = [
  { q: 'Where should the renamed files go?', options: ['Rename in place', 'Copy into a new folder', 'Ask each run'] },
  { q: 'Which date wins when a photo has no EXIF date?', options: ['File modified time', 'Skip the file', 'Put it in an "undated" folder'] },
  { q: 'What name format do you want?', options: ['2026-03-14_101502.jpg', '2026/03/2026-03-14_101502.jpg', 'Keep the original name after the date'] },
  { q: 'How should it handle two photos taken in the same second?', options: ['Append -1, -2', 'Skip the second one'] },
];

const PROMPT = `# Build a photo renamer that sorts by capture date

## Goal
Write a small command-line tool that renames photos by the date they were taken, so a folder of IMG_4031.jpg files becomes a folder you can sort and scan by name. It is for one person tidying their own library, run by hand a few times a month.

## Scope for the first version
- Input: one folder, scanned recursively. JPEG, HEIC and PNG.
- Copy each photo into a new output folder; never modify or delete the originals.
- Name format: \`2026-03-14_101502.jpg\` (local time, from EXIF \`DateTimeOriginal\`).
- Not in scope: video, RAW files, a GUI, cloud libraries.

## Behaviour
1. Read \`DateTimeOriginal\`; if it is missing, use the file's modified time.
2. Two photos with the same timestamp get \`-1\`, \`-2\` suffixes in capture order.
3. A \`--dry-run\` flag prints the planned renames as a two-column table and writes nothing.
4. Finish with a one-line summary: copied, skipped, and why.

## Constraints
- Python 3.11+, standard library plus \`Pillow\` for EXIF. Assumption: HEIC support through \`pillow-heif\`; drop HEIC if that dependency is unwanted.
- Must be safe to run twice on the same input: an existing identical file in the output is skipped, not overwritten.

## How to work
Build the date reader first and test it against a handful of sample files with and without EXIF. Then the naming and collision logic, then the copy. Run the tool on a scratch folder after each step.

## Done when
- \`--dry-run\` on a folder of 20 mixed photos prints 20 rows and creates no files.
- A real run produces correctly named copies and leaves the originals byte-identical.
- Running it a second time copies nothing.`;

const CRITIQUE = `1. "local time" — say which timezone when EXIF has an offset tag. Fix: use the offset when present, otherwise the machine's zone.
2. "existing identical file" — define identical (size + hash). Fix: compare SHA-256.`;

const out = system.startsWith('You prepare') ? JSON.stringify(QUESTIONS)
  : system.startsWith('You are the Claude') ? CRITIQUE
  : PROMPT;

process.stdin.resume();
process.stdin.on('end', () => setTimeout(() => process.stdout.write(out + '\n'), Number(process.env.FAKE_CLAUDE_DELAY ?? 600)));
