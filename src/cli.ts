#!/usr/bin/env node
import { parseDashboard } from "./model.js";
import { validate } from "./validate.js";
import { diffDashboards, hasChanges, renderDiff } from "./diff.js";

const HELP = `dt-dashboard-diff — validate & diff Dynatrace dashboards-as-code

Usage:
  dt-dashboard-diff <dashboard.json>            validate one dashboard
  dt-dashboard-diff <before.json> <after.json>  diff two dashboards

Options:
  --json         machine-readable output
  --exit-code    (diff mode) exit 1 when there are changes, like \`git diff\`
  -h, --help     show this help

Exit code: 1 if validation finds a HIGH issue, or (diff + --exit-code) on any change.`;

/** Pure core over file *contents*: 1 → validate, 2 → diff. */
export function run(contents: string[], opts: { json?: boolean; exitCode?: boolean } = {}): { code: number; output: string } {
  if (contents.length === 1) {
    const issues = validate(parseDashboard(contents[0]));
    const high = issues.some((i) => i.severity === "high");
    const output = opts.json
      ? JSON.stringify(issues, null, 2)
      : issues.length
        ? issues.map((i) => `${i.severity.toUpperCase().padEnd(6)} ${i.rule}: ${i.message}`).join("\n")
        : "✓ no issues";
    return { code: high ? 1 : 0, output };
  }
  const diff = diffDashboards(parseDashboard(contents[0]), parseDashboard(contents[1]));
  const output = opts.json ? JSON.stringify(diff, null, 2) : renderDiff(diff);
  return { code: hasChanges(diff) && opts.exitCode ? 1 : 0, output };
}

// Execute only as the CLI binary (not when imported by tests).
if (process.argv[1] && /cli\.js$/.test(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); process.exit(0); }
  const files = args.filter((a) => !a.startsWith("-"));
  if (files.length < 1 || files.length > 2) { console.error(HELP); process.exit(2); }
  const opts = { json: args.includes("--json"), exitCode: args.includes("--exit-code") };
  import("node:fs").then(({ readFileSync }) => {
    try {
      const { code, output } = run(files.map((f) => readFileSync(f, "utf8")), opts);
      (code === 0 ? console.log : console.error)(output);
      process.exit(code);
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      process.exit(2);
    }
  });
}
