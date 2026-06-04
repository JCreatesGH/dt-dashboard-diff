import { describe, it, expect } from "vitest";
import { parseDashboard } from "./model";
import { validate } from "./validate";
import { diffDashboards, hasChanges } from "./diff";

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
});
