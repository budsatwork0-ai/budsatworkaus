---
type: "folder-index"
created: "2026-05-18T00:00:00Z"
---

# Deployments

Auto-generated deployment logs. One note per terminal deployment event (success, failure, error).

Written by the [[github-historian]] webhook handler when a `deployment_status` event arrives
from GitHub/Vercel with state `success`, `failure`, or `error`.

## Format

Each note contains:
- Environment (production / preview)
- SHA and branch
- Deployment URL
- Duration (if available)
- Rollback reference

## Rollback Reference

To roll back a failed deployment:
1. Find the last successful SHA in this folder
2. Run: `git revert <failed-sha>` or use Vercel dashboard → "Instant Rollback"
3. Push the revert to `main`
4. Log the rollback in [[Dev/Bug Tracker]]
