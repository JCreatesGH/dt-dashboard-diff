# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [0.2.0]

### Added
- **Tile re-key detection** — a removed + added pair with identical content
  (name/type/query) is now reported as a single moved tile (`diff.movedTiles`,
  `» tile re-keyed old → new`) instead of a noisy add+remove. Cuts the noise
  when tile ids churn across re-exports or classic→Platform migrations.
- `renderDiff` now leads with a one-line summary (`1 added, 1 removed,
  1 re-keyed, …`).
- New `duplicate-tile-name` validation rule.

## [0.1.0]

### Added
- Tolerant dashboard parser (classic + Platform shapes), `diffDashboards`
  (metadata + added/removed/changed tiles), `validate` (no-name, no-tiles,
  duplicate-tile-id, unknown-tile-type, empty-query), `renderDiff`, and a
  `dt-dashboard-diff` CLI (validate / diff, `--json`, `--exit-code`).
