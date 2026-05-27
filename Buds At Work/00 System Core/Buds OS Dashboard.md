---
status: active
owner: Jackson
source_of_truth: this file (manually curated)
risk_level: medium
last_verified: 2026-05-27
purpose: the single canonical operational view for the Buds at Work engineering system
update_cadence: weekly (every Monday) + whenever a refactor batch ships
---

# Buds OS Dashboard

The one place to start when you want to know the state of the system. Pinned in Obsidian, kept short on purpose.

If a section grows past one screen of reading, it belongs in its own dedicated note linked from here.

---

## Right now

- **Active branch:** `vault/restructure-batch-0` (carries Batches 0 + 1 of the vault restructure; not yet merged to `main`)
- **Restructure progress:** 2 of 5 batches complete
  - ✅ Batch 0 — pure cleanup (committed `32e0d79`)
  - ✅ Batch 1 — governance scaffolding (committed `5a2ebcf`)
  - ⏸️ Batch 2 — Buds OS Dashboard (in flight — this file)
  - ⏸️ Batch 3 — `99 Archive/` scaffolding (in flight)
  - ⏳ Batch 4 — architecture rename (medium risk, awaiting review)
  - ⏳ Batch 5 — Agents migration (gated on code refactor)
- **Plan source:** [[../architecture/Refactor Plans/Vault Restructure Plan|Vault Restructure Plan]]

---

## Architecture entry points

- [[../architecture/00 Start Here|00 Start Here]] — the vault's architecture tour
- [[../architecture/Systems/Bud Core Runtime|Bud Core Runtime]] — operational truth engine
- [[../architecture/Systems/Agent Runtime|Agent Runtime]] — AI agent execution layer
- [[../architecture/Systems/Pricing Engine|Pricing Engine]] — single source of truth for quote amounts
- [[../architecture/Systems/Quote Pipeline|Quote Pipeline]] — server-side quote → checkout → webhook
- [[../architecture/Systems/Mission Control|Mission Control]] — aggregated operational health
- [[../architecture/Systems/NDIS Matching|NDIS Matching]] — participant matching and scoring

---

## Active refactors

| Refactor | Status | Note |
| --- | --- | --- |
| Vault Restructure | in-flight (Batches 0 + 1 shipped) | [[../architecture/Refactor Plans/Vault Restructure Plan]] |
| Services Core Extraction | planned | [[../architecture/Refactor Plans/Services Core Extraction]] |
| Next Safe Refactor Batches | planned | [[../architecture/Refactor Plans/Next Safe Refactor Batches]] |

Known unsafe areas to avoid refactoring without explicit approval: [[../architecture/Refactor Plans/Known Unsafe Areas|Known Unsafe Areas]].

---

## Governance

- [[Governance/Vault Constitution|Vault Constitution]] — the master doc
- [[Governance/Naming Rules|Naming Rules]]
- [[Governance/Metadata Rules|Metadata Rules]]
- [[Governance/Claude Memory Rules|Claude Memory Rules]]
- [[Governance/Generated Output Rules|Generated Output Rules]]
- [[Governance/Archive Policy|Archive Policy]]
- [[Governance/Refactor Doc Standards|Refactor Doc Standards]]

---

## Graph health

- Latest report: [[../architecture/Graphify/GRAPH_REPORT|GRAPH_REPORT]]
- Live graph viewer: [[../architecture/Graphify/budsatwork-callflow|Call-flow viewer (HTML)]]
- Maintenance cadence: scheduled via [[../Automation/Bud Automation Roadmap|Bud Automation Roadmap]]
- Health agent: [[../Agents/Graph-Health-Agent|Graph-Health-Agent]]

Run `graphify update .` after any code change. Run `graphify query "<question>"` for scoped subgraph lookups instead of raw grep.

---

## Agent runtime

The fleet runs through `src/lib/agents/` and writes findings into per-agent folders under `Agents/`. Each agent has its own subfolder.

| Agent | Workspace | Active issues file count |
| --- | --- | --- |
| Admin | [[../Agents/Admin-Agent/README\|Admin-Agent]] | check `Agents/Admin-Agent/Active-Issues/` |
| Analytics | [[../Agents/Analytics-Agent/README\|Analytics-Agent]] | check `Agents/Analytics-Agent/Active-Issues/` |
| Design System | [[../Agents/Design-System-Agent/README\|Design-System-Agent]] | check `Agents/Design-System-Agent/Active-Issues/` |
| Frontend | [[../Agents/Frontend-Agent/README\|Frontend-Agent]] | check `Agents/Frontend-Agent/Active-Issues/` |
| Meta | [[../Agents/Meta-Agent/README\|Meta-Agent]] | check `Agents/Meta-Agent/Active-Issues/` |
| Performance | [[../Agents/Performance-Agent/README\|Performance-Agent]] | check `Agents/Performance-Agent/Active-Issues/` |
| UX | [[../Agents/UX-Agent/README\|UX-Agent]] | check `Agents/UX-Agent/Active-Issues/` |
| Graph Health | [[../Agents/Graph-Health-Agent\|Graph-Health-Agent]] | n/a (single-file agent) |

Each agent's folder is a write target in shipped code — never rename without a coordinated refactor (see Batch 5 of the Vault Restructure Plan).

---

## ADRs

- Latest ADR: [[../Dev/ADR-0001-use-pgvector-for-memory-semantic-search\|ADR-0001]] — Use pgvector for memory semantic search (2026-05-17)
- Index: [[../Dev/ADR-Index|ADR-Index]]
- Drafts in flight: `Dev/ADR-Drafts/` (written by `github-historian.ts`)

---

## Recent dev logs

- [[../Dev/Dev Log 2026-05-27|2026-05-27]] (today)
- [[../Dev/Dev Log 2026-05-26|2026-05-26]]
- [[../Dev/Dev Log 2026-05-25|2026-05-25]]
- [[../Dev/Dev Log 2026-05-24|2026-05-24]]

Older logs visible in the `Dev/` folder. Logs older than 90 days move to `99 Archive/Dev Logs/` per the [[Governance/Archive Policy|Archive Policy]].

---

## Operations

Day-to-day execution lives outside this dashboard. Entry points:

- [[../Admin/Admin|Admin command centre]] — all 12 operational domains
- [[../Processes/Quote Flow|Quote Flow]] — wizard → API → database
- [[../Processes/Stripe Checkout|Stripe Checkout]] — checkout, webhooks, order lifecycle
- [[../SOPs/New Booking|New Booking SOP]]
- [[../SOPs/Refund Process|Refund Process SOP]]
- [[../SOPs/Failed Payment|Failed Payment SOP]]

---

## External

- Admin dashboard: `/dashboard`
- Crew portal: `/crew`
- Client portal: `/portal`
- Stripe: [dashboard.stripe.com](https://dashboard.stripe.com)
- Supabase: [supabase.com/dashboard](https://supabase.com/dashboard)
- Resend: [resend.com](https://resend.com)

---

## Owner contract

This dashboard is hand-curated. AI agents do not write to it. If a section drifts from reality:

1. Update the section here
2. Bump `last_verified` in the frontmatter
3. Commit with `vault: dashboard refresh — <what changed>`

If a section keeps drifting, it belongs in a generated view instead — and this dashboard should link to that view rather than embed it.
