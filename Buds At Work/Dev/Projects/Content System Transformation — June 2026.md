# Bud OS V4 Content System Transformation

Status: Architecture review pending approval
Date: 2026-06-22
Owner: Product / Growth / Engineering

## 1. Architecture Review

### Current State

The current content ecosystem is organised around tools:

- Story Engine: narrative memory, journal, story bible, characters, arcs, open threads, current chapter, opportunities.
- Research Lab: trend and format intelligence, currently a destination.
- Content Studio: ideas, scripts, production board, asset library.
- Marketing layer: publishing queue, campaign manager, distribution playbooks, social channels.
- Growth HQ: read-only growth overview and validation funnel.

The underlying data model is stronger than the current UX. Story opportunities already have source metadata, confidence, scoring, categories, and draft counts. Research trends already support platform, urgency, adaptation angle, and adaptation score. Content ideas, scripts, production cards, content assets, publishing queue items, and campaigns already exist as separable workflow records.

The main architectural problem is that users must choose a tool before the system has framed the outcome. The product asks "Where do you want to work?" when it should ask "What should we create right now?"

### Target State

Replace the visible content IA with:

```text
Content
├── Campaign Factory
├── Story Intelligence
└── Content Library
```

The old systems become internal capability layers:

- Story Engine becomes Story Intelligence.
- Research Lab becomes Research Service.
- Content Studio becomes Generation / Production Service.
- Content Vault, generated assets, published content, campaign history, and performance become Content Library.

### System Boundary Decisions

Campaign Factory is the orchestration layer. It owns the user workflow from goal selection through approval and publishing.

Story Intelligence is the narrative brain. It recommends stories and explains why. It should not be the main place where users generate content.

Research is not a product destination. It is a service called by Campaign Factory and Story Intelligence.

Artifacts are first-class records. Ideas, scripts, HTML previews, reports, landing page drafts, story briefs, quotes, and dashboards should be generated into artifact versions, not scattered as transient text fields.

Content Library is the source of truth for finished and reusable content records, including generated artifacts, production assets, published posts, campaign outcomes, and historical versions.

## 2. Product Requirements Document

### Product Goal

The content system must answer:

"What should we create right now?"

### Primary Users

- Founder / operator deciding what to communicate today.
- Marketing manager planning growth activity.
- Creative operator approving content before publication.
- Future agents generating recommendations, drafts, and reports.

### Core Outcomes

- Generate leads.
- Raise donations.
- Build trust.
- Recruit participants.
- Recruit customers.
- Promote services.
- Tell the Buds At Work story.
- Grow social audience.

### Primary Product Requirements

1. Content home defaults to Campaign Factory.
2. Users start with a goal, not a tool.
3. The system recommends the strongest story for today with a score, rationale, supporting signals, and next action.
4. Campaign Factory gathers Story Intelligence, research findings, strategy, generated assets, previews, and publishing actions into one workflow.
5. Research findings are consumed inside the workflow, not managed as a separate user journey.
6. Every major workflow can produce an artifact.
7. Artifacts can be approved, rejected, revised, versioned, and stored.
8. Content Library provides one searchable view of assets, generated artifacts, published content, campaign history, status, and performance.
9. Existing consent and safety constraints remain enforceable, especially character boundaries and content asset consent.
10. The user makes decisions; the system does the collection, analysis, drafting, and visualisation.

### Non-Goals For Phase 1

- No publishing automation without explicit approval.
- No removal of existing data tables.
- No public-facing artifact hosting until artifact safety and access controls are approved.
- No agent write access to protected narrative sources like Story Bible without explicit human-controlled workflows.

## 3. User Flows

### Flow A: Recommended Story To Campaign

```text
Content Home
↓
Story Intelligence recommendation
↓
Review "Why this story now?"
↓
Generate Campaign
↓
Campaign Factory goal confirmation
↓
Research + strategy + artifact generation
↓
Preview artifacts
↓
Approve selected assets
↓
Schedule / publish
↓
Content Library records final campaign and artifacts
```

