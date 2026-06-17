import { Dashboard, Tile } from "./model.js";

export interface TileChange {
  id: string;
  name: string;
  fields: Record<string, [unknown, unknown]>;   // field -> [before, after]
}

export interface DashboardDiff {
  metadata: Record<string, [unknown, unknown]>;
  addedTiles: Tile[];
  removedTiles: Tile[];
  changedTiles: TileChange[];
}

export function diffDashboards(a: Dashboard, b: Dashboard): DashboardDiff {
  const meta: Record<string, [unknown, unknown]> = {};
  for (const key of ["name", "owner", "shared"] as const) {
    if (a[key] !== b[key]) meta[key] = [a[key], b[key]];
  }
  const am = new Map(a.tiles.map((t) => [t.id, t]));
  const bm = new Map(b.tiles.map((t) => [t.id, t]));

  const added = b.tiles.filter((t) => !am.has(t.id));
  const removed = a.tiles.filter((t) => !bm.has(t.id));
  const changed: TileChange[] = [];
  for (const [id, bt] of bm) {
    const at = am.get(id);
    if (!at) continue;
    const fields: Record<string, [unknown, unknown]> = {};
    for (const key of ["name", "type", "query"] as const) {
      if (at[key] !== bt[key]) fields[key] = [at[key], bt[key]];
    }
    if (Object.keys(fields).length) changed.push({ id, name: bt.name, fields });
  }
  return { metadata: meta, addedTiles: added, removedTiles: removed, changedTiles: changed };
}

export function hasChanges(d: DashboardDiff): boolean {
  return Object.keys(d.metadata).length > 0 || d.addedTiles.length > 0 ||
         d.removedTiles.length > 0 || d.changedTiles.length > 0;
}

/** A compact, reviewable text summary of a diff (handy for PR comments). */
export function renderDiff(d: DashboardDiff): string {
  if (!hasChanges(d)) return "No changes.";
  const lines: string[] = [];
  for (const [k, [before, after]] of Object.entries(d.metadata)) {
    lines.push(`~ ${k}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }
  for (const t of d.addedTiles) lines.push(`+ tile ${t.id} — ${t.name}`);
  for (const t of d.removedTiles) lines.push(`- tile ${t.id} — ${t.name}`);
  for (const c of d.changedTiles) {
    lines.push(`~ tile ${c.id} — ${c.name}`);
    for (const [k, [before, after]] of Object.entries(c.fields)) {
      lines.push(`    ${k}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }
  return lines.join("\n");
}
