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
