---
type: "system-documentation"
created: "2026-05-18T00:00:00Z"
tags:
  - github
  - automation
  - obsidian
  - webhook
  - deployment
---

# GitHub → Obsidian Automation

Automatic documentation system that captures every meaningful GitHub event as
a structured Obsidian note and indexes it in the Supabase memory graph.

## How It Works

```
GitHub Event
    │
    ▼
.github/workflows/obsidian-events.yml   ← GitHub Actions (HMAC-signed POST)
    │
    ▼
/api/webhooks/github                     ← Next.js webhook handler
    │                                      · verifies signature
    │                                      · logs to github_events table
    │                                      · calls writeMemory()
    ▼
memory_documents (Supabase)              ← searchable, embedded, freshness-scored
    │
    ▼
vault sync                               ← periodic sync writes .md files
    │
    ▼
Obsidian vault (Dev/)                    ← readable, linkable, searchable
```

## Event → Note Mapping

| GitHub Event | Trigger | Vault Path | Memory Category |
|---|---|---|---|
| `pull_request` opened/merged | PR state change | `Dev/PRs/YYYY-MM-DD-pr-NNN-slug.md` | `deployments` / `bugs` / `architecture` |
| `push` to `main` | Every push | `Dev/Journal/YYYY-MM-DD-push-sha.md` | varies by commit type |
| `deployment_status` success/failure | Vercel deploy | `Dev/Deployments/YYYY-MM-DD-deploy-env-sha.md` | `deployments` |
| `release` published | Git tag release | `Dev/Releases/YYYY-MM-DD-release-tag.md` | `architecture` |
| ADR flag (internal) | Arch PR merged | `Dev/ADR-Drafts/YYYY-MM-DD-draft-slug.md` | `architecture` |

## Weekly Synthesis

The `github-historian` agent runs **every Friday at 6 am** and:
1. Reads all memory documents written by the webhook handler this week
2. Synthesises an implementation timeline
3. Detects architectural changes needing ADR documentation
4. Identifies recurring bug patterns
5. Assesses deployment/rollback readiness
6. Writes a weekly summary to `Dev/Journal/YYYY-MM-DD-weekly-timeline.md`

## Change Classification

Commits and PRs are classified automatically using:
- **Conventional commit prefixes** (`feat:`, `fix:`, `refactor:`, `arch:`, etc.)
- **File-path heuristics** (`supabase/migrations/` → database, `src/lib/agents/` → agent)
- **PR labels** (override heuristics when present)

Classification → memory category:
- `bug-fix` → `bugs`
- `architecture` / `database` → `architecture`
- `ui` → `design`
- everything else → `deployments`

## Setup Instructions

1. Add secrets to GitHub repository (Settings → Secrets → Actions):
   - `BUDS_WEBHOOK_URL` = `https://budsatwork.com/api/webhooks/github`
   - `BUDS_WEBHOOK_SECRET` = same value as `GITHUB_WEBHOOK_SECRET` in Vercel

2. Add `GITHUB_WEBHOOK_SECRET` to Vercel environment variables

3. In GitHub repository settings → Webhooks, the Actions workflow handles
   delivery automatically — no manual webhook setup needed

## Vault Structure

```
Dev/
├── GitHub-Automation.md      ← this file
├── ADR-Index.md              ← all accepted ADRs
├── ADR-Drafts/               ← drafts pending review + numbering
├── PRs/                      ← one note per PR (open + merged)
├── Deployments/              ← one note per production/preview deploy
├── Journal/                  ← push entries + weekly timelines
├── Releases/                 ← one note per published release
├── Bug Tracker.md            ← manual bug tracker (linked from auto notes)
└── Dev Log YYYY-MM-DD.md     ← session logs from vault-log.ts hook
```

## Related

- [[ADR-Index]]
- [[Bug Tracker]]
- [[github-historian]]
- [[/api/webhooks/github]]
