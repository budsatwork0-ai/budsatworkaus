---
type: "issue"
workspace: "ux-agent"
status: "open"
severity: "high"
systems:
  - "/services"
  - "Quote Wizard"
tags:
  - "issue"
  - "ux-agent"
  - "quoting-flow"
  - "mobile"
created: "2026-05-18T00:00:00Z"
---

# Issue: Quote Wizard — Primary CTA Below Fold on Mobile (375px)

## Description

On iPhone SE and similar 375×667 viewports, the "Get Quote" / step-advance CTA in the quote wizard
(`/services`) is rendered below the visible fold when the service selector list is expanded. Users
on these devices must scroll to reach the button, and many do not — creating silent abandonment.

The issue is compounded by the sticky site footer occupying ~56px of bottom space, leaving even less
visible area for the wizard content on small screens.

## Steps to Reproduce

1. Open `/services` on a 375×667 mobile viewport (Chrome DevTools or real device)
2. Select a service category (e.g. Cleaning)
3. Observe that the step-advance CTA ("Next" / "Get Quote") is not visible without scrolling
4. Check the sticky site footer is covering the bottom portion

## Impact

Priority P1 — directly affects quote start rate on mobile. Mobile represents the primary acquisition
channel for residential customers in Logan & South Brisbane.

## Related

- [[/services]]
- [[Quote Wizard]]
- [[Sticky Footer Persistent CTAs]]
