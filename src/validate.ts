import { Dashboard } from "./model.js";

export interface Issue {
  severity: "high" | "medium" | "low";
  rule: string;
  message: string;
}

export function validate(d: Dashboard): Issue[] {
  const out: Issue[] = [];
  if (!d.name || d.name === "Untitled") out.push({ severity: "medium", rule: "no-name", message: "Dashboard has no name." });
  if (d.tiles.length === 0) out.push({ severity: "high", rule: "no-tiles", message: "Dashboard has no tiles." });

  const ids = new Set<string>();
  for (const t of d.tiles) {
    if (ids.has(t.id)) out.push({ severity: "high", rule: "duplicate-tile-id", message: `Duplicate tile id '${t.id}'.` });
    ids.add(t.id);
    if (t.type === "UNKNOWN") out.push({ severity: "medium", rule: "unknown-tile-type", message: `Tile '${t.name}' has no recognizable type.` });
    const needsQuery = ["DATA_EXPLORER", "graph", "DQL", "custom_charting"].includes(t.type);
    if (needsQuery && !t.query) out.push({ severity: "low", rule: "empty-query", message: `Tile '${t.name}' is a chart with no query.` });
  }
  return out;
}