### Flow B: Goal-Led Campaign Creation

```text
Campaign Factory
↓
Select goal: Generate Leads / Raise Donations / Build Trust / etc.
↓
System ranks story opportunities, campaigns, trends, jobs, leads, fundraising, reviews
↓
User chooses recommended direction or another candidate
↓
System generates campaign strategy artifact
↓
System generates deliverable artifacts
↓
User approves, edits, or asks for revision
↓
Publishing queue / landing page / asset production records are created
```

### Flow C: Story Intelligence Daily Brief

```text
Story Intelligence
↓
Daily recommendation list
↓
Open recommended story brief artifact
↓
Inspect signals: journal, arcs, open threads, customer activity, fundraising, reviews, jobs, leads
↓
Accept story direction
↓
Send to Campaign Factory
```

### Flow D: Content Library Retrieval

```text
Content Library
↓
Search or filter by campaign, platform, status, artifact type, tag, performance
↓
Open artifact or asset
↓
Review version history, source signals, approvals, published outputs, performance
↓
Reuse, clone, revise, or archive
```

## 4. Database Requirements

### New Core Tables

#### artifacts

Canonical record for generated deliverables.

Suggested columns:

- id uuid primary key
- type text not null
- title text not null
- summary text not null default ''
- status text not null default 'draft'
- score numeric null
- metadata jsonb not null default '{}'
- source_context jsonb not null default '{}'
- latest_version_id uuid null
- created_by uuid null
- approved_by uuid null
- approved_at timestamptz null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Allowed types should initially include:

- campaign
- research
- strategy
- story
- executive
- quote
- landing_page
- marketing
- dashboard
- storyboard

#### artifact_versions

Immutable version history.

Suggested columns:

- id uuid primary key
- artifact_id uuid not null references artifacts(id)
- version_number integer not null
- schema_version text not null
- title text not null
- summary text not null
- content jsonb not null default '{}'
- html text null
- plain_text text null
- renderer text not null default 'artifact_renderer'
- render_policy jsonb not null default '{}'
- generation_input jsonb not null default '{}'
- generation_model text null
- checksum text not null
- created_at timestamptz not null default now()

#### campaign_factory_runs

Tracks orchestration state.

Suggested columns:

- id uuid primary key
- goal text not null
- status text not null default 'draft'
- selected_story_opportunity_id uuid null references story_opportunities(id)
- campaign_id uuid null references marketing_campaigns(id)
- current_step text not null default 'goal'
- signals jsonb not null default '{}'
- research_summary jsonb not null default '{}'
- strategy jsonb not null default '{}'
- artifact_ids uuid[] not null default '{}'
- approval_state jsonb not null default '{}'
- created_by uuid null
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

#### content_library_items

Unified index over assets, artifacts, published outputs, campaigns, and queue items.

Suggested columns:

- id uuid primary key
- item_type text not null
- source_table text not null
- source_id uuid not null
- title text not null
- summary text not null default ''
- campaign_id uuid null references marketing_campaigns(id)
- artifact_id uuid null references artifacts(id)
- platform text null
- status text not null
- tags text[] not null default '{}'
- performance jsonb not null default '{}'
- searchable_text text not null default ''
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

### Existing Tables To Reuse

- founder_journal_entries
- story_bible_sections
- story_characters
- story_arcs
- story_open_threads
- story_chapters
- story_opportunities
- research_trends
- content_ideas
- content_scripts
- content_production_cards
- content_assets
- marketing_publishing_queue
- marketing_campaigns
- marketing_distribution_playbooks
- marketing_social_channels
- fundraising campaigns and contributions
- orders, quotes, reviews, leads, social proof, growth pipeline events

### Migration Principles

- Add new tables first.
- Keep existing routes operational during transition.
- Add compatibility links from existing records to artifacts and campaign runs.
- Backfill Content Library items from existing assets, queue items, campaigns, and published records.
- Gradually hide old destinations from navigation after Campaign Factory can cover their core jobs.

## 5. API Requirements

### Story Intelligence APIs

