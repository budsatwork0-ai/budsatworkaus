---
status: active
owner: Jackson
source_of_truth: this file
risk_level: medium
last_verified: 2026-05-27
applies_to: all new files and folders in the vault
---

# Naming Rules

Conventions for naming folders and files in the Buds at Work vault. Existing names that violate these rules are grandfathered; new content must comply.

## Folder names

### Root-level folders use numeric prefixes

The vault root uses the Buds OS scheme:

```
00 System Core/
01 Architecture/
02 Runtime Systems/
03 Active Refactors/
04 Claude Memory/
05 Automation/
06 Operations/
07 Business/
08 Generated Intelligence/
99 Archive/
```

The prefix forces Obsidian's alphabetical sort to match the intended reading order. The space (not a hyphen) between the number and the name is intentional — Obsidian renders this cleanly in the file tree.

`Agents/` and `Dev/` are deliberately unprefixed for now because their paths are hard-coded in shipped code. They will adopt the prefix scheme once the underlying code is refactored to read paths from configuration.

### Sub-folders use Title Case

Inside numbered roots, folder names are Title Case, no prefix:

```
01 Architecture/
├── Systems/
├── Components/
├── Refactor Plans/
└── Claude Memory/
```

### Reserved root names

- `_archive/` (repo root, not vault) — files moved out of active codebase
- `99 Archive/` (vault) — superseded or stale notes preserved for history
- `.obsidian/` — Obsidian's own state; never edit manually

## File names

### Permanent notes use Title Case with spaces

```
Pricing Engine.md
Quote Pipeline.md
Bud Core Runtime.md
```

The space-in-filename is Obsidian's native convention and reads cleanly in wikilinks.

### Dated notes use ISO format

```
Dev Log 2026-05-27.md
ADR-0001-use-pgvector-for-memory-semantic-search.md
```

The date always comes second in dev logs and first in ADRs (for sort order in the ADR index).

### Refactor plans use descriptive titles, no dates

```
Services Core Extraction.md
Next Safe Refactor Batches.md
Vault Restructure Plan.md
```

The plan's `last_verified` frontmatter carries the date; the filename stays stable across revisions.

### Generated outputs include a date suffix

AI-generated notes (agent findings, automated reports, graphify exports) must end with `-YYYY-MM-DD` so the freshness is visible at a glance:

```
admin-optimization-findings-2026-05-27.md
heatmap-report-2026-05-25.md
```

### Wikilink-friendly names

Avoid characters that confuse Obsidian's wikilink parser: `|`, `[`, `]`, `#`, and `^`. Hyphens, spaces, ampersands, and en-dashes are fine.

## Anti-patterns

- ❌ `Untitled.md` and any `Untitled <n>.md` — Obsidian artefacts that must be renamed or deleted on creation
- ❌ Lowercase-only folder names at root (`analytics/`, `bugs/`) — removed during Batch 0 of the restructure
- ❌ Date-prefixed root files (`2026-05-25.md`) — daily notes live inside their domain folder (`Dev/Dev Log YYYY-MM-DD.md`)
- ❌ Trailing whitespace, double spaces, or em-dashes in filenames

## Related

- [[Vault Constitution]]
- [[Metadata Rules]]
- [[Archive Policy]]
