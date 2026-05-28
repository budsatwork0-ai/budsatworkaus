---
tags: [automation, roadmap, agents, planning]
---

# Bud Automation Roadmap

Overview of what is automated today and what's planned next.

---

## Currently automated

### Automation recipes (toggle in dashboard)
| Recipe | Status | Route |
|---|---|---|
| Auto-confirm bookings | Check `/dashboard/automations` | Marks order confirmed on payment |
| Quote follow-up | Check `/dashboard/automations` | Follow up on unacted quotes after N days |
| Crew assignment alert | Check `/dashboard/automations` | Notifies crew when assigned |

Recipes are stored in Supabase `site_settings` key-value table. No code deploy needed to toggle.

### Transactional emails (always on)
| Email | Trigger |
|---|---|
| Quote received | Customer submits wizard |
| Quote finalised | Admin creates payment link |
| Booking confirmed | Stripe payment completes |

### AI Agents (cron + manual)
30+ agents across: sales, support, ops, hiring, finance, compliance.  
See [[../../01 Architecture/Systems/Agent Runtime|Agent Runtime]] for the full list.

Key scheduled agents:
- `cash-flow-forecaster` — financial runway projection
- `scheduling` — job scheduling optimisation
- `whs-safety-reminder` — safety compliance prompts
- `ndis-compliance` — NDIS participant coordination checks
- `reviews` — Google review monitoring

---

## Planned / in progress

### Shop page
Gift cards, cleaning supply bundles, booking packages.  
Currently: "Coming soon" stub at `/shop`.  
No automation hooks yet.

### Google Reviews integration
Link: `https://g.page/r/CYTORrk6H3xmEAI/review`  
Agent `reviews` monitors review volume — next step is surfacing in dashboard.

### Household / shared view
Group finance and booking management for household accounts.  
Planned for Era Context integration.

---

## How to add a new automation recipe
1. Add a new key to `site_settings` via migration.
2. Define the recipe object in `src/app/(app)/dashboard/automations/page.tsx`.
3. Implement the trigger logic in the relevant API route or agent.
4. Update [[Automations Log]] with the new recipe and its status.

## Related
- [[Automations Log]]
- [[Claude Code Prompts/Graph Maintenance Prompt|Graph Maintenance Prompt]]
- [[../../01 Architecture/Systems/Agent Runtime|Agent Runtime]]
- [[../../01 Architecture/Systems/Mission Control|Mission Control]]
- [[../../01 Architecture/Systems/Email System|Email System]]