- GET /api/story-intelligence/recommendations
  - Returns ranked story recommendations with score, rationale, source signals, and suggested goals.
- GET /api/story-intelligence/brief/:id
  - Returns or creates a Story Brief Artifact for a recommendation.
- POST /api/story-intelligence/analyse
  - Service/admin endpoint to refresh story signal analysis.

### Campaign Factory APIs

- POST /api/campaign-factory/runs
  - Creates a run from a goal and optional story recommendation.
- GET /api/campaign-factory/runs/:id
  - Loads workflow state, signals, research, strategy, artifacts, and approvals.
- POST /api/campaign-factory/runs/:id/research
  - Runs the research service for the selected goal/story.
- POST /api/campaign-factory/runs/:id/strategy
  - Generates strategy artifact and campaign plan.
- POST /api/campaign-factory/runs/:id/artifacts
  - Generates selected artifact types.
- POST /api/campaign-factory/runs/:id/approve
  - Approves specific artifact versions and creates downstream records.
- POST /api/campaign-factory/runs/:id/publish
  - Creates or updates publishing queue items. Direct publishing remains gated.

### Artifact APIs

- GET /api/artifacts
  - Search/filter artifacts.
- POST /api/artifacts
  - Create artifact shell.
- GET /api/artifacts/:id
  - Read artifact and latest version.
- POST /api/artifacts/:id/versions
  - Add immutable version.
- POST /api/artifacts/:id/approve
  - Approve latest or selected version.
- POST /api/artifacts/:id/revise
  - Generate revision from instruction.

### Content Library APIs

- GET /api/content-library
  - Unified search with tags, campaign, platform, status, type, performance filters.
- GET /api/content-library/:id
  - Source-linked detail view.
- POST /api/content-library/reindex
  - Admin/service endpoint to rebuild library index.

## 6. Component Architecture

### New Top-Level Routes

```text
/dashboard/content
/dashboard/content/campaign-factory
/dashboard/content/campaign-factory/[runId]
/dashboard/content/story-intelligence
/dashboard/content/library
/dashboard/content/library/[itemId]
/dashboard/content/artifacts/[artifactId]
```

### Route Transition

Legacy routes can remain but move out of primary navigation:

- /dashboard/story-engine -> redirect or alias to /dashboard/content/story-intelligence
- /dashboard/research-lab -> service/admin view only
- /dashboard/content-studio -> production/admin view only

### Components

Campaign Factory:

- GoalSelector
- CampaignRunShell
- SignalStack
- StoryRecommendationCard
- ResearchFindingsPanel
- StrategyBriefPanel
- ArtifactPicker
- ApprovalRail
- PublishPlanPanel

Story Intelligence:

- DailyStoryRecommendation
- SignalScoreBreakdown
- StoryCandidateList
- StoryBriefArtifactLauncher
- NarrativeSourceMap

Content Library:

- LibrarySearch
- LibraryFilters
- LibraryResultGrid
- LibraryItemDetail
- VersionTimeline
- PerformanceSummary

Artifacts:

- ArtifactRenderer
- ArtifactFrame
- ArtifactToolbar
- ArtifactVersionSwitcher
- ArtifactApprovalControls
- ArtifactSafetyBoundary

Shared:

- OutcomeHeader
- NextDecisionPanel
- SourceSignalList
- ConfidenceScore
- HumanApprovalGate

### UX Rules

- Screens are organised around recommendations, decisions, artifacts, and outcomes.
- The primary CTA should answer "What should happen next?"
- Forms are secondary and contextual.
- Tables are acceptable inside Content Library but not as the primary Campaign Factory experience.
- Every generated output should have a visible preview before approval.

## 7. Artifact Engine Design

### Artifact Contract

```ts
interface Artifact {
  id: string;
  type: string;
  title: string;
  summary: string;
  score?: number;
  metadata?: Record<string, unknown>;
  html?: string;
  createdAt: string;
}
```

The production contract should extend this with:

