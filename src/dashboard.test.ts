import { describe, it, expect } from "vitest";
import { parseDashboard } from "./model";
import { validate } from "./validate";
import { diffDashboards, hasChanges, renderDiff } from "./diff";
import { run } from "./cli";

const dev = {
  dashboardMetadata: { name: "Service Health", owner: "team-a", shared: true },
  tiles: [
    { id: "t1", name: "Error rate", tileType: "DATA_EXPLORER", query: "fetch logs | filter status==500" },
    { id: "t2", name: "Notes", tileType: "MARKDOWN" },
  ],
};
const prod = {
  dashboardMetadata: { name: "Service Health", owner: "team-b", shared: true },
  tiles: [
    { id: "t1", name: "Error rate", tileType: "DATA_EXPLORER", query: "fetch logs | filter status>=500" },
    { id: "t3", name: "Latency p99", tileType: "DATA_EXPLORER", query: "timeseries p99" },
  ],
};

describe("parseDashboard", () => {
  it("normalizes metadata and tiles", () => {
    const d = parseDashboard(dev);
    expect(d.name).toBe("Service Health");
    expect(d.owner).toBe("team-a");
    expect(d.tiles[0]).toMatchObject({ id: "t1", type: "DATA_EXPLORER" });
  });
});

describe("validate", () => {
  it("flags an empty dashboard and chart with no query", () => {
    expect(validate(parseDashboard({ tiles: [] })).some((i) => i.rule === "no-tiles")).toBe(true);
    const d = parseDashboard({ name: "X", tiles: [{ id: "a", name: "chart", tileType: "DATA_EXPLORER" }] });
    expect(validate(d).some((i) => i.rule === "empty-query")).toBe(true);
  });

  it("flags duplicate tile ids", () => {
    const d = parseDashboard({ name: "X", tiles: [{ id: "a", tileType: "MARKDOWN" }, { id: "a", tileType: "MARKDOWN" }] });
    expect(validate(d).some((i) => i.rule === "duplicate-tile-id")).toBe(true);
  });

  it("flags duplicate tile names", () => {
    const d = parseDashboard({ name: "X", tiles: [
      { id: "a", name: "CPU", tileType: "MARKDOWN" }, { id: "b", name: "CPU", tileType: "MARKDOWN" }] });
    expect(validate(d).some((i) => i.rule === "duplicate-tile-name")).toBe(true);
  });
});

describe("diffDashboards", () => {
  const d = diffDashboards(parseDashboard(dev), parseDashboard(prod));

  it("detects metadata changes", () => {
    expect(d.metadata.owner).toEqual(["team-a", "team-b"]);
  });
  it("detects added and removed tiles", () => {
    expect(d.addedTiles.map((t) => t.id)).toEqual(["t3"]);
    expect(d.removedTiles.map((t) => t.id)).toEqual(["t2"]);
  });
  it("detects changed tile queries", () => {
    const change = d.changedTiles.find((c) => c.id === "t1")!;
    expect(change.fields.query).toEqual([
      "fetch logs | filter status==500", "fetch logs | filter status>=500",
    ]);
  });
  it("hasChanges is true for a real diff, false for identical", () => {
    expect(hasChanges(d)).toBe(true);
    expect(hasChanges(diffDashboards(parseDashboard(dev), parseDashboard(dev)))).toBe(false);
  });

  it("detects a re-keyed tile (same content, new id) as a move, not add+remove", () => {
    const before = { name: "D", tiles: [{ id: "old", name: "CPU", tileType: "DATA_EXPLORER", query: "fetch x" }] };
    const after = { name: "D", tiles: [{ id: "new", name: "CPU", tileType: "DATA_EXPLORER", query: "fetch x" }] };
    const md = diffDashboards(parseDashboard(before), parseDashboard(after));
    expect(md.addedTiles).toEqual([]);
    expect(md.removedTiles).toEqual([]);
    expect(md.movedTiles).toEqual([{ fromId: "old", toId: "new", name: "CPU" }]);
    expect(hasChanges(md)).toBe(true);
  });

  it("diffs Platform variables (added / removed / changed)", () => {
    const before = { name: "D", tiles: [{ id: "a", name: "t", tileType: "MARKDOWN" }],
      variables: [{ key: "host", type: "query", input: "fetch hosts" }, { key: "env", type: "csv", values: ["dev"] }] };
    const after = { name: "D", tiles: [{ id: "a", name: "t", tileType: "MARKDOWN" }],
      variables: [{ key: "host", type: "query", input: "fetch hosts" },   // unchanged
                  { key: "env", type: "csv", values: ["prod"] },           // changed
                  { key: "region", type: "csv", values: ["us"] }] };       // added; "env" budget? no
    const v = diffDashboards(parseDashboard(before), parseDashboard(after)).variables;
    expect("host" in v).toBe(false);                 // unchanged -> not reported
    expect(v.env[0]).not.toEqual(v.env[1]);          // changed
    expect(v.region[0]).toBeUndefined();             // added
  });

  it("diffs classic dashboardFilter entries", () => {
    const before = { name: "D", tiles: [{ id: "a", name: "t", tileType: "MARKDOWN" }],
      dashboardFilter: { managementZone: { id: "1" } } };
    const after = { name: "D", tiles: [{ id: "a", name: "t", tileType: "MARKDOWN" }], dashboardFilter: {} };
    const v = diffDashboards(parseDashboard(before), parseDashboard(after)).variables;
    expect(v.managementZone[1]).toBeUndefined();     // removed
    expect(hasChanges(diffDashboards(parseDashboard(before), parseDashboard(after)))).toBe(true);
  });
});

