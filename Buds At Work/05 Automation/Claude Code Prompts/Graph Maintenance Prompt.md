---
tags: [automation, prompt, graphify, maintenance]
---

# Graph Maintenance Prompt

Use this prompt with Claude Code to run a full architecture graph maintenance pass.

---

## Prompt

```
Run architecture graph maintenance.

Inspect:
- Buds At Work/
- graphify-out/GRAPH_REPORT.md
- architecture/Systems/
- architecture/Components/
- architecture/Refactor Plans/
- Processes/
- SOPs/
- Agents/

Tasks:
1. Find orphan notes (no incoming or outgoing wikilinks).
2. Detect unresolved wiki-links (target note doesn't exist).
3. Detect weak graph clusters (notes with fewer than 2 connections).
4. Connect runtime systems to processes.
5. Connect architecture notes to operational notes.
6. Strengthen important hubs:
   - 00 Start Here
   - Bud Core Runtime
   - Mission Control
   - Agent Runtime
   - Graphify Overview
7. Reduce graph fragmentation.
8. Prefer semantic relationships only.

Rules:
- append only
- do not delete notes
- keep notes beginner-readable
- avoid fake relationships

After changes:
- summarise graph improvements
- explain new architecture relationships
- list any orphan notes that could not be connected
```

---

## When to run
- After a major feature addition (new system, new agent category)
- After reorganising vault folders
- When `graphify update .` reveals new community clusters
- Monthly as part of the Continuous Learning Loop review

## Related
- [[../Graphify/Graphify Overview|Graphify Overview]]
- [[../../01 Architecture/00 Start Here|Architecture Start Here]]
- [[../Automations Log]]
- [[../Bud Automation Roadmap]]