```ts
type ArtifactStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived';

interface ArtifactVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  schemaVersion: string;
  content: Record<string, unknown>;
  html?: string;
  plainText?: string;
  renderPolicy: {
    mode: 'structured' | 'sanitized_html' | 'iframe';
    allowedBlocks?: string[];
    allowExternalAssets: boolean;
  };
  checksum: string;
  createdAt: string;
}
```

### Generation Pipeline

```text
Workflow context
↓
Signal collection
↓
Research service
↓
Reasoning / strategy generation
↓
Artifact schema generation
↓
Safe render transform
↓
Artifact version stored
↓
Preview rendered
↓
Human approval
↓
Downstream records created
```

### Rendering Strategy

Use a tiered rendering approach.

Structured artifacts are preferred. Reports, story briefs, strategies, dashboards, and quotes should render from JSON blocks using first-party React components.

Sanitized HTML is allowed for marketing and landing-page previews. HTML must be sanitized server-side and client-side, strip scripts, event handlers, unsafe URLs, inline JS, and uncontrolled external resources.

Iframe rendering is reserved for rich landing pages and high-risk HTML previews. Use sandbox attributes, no same-origin unless required, no scripts by default, and an explicit allowlist for capabilities.

Do not render arbitrary generated HTML directly into the app shell with unrestricted dangerouslySetInnerHTML.

### Versioning

- Every generation creates a new artifact_version.
- Artifact records point to latest_version_id.
- Approval targets a specific version.
- Publishing and campaign records store approved artifact_version_id, not just artifact_id.
- Revisions never mutate old versions.

### Storage

- Store structured content in jsonb.
- Store HTML preview in artifact_versions.html.
- Store generated images or large binaries in object storage and reference them from content JSON.
- Store generation input and source context for auditability.
- Store checksums to detect accidental mutation.

### Artifact Types In Phase 1

1. Story Brief Artifact
2. Campaign Artifact
3. Strategy Artifact
4. Research Artifact
5. Marketing Artifact

Later expansion:

- Executive Report Artifact
- Situation Room Artifact
- Customer Quote Artifact
- Landing Page Artifact
- Dashboard Artifact
- Storyboard Artifact

## 8. Risks, Dependencies, Constraints

### Risks

- Scope creep: artifact support can expand into a general website builder unless Phase 1 is tightly scoped.
- Safety: arbitrary HTML rendering can introduce XSS or data leakage if not sandboxed.
- Data duplication: Content Library can become another source of truth unless implemented as an index over source records.
- User trust: opaque recommendations will feel magical but not credible unless every score explains the source signals.
- Consent: Story Intelligence must respect character and asset consent before generating public-facing content.
- Navigation churn: renaming routes without redirects can break existing workflows and tests.

### Dependencies

- Supabase migrations and RLS policies for artifact and campaign run tables.
- Existing service client patterns.
- Existing story opportunity scoring and detection.
- Existing research trend adaptation scoring.
- Existing publishing queue consent constraints.
- Existing Growth HQ metrics and pipeline event data.
- Sanitization library already available through dompurify dependency.

### Technical Constraints

- Next.js App Router with client-heavy dashboard pages.
- Supabase is the operational database.
- Current database types are manually maintained and likely incomplete.
- Existing content APIs are route-per-resource and should be preserved during transition.
- Some current UI links use legacy naming and will need redirects/aliases.

## 9. Implementation Batches After Approval

### Batch 1: Foundations

- Add artifact and campaign_factory_runs tables.
- Add TypeScript artifact types.
- Add ArtifactRenderer with structured and sanitized HTML modes.
- Add artifact API routes.
- Add basic artifact detail page.

### Batch 2: Story Intelligence

- Rename visible Story Engine to Story Intelligence.
- Build recommendation API from existing story opportunities and signals.
- Add Story Intelligence home answering "What should we talk about today?"
- Add Story Brief Artifact generation.

### Batch 3: Campaign Factory MVP

- Add goal-led Campaign Factory home.
- Add run creation and run detail shell.
- Integrate Story Intelligence recommendation selection.
- Generate Campaign, Research, and Strategy artifacts.
- Add approval gates.

