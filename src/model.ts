// A normalized view of a Dynatrace dashboard (tolerant of classic + Platform JSON).
export interface Tile {
  id: string;
  name: string;
  type: string;          // e.g. "DATA_EXPLORER", "markdown", "graph"
  query?: string;        // DQL / metric selector if present
}

export interface Dashboard {
  name: string;
  owner?: string;
  shared?: boolean;
  tiles: Tile[];
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
  };
}
