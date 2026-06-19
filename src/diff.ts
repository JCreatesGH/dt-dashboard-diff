import { Dashboard, Tile } from "./model.js";

export interface TileChange {
  id: string;
  name: string;
  fields: Record<string, [unknown, unknown]>;   // field -> [before, after]
}

export interface MovedTile {
  fromId: string;
  toId: string;
  name: string;
}

export interface DashboardDiff {
  metadata: Record<string, [unknown, unknown]>;
  addedTiles: Tile[];
  removedTiles: Tile[];
  movedTiles: MovedTile[];
  changedTiles: TileChange[];
  // variable/filter key -> [before, after]; an absent side is `undefined` (add/remove).
  variables: Record<string, [string | undefined, string | undefined]>;
}

const contentKey = (t: Tile) => JSON.stringify([t.name, t.type, t.query ?? null]);

export function diffDashboards(a: Dashboard, b: Dashboard): DashboardDiff {
  const meta: Record<string, [unknown, unknown]> = {};
  for (const key of ["name", "owner", "shared"] as const) {
    if (a[key] !== b[key]) meta[key] = [a[key], b[key]];
  }
  const am = new Map(a.tiles.map((t) => [t.id, t]));
  const bm = new Map(b.tiles.map((t) => [t.id, t]));

  const addedRaw = b.tiles.filter((t) => !am.has(t.id));
  const removedRaw = a.tiles.filter((t) => !bm.has(t.id));
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

  // Re-key detection: a removed + added pair with identical content is the same
  // tile under a new id (common when dashboards are re-exported or migrated), not
  // a real add/remove. Surface it as a move so the diff isn't drowned in noise.
  const removedPool = [...removedRaw];
  const added: Tile[] = [];
  const moved: MovedTile[] = [];
  for (const at of addedRaw) {
    const i = removedPool.findIndex((rt) => contentKey(rt) === contentKey(at));
    if (i >= 0) {
      const rt = removedPool.splice(i, 1)[0];
      moved.push({ fromId: rt.id, toId: at.id, name: at.name });
    } else {
      added.push(at);
    }
  }
  // Variable / default-filter drift, keyed by variable name.
  const av = new Map(a.variables.map((v) => [v.key, v.value]));
  const bv = new Map(b.variables.map((v) => [v.key, v.value]));
  const variables: Record<string, [string | undefined, string | undefined]> = {};
  for (const k of new Set([...av.keys(), ...bv.keys()])) {
    if (av.get(k) !== bv.get(k)) variables[k] = [av.get(k), bv.get(k)];
  }

  return { metadata: meta, addedTiles: added, removedTiles: removedPool, movedTiles: moved,
           changedTiles: changed, variables };
}

export function hasChanges(d: DashboardDiff): boolean {
  return Object.keys(d.metadata).length > 0 || d.addedTiles.length > 0 ||
         d.removedTiles.length > 0 || d.movedTiles.length > 0 || d.changedTiles.length > 0 ||
         Object.keys(d.variables).length > 0;
}

/** A compact, reviewable text summary of a diff (handy for PR comments). */
export function renderDiff(d: DashboardDiff): string {
  if (!hasChanges(d)) return "No changes.";
  const counts: string[] = [];
  if (Object.keys(d.metadata).length) counts.push(`${Object.keys(d.metadata).length} metadata`);
  if (d.addedTiles.length) counts.push(`${d.addedTiles.length} added`);
  if (d.removedTiles.length) counts.push(`${d.removedTiles.length} removed`);
  if (d.movedTiles.length) counts.push(`${d.movedTiles.length} re-keyed`);
  if (d.changedTiles.length) counts.push(`${d.changedTiles.length} changed`);
  if (Object.keys(d.variables).length) counts.push(`${Object.keys(d.variables).length} variable`);
  const lines: string[] = [counts.join(", ")];
  for (const [k, [before, after]] of Object.entries(d.metadata)) {
    lines.push(`~ ${k}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }
  for (const t of d.addedTiles) lines.push(`+ tile ${t.id} — ${t.name}`);
  for (const t of d.removedTiles) lines.push(`- tile ${t.id} — ${t.name}`);
  for (const m of d.movedTiles) lines.push(`» tile re-keyed ${m.fromId} → ${m.toId} — ${m.name}`);
  for (const c of d.changedTiles) {
    lines.push(`~ tile ${c.id} — ${c.name}`);
    for (const [k, [before, after]] of Object.entries(c.fields)) {
      lines.push(`    ${k}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }
  for (const [k, [before, after]] of Object.entries(d.variables)) {
    if (before === undefined) lines.push(`+ variable ${k}`);
    else if (after === undefined) lines.push(`- variable ${k}`);
    else lines.push(`~ variable ${k}`);
  }
  return lines.join("\n");
}