### Batch 4: Content Library

- Add content_library_items index.
- Backfill from content assets, publishing queue, campaigns, and artifacts.
- Build unified search and filters.
- Add source-linked detail views.

### Batch 5: Publishing Integration

- From approved Campaign Artifacts, create content ideas, scripts, production cards, and queue items.
- Preserve manual approval before publishing.
- Link published outputs back to campaigns and artifact versions.

### Batch 6: Legacy Navigation Cleanup

- Move Research Lab and Content Studio out of primary navigation.
- Add redirects/aliases.
- Update tests and dashboard navigation.
- Keep admin/service views available for debugging and manual override.

## 10. Approval Questions

1. Should Campaign Factory be the default `/dashboard/content` page, or should `/dashboard/content` show a compact command center with Campaign Factory as the primary CTA?
2. Should Phase 1 artifacts support sanitized HTML immediately, or should the first batch use structured React-rendered artifacts only?
3. Should the first Campaign Factory MVP generate downstream content ideas/scripts automatically after approval, or stop at campaign artifacts until the artifact engine is proven?
4. Should Content Library be implemented as an indexed table immediately, or start as a read-only federated search over existing tables?
5. Which artifact type should be the flagship demo: Campaign Artifact, Story Brief Artifact, or Landing Page Artifact?

## 11. Approved Decisions

Approved on 2026-06-22:

- Campaign Factory becomes the default Content homepage.
- Phase 1 artifacts are structured React-rendered artifacts only.
- No arbitrary generated HTML in Phase 1.
- Campaign Factory stops at artifact approval initially.
- No automatic downstream content creation until artifacts are validated.
- Content Library uses the indexed table approach from the beginning.
- Campaign Artifact is the flagship artifact type.

## 12. Batch 1 Detailed Execution Plan

### Goal

Build the Artifact Engine foundation that future Content, Growth, Executive, Mission Control, Quote, and Campaign Factory workflows can depend on.

Batch 1 should create stable persistence, type contracts, route handlers, and a structured renderer. It should not generate arbitrary HTML, publish content, or create downstream content records after approval.

### Scope

In scope:

- `artifacts` table.
- `artifact_versions` table.
- `campaign_factory_runs` table.
- Campaign-run to artifact link table.
- `content_library_items` indexed table.
- TypeScript artifact and campaign factory contracts.
- Artifact APIs.
- Campaign Factory run APIs.
- Structured React `ArtifactRenderer`.
- RLS policies.
- Migration and rollback documentation.

Out of scope:

- HTML artifacts.
- iframe rendering.
- generated landing page execution.
- automatic content idea, script, production card, or publishing queue creation.
- model-driven generation endpoints.
- public artifact sharing.

### Data Model Plan

`artifacts` is the mutable artifact shell. It stores identity, type, approval state, score, metadata, source context, and `latest_version_id`.

`artifact_versions` is immutable. Every revision inserts a new version row. Approval targets a specific version.

`campaign_factory_runs` stores orchestration state for goal-led Campaign Factory sessions. It may point to an existing `marketing_campaigns` row later, but Batch 1 does not create campaign records automatically.

`campaign_factory_run_artifacts` links runs to generated/approved artifacts without using array columns as the primary relationship.

`content_library_items` is an index over source records. Batch 1 creates the table and supports artifact indexing. Later batches will backfill assets, publishing queue items, campaigns, and performance records.

### API Plan

Artifact endpoints:

- `GET /api/artifacts`
  - Admin-only.
  - Supports filtering by type, status, and source campaign factory run.
  - Returns artifacts with latest version metadata.
- `POST /api/artifacts`
  - Admin-only.
  - Creates artifact shell plus first immutable version in one request.
  - Optionally links to a Campaign Factory run.
  - Indexes the artifact into `content_library_items`.
- `GET /api/artifacts/[id]`
  - Admin-only.
  - Returns artifact, latest version, and all versions.
