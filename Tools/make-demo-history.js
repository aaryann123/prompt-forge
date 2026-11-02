#!/usr/bin/env node
// Writes a synthetic history file for demos and screenshots: node Tools/make-demo-history.js <out.json>
// Every idea and prompt here is made up; nothing comes from a real history.json.
const fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('usage: make-demo-history.js <out.json>'); process.exit(1); }

const ideas = [
  'a command line tool that renames my photos by the date they were taken',
  'a browser extension that hides the comment section on news sites',
  'a weekly meal planner that builds a shopping list grouped by aisle',
  'a script that checks my static site for broken links before I deploy',
  'a small habit tracker that lives in the menu bar',
  'a README for my open source CSV-to-JSON converter',
];
const now = Date.parse('2026-10-30T16:20:00Z');
const items = ideas.map((task, i) => ({
  id: 'demo' + i,
  at: new Date(now - i * 26 * 3600e3).toISOString(),
  task,
  answers: [],
  prompt: `# ${task[0].toUpperCase() + task.slice(1)}\n\n## Goal\nA synthetic example prompt for the demo history.\n`,
}));
fs.writeFileSync(out, JSON.stringify(items, null, 1));
console.log(`wrote ${items.length} demo prompts to ${out}`);
