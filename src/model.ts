// A normalized view of a Dynatrace dashboard (tolerant of classic + Platform JSON).
export interface Tile {
  id: string;
  name: string;
  type: string;          // e.g. "DATA_EXPLORER", "markdown", "graph"
  query?: string;        // DQL / metric selector if present
}

// A dashboard variable / default filter. `value` is a stable string repr of its
// definition, so a change to the definition is detectable.
export interface Variable {
  key: string;
  value: string;
}

export interface Dashboard {
  name: string;
  owner?: string;
  shared?: boolean;
  tiles: Tile[];
  variables: Variable[];
}

function parseVariables(d: any): Variable[] {
  const out: Variable[] = [];
  // Platform dashboards: a `variables` array of { key/name, ...definition }.
  if (Array.isArray(d.variables)) {
    for (const v of d.variables) {
      const key = String(v.key ?? v.name ?? "");
      if (!key) continue;
      const { key: _k, name: _n, ...rest } = v;
      out.push({ key, value: JSON.stringify(rest) });
    }
    return out;
  }
  // Classic dashboards: a `dashboardFilter` / `filterConfig` object of default filters.
  const filt = d.dashboardMetadata?.dashboardFilter ?? d.dashboardFilter ?? d.filterConfig;
  if (filt && typeof filt === "object") {
    for (const [k, val] of Object.entries(filt)) out.push({ key: k, value: JSON.stringify(val) });
  }
  return out;
}

export function parseDashboard(json: string | Record<string, unknown>): Dashboard {
  const d: any = typeof json === "string" ? JSON.parse(json) : json;
  const meta = d.dashboardMetadata ?? d.metadata ?? {};
  const rawTiles: any[] = d.tiles
    ? (Array.isArray(d.tiles) ? d.tiles : Object.entries(d.tiles).map(([id, t]: any) => ({ id, ...t })))
    : [];
  const tiles: Tile[] = rawTiles.map((t, i) => ({
    id: String(t.id ?? t.key ?? t.name ?? i),
    name: t.name ?? t.title ?? `tile ${i}`,
    type: t.tileType ?? t.type ?? t.visualization ?? "UNKNOWN",
    query: t.query ?? t.metric ?? (t.queries && t.queries[0]?.query) ?? undefined,
  }));
  return {
    name: d.name ?? meta.name ?? "Untitled",
    owner: meta.owner ?? d.owner,
    shared: meta.shared ?? d.shared,
    tiles,
    variables: parseVariables(d),
  };
}