- `PUT /api/artifacts/[id]`
  - Admin-only.
  - Updates shell metadata/status only.
  - Does not mutate versions.
- `POST /api/artifacts/[id]/versions`
  - Admin-only.
  - Adds a new immutable structured version.
  - Updates `latest_version_id`.
  - Re-indexes library item.
- `POST /api/artifacts/[id]/approve`
  - Admin-only.
  - Approves a specific version or latest version.
  - Updates approval fields and library status.
  - Does not create downstream content records.

Campaign Factory run endpoints:

- `GET /api/campaign-factory/runs`
  - Admin-only.
  - Lists runs.
- `POST /api/campaign-factory/runs`
  - Admin-only.
  - Creates a run from a goal and optional selected story opportunity.
- `GET /api/campaign-factory/runs/[id]`
  - Admin-only.
  - Returns run plus linked artifacts.
- `PUT /api/campaign-factory/runs/[id]`
  - Admin-only.
  - Updates orchestration state and JSON payloads.
- `POST /api/campaign-factory/runs/[id]/approve`
  - Admin-only.
  - Marks the run approval state and status.
  - Does not create downstream records.

### Renderer Plan

`ArtifactRenderer` accepts structured `ArtifactContent`, not HTML.

Supported Phase 1 blocks:

- hero
- summary
- scorecard
- insight_list
- recommendation_list
- channel_plan
- timeline
- asset_list
- metric_grid
- decision_panel

The flagship Campaign Artifact uses these blocks to show:

- campaign thesis
- goal
- audience
- story rationale
- research findings
- channel plan
- deliverables
- approval decision

### RLS Plan

All new tables enable RLS.

Policies:

- Admins can manage artifacts.
- Admins can manage artifact versions.
- Admins can manage campaign factory runs.
- Admins can manage run-artifact links.
- Admins can manage content library items.

The API continues the existing app pattern:

- authenticate using `getAuthUser()`
- require `role === 'admin'`
- use service-role Supabase client after the app-level admin gate

### Migration Strategy

1. Add additive migration only. Do not alter or drop existing content tables.
2. Create new tables with `if not exists`.
3. Create constraints and indexes.
4. Enable RLS and policies.
5. No backfill required in Batch 1 beyond API-created artifact library index rows.
6. Later batches can backfill `content_library_items` from existing assets, campaigns, queue items, and published records.

### Rollback Strategy

If Batch 1 must be rolled back before data is relied on:

1. Disable or remove routes/components referencing the new tables.
2. Drop policies.
3. Drop tables in dependency order:
   - `content_library_items`
   - `campaign_factory_run_artifacts`
   - `campaign_factory_runs`
   - `artifact_versions`
   - `artifacts`
4. Drop helper functions/triggers for updated timestamps.

Once production artifact data exists, rollback should be logical instead of destructive:

- hide UI/routes
- mark artifacts archived
- preserve tables for audit/version history

### Acceptance Criteria

- Migration defines all Batch 1 tables, constraints, indexes, triggers, and RLS policies.
- TypeScript contracts compile.
- Artifact APIs support create, read, version, approve, and list.
- Campaign Factory run APIs support create, read, update, approve, and list.
- ArtifactRenderer renders structured Campaign Artifacts without `dangerouslySetInnerHTML`.
- Approval stores `approved_version_id` and does not create content ideas, scripts, production cards, or publishing queue rows.
- `npm run typecheck` passes.

## 13. Batch 2 Detailed Execution Plan

### Goal

Build Story Intelligence so the system can answer:

"What should we talk about today?"

Batch 2 must prove the app can reliably surface meaningful opportunities from existing Buds At Work data without opaque AI scoring.

### Approved Constraints

- No publishing.
- No campaign generation.
- No AI orchestration.
- No hidden scoring.
- Story Brief Artifact generation is allowed because it uses the Batch 1 structured Artifact Engine.

### Explainability Contract

Every recommendation must expose:

