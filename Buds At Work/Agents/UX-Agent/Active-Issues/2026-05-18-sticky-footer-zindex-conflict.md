---
type: "issue"
workspace: "ux-agent"
status: "open"
severity: "medium"
systems:
  - "/*"
  - "Sticky Footer Persistent CTAs"
tags:
  - "issue"
  - "ux-agent"
  - "sticky-footer"
  - "mobile"
created: "2026-05-18T00:00:00Z"
---

# Issue: Sticky Footer Z-Index Conflicts with Modal Overlays

## Description

The site-wide sticky footer CTA bar uses a fixed z-index that, in some viewport/scroll combinations,
renders above modal dialogs and dropdown overlays. Observed on the admin dashboard's date-range
picker and on the quote wizard service-detail modals on mobile.

The glass-morphism `backdrop-filter: blur(...)` on the sticky element also triggers GPU compositing
on mid-range Android devices, causing noticeable scroll jank.

## Steps to Reproduce

1. Open `/dashboard` on a mid-range Android device or emulator
2. Click the date range picker in the reports tab
3. Observe sticky footer overlapping the calendar picker
4. Also check `/services` mobile — sticky footer hides the bottom step CTA

## Impact

Priority P2 — blocks date picker interaction on admin dashboard; contributes to CTA obscurance on
the quoting flow (see [[Quote Wizard — Primary CTA Below Fold on Mobile]]).

## Related

- [[/dashboard]]
- [[/services]]
- [[Quote Wizard — Primary CTA Below Fold on Mobile]]
