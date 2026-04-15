# Automations Log

Tracks which automation recipes are currently enabled in site settings.

**Managed via:** `/dashboard/automations`  
**Stored in:** Supabase `site_settings` key-value table  
**File:** `src/app/(app)/dashboard/automations/page.tsx`

---

## Current Recipes

| Recipe | Status | Description |
|---|---|---|
| Auto-confirm bookings | Check dashboard | Auto-set order to confirmed on payment |
| Quote follow-up | Check dashboard | Follow up on unacted quotes after N days |
| Crew assignment alert | Check dashboard | Notify crew when assigned to a job |

> Update this table whenever you enable/disable a recipe in the dashboard.

---

## How to Enable/Disable
1. Go to `/dashboard/automations`
2. Toggle the recipe on/off
3. Update the table above with the new status and date

---

## Adding New Recipes
New automation recipes are defined in:  
`src/app/(app)/dashboard/automations/page.tsx`

Each recipe:
- Has a unique key stored in `site_settings`
- Can be toggled via the admin UI
- Does NOT require a code deploy to enable/disable

---

## Related
- [[Checklist Template]]
- [[Quote Flow]]
- [[Email Triggers]]
- [[New Booking]]