- final score
- base story score
- visible signal bonus
- score formula
- deterministic score breakdown
- supporting signals
- related story arcs
- related open threads
- related fundraising campaigns
- related jobs
- related reviews
- related leads
- related milestones
- why the recommendation exists
- the business goal it supports
- the recommended next action

### Implementation Plan

1. Add Story Intelligence contracts.
2. Add deterministic recommendation builder.
3. Reuse existing Story Opportunity scoring when stored score fields are missing.
4. Pull supporting context from:
   - `story_opportunities`
   - `story_arcs`
   - `story_open_threads`
   - `fundraising_items`
   - `orders`
   - `ratings`
   - `leads`
   - `growth_pipeline_events`
5. Rank recommendations using:
   - base story score
   - related arc signal
   - open thread signal
   - fundraising signal
   - job/customer activity signal
   - review/social proof signal
   - lead/demand signal
   - milestone signal
   - recency signal
   - content readiness signal
6. Add `GET /api/story-intelligence/recommendations`.
7. Add `POST /api/story-intelligence/brief`.
8. Add Story Intelligence homepage at `/dashboard/content/story-intelligence`.
9. Redirect `/dashboard/story-engine` to Story Intelligence while preserving existing Story Engine subroutes.

### Acceptance Criteria

- A user can open Story Intelligence and immediately see the top recommended story.
- The top recommendation explains why it matters.
- The top recommendation shows the business goal it supports.
- The top recommendation provides a clear next action.
- Ranked recommendations show base score and visible signal bonus.
- Story Brief Artifact generation creates a structured `story` artifact.
- No downstream campaign, content idea, script, production card, publishing queue, or publishing action is created.

## 14. Batch 3 Detailed Execution Plan

### Goal

Build Campaign Factory MVP as a goal-first workflow that consumes explainable Story Intelligence recommendations and creates structured artifacts for review.

### Approved Workflow

```text
Goal
↓
Recommended Story
↓
Research Artifact
↓
Strategy Artifact
↓
Campaign Artifact
↓
Approve
```

### Scope

In scope:

- Goal selection.
- Story Intelligence recommendation selection.
- Deterministic research service.
- Structured Research Artifact.
- Structured Strategy Artifact.
- Structured Campaign Artifact.
- Artifact review and artifact approval.
- Four initial deliverables inside the Campaign Artifact:
  - Facebook Post
  - Instagram Post
  - TikTok Script
  - Email

Out of scope:

- Publishing.
- Scheduling.
- Social media integrations.
- Production cards.
- Content ideas.
- Scripts database.
- Publishing queue automation.

### Implementation Plan

1. Add Campaign Factory MVP contracts for goals, deliverables, research, strategy, and generated artifacts.
2. Add deterministic Campaign Factory builders:
   - `buildResearchServiceOutput`
   - `buildStrategyOutput`
   - `buildResearchArtifact`
   - `buildStrategyArtifact`
   - `buildCampaignArtifact`
3. Add shared artifact creation helper that creates an artifact, version, content library item, and optional Campaign Factory run link.
4. Add workflow endpoints:
   - `POST /api/campaign-factory/runs/[id]/research`
   - `POST /api/campaign-factory/runs/[id]/strategy`
   - `POST /api/campaign-factory/runs/[id]/campaign-artifact`
5. Replace `/dashboard/content` with the Campaign Factory MVP workflow.
6. Keep `/dashboard/content/story-intelligence` as the source of explainable recommendation truth.
7. Use existing artifact approval endpoint for final Campaign Artifact approval.
8. Mark the Campaign Factory run approved only after artifact approval, with explicit `approval_stops_at_artifact` state.

### Acceptance Criteria

- A user can select a business goal.
- A user can select a Story Intelligence recommendation.
- The system creates a Research Artifact grounded in visible signals and research trends.
- The system creates a Strategy Artifact grounded in the selected goal and recommendation.
- The system creates a Campaign Artifact with Facebook, Instagram, TikTok, and email drafts.
- A user can open generated artifacts for review.
- A user can approve the Campaign Artifact.
- Approval does not publish, schedule, create content ideas, create scripts, create production cards, or create publishing queue items.
