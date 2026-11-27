// token-radar-01 entry: reads the sealed snapshot, scores every pre-token protocol,
// writes board.json + the dashboard's data.js, copies dashboard/ and screenshots/,
// and writes dossier.json last (the scorer rebuilds it and compares bytes).

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRadar, boardIssue, dataScript } from "./lib/board.ts";
import { parseSnapshot, SnapshotError } from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

const here = fileURLToPath(new URL(".", import.meta.url));

const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASH_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function arg(name: string, fallback: string): string {
  const eq = process.argv.find((a) => a.startsWith("--" + name + "="));
  if (eq !== undefined) return eq.slice(name.length + 3);
  const at = process.argv.indexOf("--" + name);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  return fallback;
}

const inputArg = arg("input", "/input");
const inputFile = inputArg.endsWith(".json") ? inputArg : join(inputArg, "snapshot.json");
const out = arg("output", process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

if (!existsSync(inputFile)) {
  process.stderr.write("token radar: no snapshot at " + inputFile + "\n");
  process.exit(2);
}

let snapshot;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, "utf8"));
} catch (err) {
  if (err instanceof SnapshotError) {
    process.stderr.write("token radar: " + err.message + "\n");
    process.exit(2);
  }
  throw err;
}

const { rows, radar } = buildRadar(snapshot);
const issue = boardIssue(rows, snapshot);
if (issue !== null) {
  process.stderr.write("token radar: the model wrote a board the gate refuses: " + issue + "\n");
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "board.json"), JSON.stringify({ rows }) + "\n");
writeFileSync(join(out, "data.js"), dataScript(radar));

function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith(".")) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dash = copyFiles(join(here, "dashboard"), join(out, "dashboard"));
const shots = copyFiles(join(here, "screenshots"), join(out, "screenshots"));

if (dash.length === 0) {
  process.stderr.write("token radar: no dashboard/ files to copy\n");
  process.exit(1);
}
if (shots.length < 3) {
  process.stderr.write("token radar: screenshots/ holds " + shots.length + ": hand in 3\n");
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write("token radar: bad screenshot name: " + name + "\n");
    process.exit(1);
  }
}

writeFileSync(join(out, "dossier.json"), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: DASH_CAPS }));

let pass = 0;
let warn = 0;
let fail = 0;
for (const r of rows) {
  pass += r.counts.pass;
  warn += r.counts.warn;
  fail += r.counts.fail;
}

process.stdout.write(
  "token radar: " + snapshot.protocols.length + " protocols, " + snapshot.watchlist.length + " on the watchlist, " + rows.length + " rows scored\n" +
    "token radar: " + radar.early_size + " early pre-token, " + radar.live_size + " live-token kept apart, " + radar.anchors + " valuation anchors\n" +
    "token radar: " + pass + " passing signals, " + warn + " warnings, " + fail + " failing signals across the board\n" +
    "token radar: wrote board.json, data.js, dashboard/ (" + dash.length + " files), screenshots/ (" + shots.length + " images) and dossier.json\n",
);