describe("renderDiff", () => {
  it("summarizes metadata, added/removed/changed tiles", () => {
    const out = renderDiff(diffDashboards(parseDashboard(dev), parseDashboard(prod)));
    expect(out).toContain("~ owner:");
    expect(out).toContain("+ tile t3");
    expect(out).toContain("- tile t2");
    expect(out).toContain("query:");
  });
  it("says so when nothing changed", () => {
    expect(renderDiff(diffDashboards(parseDashboard(dev), parseDashboard(dev)))).toBe("No changes.");
  });

  it("leads with a summary and shows re-keyed tiles", () => {
    const before = { name: "D", tiles: [{ id: "old", name: "CPU", tileType: "DATA_EXPLORER", query: "q" }] };
    const after = { name: "D", tiles: [{ id: "new", name: "CPU", tileType: "DATA_EXPLORER", query: "q" }] };
    const out = renderDiff(diffDashboards(parseDashboard(before), parseDashboard(after)));
    expect(out).toContain("1 re-keyed");
    expect(out).toContain("» tile re-keyed old → new");
  });

  it("summarizes variable drift", () => {
    const before = { name: "D", tiles: [{ id: "a", name: "t", tileType: "MARKDOWN" }],
      variables: [{ key: "env", type: "csv", values: ["dev"] }] };
    const after = { name: "D", tiles: [{ id: "a", name: "t", tileType: "MARKDOWN" }],
      variables: [{ key: "env", type: "csv", values: ["prod"] }, { key: "region", type: "csv" }] };
    const out = renderDiff(diffDashboards(parseDashboard(before), parseDashboard(after)));
    expect(out).toContain("variable");
    expect(out).toContain("~ variable env");
    expect(out).toContain("+ variable region");
  });
});

describe("cli run()", () => {
  it("validate mode (one file) exits 1 on a high issue", () => {
    const r = run([JSON.stringify({ tiles: [] })]);
    expect(r.code).toBe(1);
    expect(r.output).toContain("no-tiles");
  });

  it("validate mode is clean on a good dashboard", () => {
    const r = run([JSON.stringify(dev)]);
    expect(r.code).toBe(0);
    expect(r.output).toContain("no issues");
  });

  it("diff mode renders a diff; --exit-code returns 1 on changes", () => {
    const a = JSON.stringify(dev), b = JSON.stringify(prod);
    expect(run([a, b]).code).toBe(0);                       // informational by default
    const r = run([a, b], { exitCode: true });
    expect(r.code).toBe(1);
    expect(r.output).toContain("+ tile t3");
  });

  it("diff mode --json emits the structured diff", () => {
    const parsed = JSON.parse(run([JSON.stringify(dev), JSON.stringify(prod)], { json: true }).output);
    expect(parsed.addedTiles[0].id).toBe("t3");
  });
});
