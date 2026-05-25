# Services Core Extraction

## Highest-risk files
- src/app/(public)/services/page.tsx
- pricing/engine.ts
- estimation.ts
- useAssistant.ts
- flow.ts
- yardPricing.ts
- routing/index.ts

## Goal
Extract business logic from UI orchestration.

## Phase 1
Move:
- pricing constants
- yard pricing
- route calculations
- estimation helpers
- pure utility functions

## Rule
No broad UI rewrites.
Only surgical extractions.

## Related

- [[ServicesPageContent]] — the component being refactored (source of extracted logic)
- [[useRouteResult]] — route calculation hook extracted in Phase 1
- [[Route Service]] — underlying routing/distance lib
- [[Pricing Engine]] — pricing engine that estimation helpers feed into
- [[Bud Core Runtime]] — long-term home for extracted runtime logic
- [[00-Index/Home|Home]] — listed under Refactor Plans
