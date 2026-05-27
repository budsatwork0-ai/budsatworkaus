# Graph Report - .  (2026-05-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 5877 nodes · 10653 edges · 378 communities (286 shown, 92 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 314 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e21dbe13`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Architecture Notes

These are the hand-authored notes that map to the most important nodes in this graph. Linking here connects the graph report to the rest of the vault.

### Runtime & Infrastructure
- [[Bud Core Runtime]] — `deriveGlobalTruth`, `deriveBudOsState`, `buildBudOsActionQueue`
- [[Mission Control]] — aggregated operational health state
- [[Agent Runtime]] — `runAgent()`, guardrails, approval queue
- [[createServiceClient]] — most-imported function (217 edges)
- [[getAuthUser]] — auth gate across all protected routes
- [[Brand]] — design token object (107 edges across UI)

### Quote & Payment Pipeline
- [[ServicesPageContent]] — the public quote wizard
- [[WizardState]] — shared state for all wizard steps
- [[Pricing Engine]] — live price calculation
- [[Route Service]] — travel distance and surcharge
- [[useRouteResult]] — hook that triggers route lookups
- [[Quote Pipeline]] — quote → checkout → webhook lifecycle

### Agent Types
- [[AgentDefinition]] — interface every agent implements
- [[AgentContext]] — runtime context injected into every agent

### Processes & SOPs
- [[Quote Flow]] — end-to-end customer journey
- [[Stripe Checkout]] — checkout session and webhook events
- [[Email Triggers]] — all 7 transactional email triggers
- [[New Booking]] — post-payment admin checklist
- [[Automations Log]] — live automation recipe states

### Navigation
- [[Graphify]] — how to query this graph from the CLI
- [[Home]] — vault index

---

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 115|Community 115]]
- [[_COMMUNITY_Community 116|Community 116]]
- [[_COMMUNITY_Community 117|Community 117]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 120|Community 120]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 122|Community 122]]
- [[_COMMUNITY_Community 123|Community 123]]
- [[_COMMUNITY_Community 124|Community 124]]
- [[_COMMUNITY_Community 125|Community 125]]
- [[_COMMUNITY_Community 126|Community 126]]
- [[_COMMUNITY_Community 127|Community 127]]
- [[_COMMUNITY_Community 128|Community 128]]
- [[_COMMUNITY_Community 129|Community 129]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 143|Community 143]]
- [[_COMMUNITY_Community 144|Community 144]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 146|Community 146]]
- [[_COMMUNITY_Community 147|Community 147]]
- [[_COMMUNITY_Community 148|Community 148]]
- [[_COMMUNITY_Community 149|Community 149]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 154|Community 154]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 158|Community 158]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 160|Community 160]]
- [[_COMMUNITY_Community 161|Community 161]]
- [[_COMMUNITY_Community 162|Community 162]]
- [[_COMMUNITY_Community 163|Community 163]]
- [[_COMMUNITY_Community 164|Community 164]]
- [[_COMMUNITY_Community 165|Community 165]]
- [[_COMMUNITY_Community 166|Community 166]]
- [[_COMMUNITY_Community 167|Community 167]]
- [[_COMMUNITY_Community 168|Community 168]]
- [[_COMMUNITY_Community 169|Community 169]]
- [[_COMMUNITY_Community 170|Community 170]]
- [[_COMMUNITY_Community 171|Community 171]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 173|Community 173]]
- [[_COMMUNITY_Community 174|Community 174]]
- [[_COMMUNITY_Community 175|Community 175]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 177|Community 177]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 180|Community 180]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 184|Community 184]]
- [[_COMMUNITY_Community 185|Community 185]]
- [[_COMMUNITY_Community 186|Community 186]]
- [[_COMMUNITY_Community 187|Community 187]]
- [[_COMMUNITY_Community 188|Community 188]]
- [[_COMMUNITY_Community 189|Community 189]]
- [[_COMMUNITY_Community 190|Community 190]]
- [[_COMMUNITY_Community 191|Community 191]]
- [[_COMMUNITY_Community 192|Community 192]]
- [[_COMMUNITY_Community 193|Community 193]]
- [[_COMMUNITY_Community 194|Community 194]]
- [[_COMMUNITY_Community 195|Community 195]]
- [[_COMMUNITY_Community 196|Community 196]]
- [[_COMMUNITY_Community 197|Community 197]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 199|Community 199]]
- [[_COMMUNITY_Community 200|Community 200]]
- [[_COMMUNITY_Community 201|Community 201]]
- [[_COMMUNITY_Community 202|Community 202]]
- [[_COMMUNITY_Community 203|Community 203]]
- [[_COMMUNITY_Community 204|Community 204]]
- [[_COMMUNITY_Community 205|Community 205]]
- [[_COMMUNITY_Community 206|Community 206]]
- [[_COMMUNITY_Community 207|Community 207]]
- [[_COMMUNITY_Community 208|Community 208]]
- [[_COMMUNITY_Community 209|Community 209]]
- [[_COMMUNITY_Community 210|Community 210]]
- [[_COMMUNITY_Community 211|Community 211]]
- [[_COMMUNITY_Community 212|Community 212]]
- [[_COMMUNITY_Community 213|Community 213]]
- [[_COMMUNITY_Community 214|Community 214]]
- [[_COMMUNITY_Community 215|Community 215]]
- [[_COMMUNITY_Community 216|Community 216]]
- [[_COMMUNITY_Community 217|Community 217]]
- [[_COMMUNITY_Community 218|Community 218]]
- [[_COMMUNITY_Community 219|Community 219]]
- [[_COMMUNITY_Community 220|Community 220]]
- [[_COMMUNITY_Community 221|Community 221]]
- [[_COMMUNITY_Community 222|Community 222]]
- [[_COMMUNITY_Community 223|Community 223]]
- [[_COMMUNITY_Community 224|Community 224]]
- [[_COMMUNITY_Community 225|Community 225]]
- [[_COMMUNITY_Community 226|Community 226]]
- [[_COMMUNITY_Community 227|Community 227]]
- [[_COMMUNITY_Community 228|Community 228]]
- [[_COMMUNITY_Community 229|Community 229]]
- [[_COMMUNITY_Community 230|Community 230]]
- [[_COMMUNITY_Community 231|Community 231]]
- [[_COMMUNITY_Community 232|Community 232]]
- [[_COMMUNITY_Community 233|Community 233]]
- [[_COMMUNITY_Community 234|Community 234]]
- [[_COMMUNITY_Community 235|Community 235]]
- [[_COMMUNITY_Community 236|Community 236]]
- [[_COMMUNITY_Community 237|Community 237]]
- [[_COMMUNITY_Community 238|Community 238]]
- [[_COMMUNITY_Community 239|Community 239]]
- [[_COMMUNITY_Community 240|Community 240]]
- [[_COMMUNITY_Community 241|Community 241]]
- [[_COMMUNITY_Community 242|Community 242]]
- [[_COMMUNITY_Community 243|Community 243]]
- [[_COMMUNITY_Community 244|Community 244]]
- [[_COMMUNITY_Community 245|Community 245]]
- [[_COMMUNITY_Community 246|Community 246]]
- [[_COMMUNITY_Community 247|Community 247]]
- [[_COMMUNITY_Community 248|Community 248]]
- [[_COMMUNITY_Community 249|Community 249]]
- [[_COMMUNITY_Community 250|Community 250]]
- [[_COMMUNITY_Community 251|Community 251]]
- [[_COMMUNITY_Community 252|Community 252]]
- [[_COMMUNITY_Community 253|Community 253]]
- [[_COMMUNITY_Community 254|Community 254]]
- [[_COMMUNITY_Community 255|Community 255]]
- [[_COMMUNITY_Community 256|Community 256]]
- [[_COMMUNITY_Community 257|Community 257]]
- [[_COMMUNITY_Community 258|Community 258]]
- [[_COMMUNITY_Community 259|Community 259]]
- [[_COMMUNITY_Community 260|Community 260]]
- [[_COMMUNITY_Community 262|Community 262]]
- [[_COMMUNITY_Community 263|Community 263]]
- [[_COMMUNITY_Community 264|Community 264]]
- [[_COMMUNITY_Community 265|Community 265]]
- [[_COMMUNITY_Community 266|Community 266]]
- [[_COMMUNITY_Community 267|Community 267]]
- [[_COMMUNITY_Community 268|Community 268]]
- [[_COMMUNITY_Community 269|Community 269]]
- [[_COMMUNITY_Community 270|Community 270]]
- [[_COMMUNITY_Community 271|Community 271]]
- [[_COMMUNITY_Community 272|Community 272]]
- [[_COMMUNITY_Community 273|Community 273]]
- [[_COMMUNITY_Community 274|Community 274]]
- [[_COMMUNITY_Community 275|Community 275]]
- [[_COMMUNITY_Community 276|Community 276]]
- [[_COMMUNITY_Community 277|Community 277]]
- [[_COMMUNITY_Community 278|Community 278]]
- [[_COMMUNITY_Community 279|Community 279]]
- [[_COMMUNITY_Community 280|Community 280]]
- [[_COMMUNITY_Community 281|Community 281]]
- [[_COMMUNITY_Community 282|Community 282]]
- [[_COMMUNITY_Community 283|Community 283]]
- [[_COMMUNITY_Community 284|Community 284]]
- [[_COMMUNITY_Community 285|Community 285]]
- [[_COMMUNITY_Community 288|Community 288]]
- [[_COMMUNITY_Community 289|Community 289]]
- [[_COMMUNITY_Community 290|Community 290]]
- [[_COMMUNITY_Community 291|Community 291]]
- [[_COMMUNITY_Community 292|Community 292]]
- [[_COMMUNITY_Community 293|Community 293]]
- [[_COMMUNITY_Community 297|Community 297]]
- [[_COMMUNITY_Community 298|Community 298]]
- [[_COMMUNITY_Community 299|Community 299]]
- [[_COMMUNITY_Community 300|Community 300]]
- [[_COMMUNITY_Community 301|Community 301]]
- [[_COMMUNITY_Community 302|Community 302]]
- [[_COMMUNITY_Community 303|Community 303]]
- [[_COMMUNITY_Community 304|Community 304]]
- [[_COMMUNITY_Community 305|Community 305]]
- [[_COMMUNITY_Community 306|Community 306]]
- [[_COMMUNITY_Community 307|Community 307]]
- [[_COMMUNITY_Community 308|Community 308]]
- [[_COMMUNITY_Community 309|Community 309]]
- [[_COMMUNITY_Community 310|Community 310]]
- [[_COMMUNITY_Community 311|Community 311]]
- [[_COMMUNITY_Community 312|Community 312]]
- [[_COMMUNITY_Community 314|Community 314]]
- [[_COMMUNITY_Community 315|Community 315]]
- [[_COMMUNITY_Community 320|Community 320]]
- [[_COMMUNITY_Community 324|Community 324]]
- [[_COMMUNITY_Community 325|Community 325]]
- [[_COMMUNITY_Community 326|Community 326]]
- [[_COMMUNITY_Community 327|Community 327]]
- [[_COMMUNITY_Community 329|Community 329]]
- [[_COMMUNITY_Community 330|Community 330]]
- [[_COMMUNITY_Community 331|Community 331]]
- [[_COMMUNITY_Community 332|Community 332]]
- [[_COMMUNITY_Community 333|Community 333]]
- [[_COMMUNITY_Community 334|Community 334]]
- [[_COMMUNITY_Community 335|Community 335]]
- [[_COMMUNITY_Community 336|Community 336]]
- [[_COMMUNITY_Community 337|Community 337]]
- [[_COMMUNITY_Community 353|Community 353]]
- [[_COMMUNITY_Community 354|Community 354]]
- [[_COMMUNITY_Community 355|Community 355]]
- [[_COMMUNITY_Community 356|Community 356]]
- [[_COMMUNITY_Community 357|Community 357]]
- [[_COMMUNITY_Community 358|Community 358]]
- [[_COMMUNITY_Community 359|Community 359]]
- [[_COMMUNITY_Community 360|Community 360]]
- [[_COMMUNITY_Community 361|Community 361]]
- [[_COMMUNITY_Community 362|Community 362]]
- [[_COMMUNITY_Community 363|Community 363]]
- [[_COMMUNITY_Community 364|Community 364]]
- [[_COMMUNITY_Community 365|Community 365]]
- [[_COMMUNITY_Community 366|Community 366]]
- [[_COMMUNITY_Community 367|Community 367]]
- [[_COMMUNITY_Community 368|Community 368]]
- [[_COMMUNITY_Community 369|Community 369]]
- [[_COMMUNITY_Community 370|Community 370]]
- [[_COMMUNITY_Community 371|Community 371]]
- [[_COMMUNITY_Community 372|Community 372]]
- [[_COMMUNITY_Community 373|Community 373]]
- [[_COMMUNITY_Community 374|Community 374]]
- [[_COMMUNITY_Community 375|Community 375]]
- [[_COMMUNITY_Community 376|Community 376]]
- [[_COMMUNITY_Community 377|Community 377]]

## God Nodes (most connected - your core abstractions)
1. `createServiceClient()` - 217 edges
2. `Brand` - 107 edges
3. `getAuthUser()` - 85 edges
4. `/dashboard` - 62 edges
5. `Improvement Executor` - 55 edges
6. `MoneyFlowWorkspace()` - 51 edges
7. `useAssistant()` - 49 edges
8. `Service Data` - 46 edges
9. `WORKSPACES` - 45 edges
10. `AgentDefinition` - 45 edges

## Surprising Connections (you probably didn't know these)
- `NDIS Participant Matching — May 2026` --conceptually_related_to--> `NDIS Matching Algorithm (matching.ts)`  [INFERRED]
  Buds At Work/Admin/Engineering.md → src/lib/ndis/matching.ts
- `Migration 038: Design Agents Schema` --implements--> `design_insights Table`  [INFERRED]
  supabase/migrations/038_design_agents.sql → AGENTS_ACTIVATION.md
- `Agent Runtime (runAgent / executeApprovedAction)` --references--> `External: Anthropic Claude API`  [INFERRED]
  src/lib/agents/runtime.ts → AGENTS_README.md
- `Concept: Agent Autonomy Levels (auto/review/manual)` --conceptually_related_to--> `Agent Runtime (runAgent / executeApprovedAction)`  [INFERRED]
  AGENTS_README.md → src/lib/agents/runtime.ts
- `Agent Runtime (runAgent / executeApprovedAction)` --implements--> `Agent Resilience Engine (Circuit Breaker + Zombie Reaper + Concurrency Guard)`  [INFERRED]
  src/lib/agents/runtime.ts → Buds At Work/Dev/Dev Log 2026-05-20.md

## Hyperedges (group relationships)
- **All four agents feed leads into the shared Lead record via the Concierge** —  [EXTRACTED 1.00]
- **All agents require ICP definition as a foundational input** —  [EXTRACTED 0.95]

## Communities (378 total, 92 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (105): POST(), RouteContext, GET(), POST(), POST(), GET(), SERVICE_LABELS, GET() (+97 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (64): activeCapabilities(), AREA_PATTERNS, BudCapabilityActivity, buildApprovalDetail(), buildBlockedDetail(), buildCockpitSummary(), buildDegradedDetail(), buildOperationalSummaries() (+56 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (54): LeadFunnel(), STAGE_HINTS, LeadRow(), LiveLeadsFeed(), quoteStatusLabel(), SourceFilter, AttentionRow(), CATEGORY_META (+46 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (47): Cash Flow Forecaster Agent, Crew Coach Agent, Lapsed Win-Back Agent, Lead Scorer Agent, Reconciliation Agent, Stripe Dispute Manager Agent, WHS Safety Reminder Agent, Yard Map Geo Agent (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (62): AssistantPriceBanner(), Props, AssistantQuestion(), Props, DETECTED_ANSWER_IDS, Props, buildMergePayload(), COMMERCIAL_COPY (+54 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (55): TASK_MAP, clampUnitPrice(), CLEANING_HOME_BRISBANE_2025, CLEANING_HOME_MIN_HOURS, CLEANING_HOME_MULTIPLIER, CLEANING_HOME_RATES, CLEANING_HOME_RECURRING_DISCOUNT, cleaningCommercialMinutes() (+47 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (41): src/app/api/bud/command/route.ts, ActionQueueV2(), OverviewV2(), Claude Haiku Model (claude-haiku-4-5-20251001), Mission Control Dashboard (Concept), Dev Session 13c2cfe0 (2026-05-20 20:25–20:26), Dev Session 873a495e (2026-05-20 00:26–00:31), DeploymentState (+33 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (52): sendEmailEffect(), POST(), getResendClient(), bookingConfirmedEmail(), BookingConfirmedParams, checkoutExpiredEmail(), CheckoutExpiredParams, dayBeforeReminderEmail() (+44 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (51): adminClient(), buildDocumentGraph(), buildFullGraph(), FullBuildOpts, IncrementalBuildOpts, GraphContextOpts, buildBacklinkEdges(), buildDeterministicEdges() (+43 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (47): MatchBadge(), NdisMatch, NdisPublication, NdisRequirements, SERVICE_HOURS, GET(), Params, requireAdmin() (+39 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (45): CRAWL_PAGES, POST(), stripHtml(), buildGraphContext(), buildMemoryContext(), buildRetrievalContext(), InjectedContext, checkDuplicate() (+37 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (46): Props, CLEAN_SCOPES, COMM_LABELS, getYardMeasurementConfig(), YARD_MEASUREMENT_UNITS, createYardJob(), defaultParamsByService(), getInitialState() (+38 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (47): SetFunction, UseYardMappingProps, YardConditionLevel, YardJob, YardMeasurementConfig, fallbackRoute(), haversineDistanceKm(), toRadians() (+39 more)

### Community 14 - "Community 14"
Cohesion: 0.04
Nodes (24): SEVERITY_STYLES, metadata, AuthCard(), AuthCardProps, EarningsData, SERVICE_LABELS, STEPS, Inductee (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (40): CLEANING_IMPACTS, CLEANING_MICRO_PRESETS, DEFAULT_YARD_MEASUREMENT, HOUSE_SNAPS, PARAMS_FULL, TASKS, YARD_SCOPE_MEASUREMENTS, buildCleaningChecklistFromWizard() (+32 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (46): adjustedTypicalMinutes(), badgeMinutesForScope(), buildServiceEstimate(), calculateEstimatedPrice(), calculateEstimatedTime(), calculateServicePrice(), combinePricing(), computeScopeMinutes() (+38 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (36): AnalyticsEventInput, recordAnalyticsEvent(), GMAIL_DOMAINS, NormalizedEmail, PLUS_ALIAS_PROVIDERS, ALLOWED_PHOTO_EXT, ALLOWED_PHOTO_MIME, GET() (+28 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (36): DANGEROUS_ACTIONS, getDefaultAutonomyLevel(), requiresApproval(), BudCommandIntent, ClassifiedBudCommand, classifyBudCommand(), buildFailureReport(), classifyFailure() (+28 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (44): ARCH_PATTERNS, changeTypeToMemoryCategory(), classifyCommit(), classifyFilePaths(), classifyPR(), classifyPushCommits(), COMMIT_PREFIX_MAP, extractAffectedSystems() (+36 more)

### Community 20 - "Community 20"
Cohesion: 0.04
Nodes (29): AccountNotifications, AccountProfile, ALL_ROLES, DEFAULT_ACCOUNT_NOTIFICATIONS, DEFAULT_ACCOUNT_PROFILE, DEFAULT_GOALS, DEFAULT_INVOICE_SETTINGS, DEFAULT_PAYROLL (+21 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (35): AdminDocument, DocCard(), DocCardProps, DocReviewCard(), DocReviewCardProps, DocRow(), DocRowProps, Employee (+27 more)

### Community 22 - "Community 22"
Cohesion: 0.04
Nodes (24): AboutPage(), credentials, customers, iconProps, metadata, services, team, timeline (+16 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (38): canAutoComplete(), GET(), OrderWithAssignments, AutomationCard, SaveState, quoteDiscountOfferEmail(), weeklyKpiEmail(), AutomationConfig (+30 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (39): TableSkeleton(), CsvColumn, exportCsv(), formatDate(), payableCsvColumns, receivableCsvColumns, BaseFilters, useTableFilters() (+31 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (41): formatBrowserSummary(), EmbeddingResponse, generateEmbedding(), searchSimilarLearnings(), SimilarLearning, writeLearningEmbedding(), branchExists(), budBranchName() (+33 more)

### Community 26 - "Community 26"
Cohesion: 0.05
Nodes (37): AgentDetailPage(), NotFound(), Action, Agent, AgentDetailClient(), Props, Run, AssignModal (+29 more)

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (43): Assistant Types (types.ts), Additive Surcharge Pricing Model, Auto Interior Pricing Model, auto_rego_lookup First Step, buildMergePayload Function, Dump Delivery Subtype, DUMP_LOAD_META, Dump/Removal Flow (+35 more)

### Community 28 - "Community 28"
Cohesion: 0.05
Nodes (18): iconProps, metadata, quickLinks, INTEREST_OPTS, Props, GetInvolvedPage(), iconProps, isEmail() (+10 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (42): AgentAction Record (Audit Log), Agent Record (Data Model), Ahrefs API, Anthropic SDK (LLM Layer), Apollo Prospect Data, Recommended Build Sequence (Phases 0-5), CallRail Call Tracking, Clay Prospect Enrichment (+34 more)

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (31): GET(), POST(), POST(), RouteContext, buildEmployeeOnboardingSnapshot Function, GET(), BASE_SECTIONS, EmployeeProgressDocument (+23 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (40): budImproveBranchName(), client(), createBranch(), createIssue(), createPR(), deleteBranch(), enableAutoMerge(), getFileContent() (+32 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (17): AlertCircleIcon(), ArrowLeftIcon(), EyeIcon(), LeafIcon(), MailIcon(), Spinner(), AuthSplitLayout(), AuthSplitLayoutProps (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.06
Nodes (33): AgentHealthLabel, AgentOutput, AgentOutputSchema, AutonomyLevelSchema, BudState, BudStateSchema, BudTaskStatusSchema, RiskLevelSchema (+25 more)

### Community 34 - "Community 34"
Cohesion: 0.08
Nodes (37): ActionRow, actionSet(), ApprovalReadinessReason, BudOsApprovalDetail, BudOsAutonomyCapability, BudOsMemoryLayer, BudOsQueueGroup, BudOsQueueItem (+29 more)

### Community 35 - "Community 35"
Cohesion: 0.08
Nodes (32): GET(), POST(), requireStaff(), ActivityItem, createEmptyDailySeries(), CrewAssignmentRecord, DashboardData, DashboardMetrics (+24 more)

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (27): BudActivityEvent, NavBadgeKey, NOTIF_ICONS, NotificationCenter(), Props, Props, SideNavItem(), SoftLockModal() (+19 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (33): CATEGORY_FOLDER, FRESHNESS_DECAY, getVaultPath(), VAULT_SKIP_FOLDERS, getEmbeddingProvider(), bulkRefreshFreshness(), computeFreshness(), daysUntilStale() (+25 more)

### Community 38 - "Community 38"
Cohesion: 0.07
Nodes (30): ActionRow, AgentHealthScore, AgentLifecycleState, AgentRow, BudTaskRow, computeDeploymentState(), computeMissionControlHealth(), computeOperatingMode() (+22 more)

### Community 39 - "Community 39"
Cohesion: 0.09
Nodes (31): mocks, postCheckout(), request(), createCheckoutIdempotencyKey(), RouteParams, SERVICE_LABELS, canAccessQuote(), logQuoteAudit() (+23 more)

### Community 40 - "Community 40"
Cohesion: 0.05
Nodes (36): Applicant, ApplicantInsert, ApplicantUpdate, AuditLog, AuditLogInsert, ChecklistTemplateInsert, ChecklistTemplateUpdate, Customer (+28 more)

### Community 41 - "Community 41"
Cohesion: 0.06
Nodes (20): aggregateSeries(), DisplayPayStatus, DisplayWorker, filterWorkerToPeriod(), getPayPeriodBounds(), GroupMode, MONEY_CHART_COLORS, MoneyFlowWorkspace() (+12 more)

### Community 42 - "Community 42"
Cohesion: 0.14
Nodes (27): callLoopPolicy, contextDriftPolicy, costBudgetPolicy, DANGEROUS_PATTERNS, dangerousActionPolicy, DEFAULT_POLICIES, hallucinationPolicy, intentCompletionPolicy (+19 more)

### Community 43 - "Community 43"
Cohesion: 0.09
Nodes (36): NDIS Pricing Rewrite & Stripe Hardening — April 2026, Failed Payment, Pricing Engine, Quote Flow, Refund Process, Services Flow Improvements — April 2026 Phase 6, create-next-app, Next.js Project (+28 more)

### Community 44 - "Community 44"
Cohesion: 0.11
Nodes (35): activeFileDelete(), activeFileGet(), activeFilePatch(), activeFilePut(), certificateGet(), commandPost(), errorHandler(), getDocumentMapObject() (+27 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (34): AgentMetrics, Bud Agent (bud.ts), Bud Command Route (route.ts), agent-architect, Crew Briefing Agent, Approval Filter Bug (source_agent vs requested_by), Broken Agents Zod Schema Validation Bug, Bud Self-Investigation Loop Bug (+26 more)

### Community 46 - "Community 46"
Cohesion: 0.07
Nodes (18): ErrorBoundary, Props, State, ACTION_BADGE_LABELS, ActionCard(), AlertRow(), AttentionTone, CrewCard() (+10 more)

### Community 47 - "Community 47"
Cohesion: 0.08
Nodes (29): ActivityFeed(), typeBgColors, typeColors, typeIcons, EVENT_CONFIG, Props, COLORS, ExpenseDataPoint (+21 more)

### Community 48 - "Community 48"
Cohesion: 0.07
Nodes (34): Agent: Applicant Screener, Agent: Cash Flow Forecaster, Agent: Competitor Watcher, Agent: Content Agent, Agent: Conversion Funnel, Agent: Crew Coach, Agent: Customer Reply, Agent: Internal QA (+26 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (34): Admin, Supabase audit_log table, Automations Log, Command Palette (⌘K), Customer Support, Dashboard (/dashboard), Data & Analytics, Email Triggers (+26 more)

### Community 50 - "Community 50"
Cohesion: 0.07
Nodes (19): VALID_SURFACES, LearningOutcome, PipelineLearningEntry, VALID_SURFACES, SURFACES, STAGE_BY_ID, StageDefinition, STAGES (+11 more)

### Community 51 - "Community 51"
Cohesion: 0.07
Nodes (14): VisitorsTab, page_views, AnalyticsSession, BRAND, DeviceIcon(), formatDuration(), FUNNEL_PAGES, getDevice() (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (30): Agent Actions Route (actions/[id]/route.ts), AgentHealth Block, Agents Cron (/api/agents/cron), Agent Runs Archive Route (runs/[id]/archive/route.ts), GitHub Secret: BUDS_WEBHOOK_URL, FailureCard Component, Foreman API (/api/agents/foreman), GitHub Webhook Handler (/api/webhooks/github) (+22 more)

### Community 53 - "Community 53"
Cohesion: 0.10
Nodes (27): Admin Issue: Quote Pipeline No Single Pane, Admin Issue: Scheduling Multi-Step Assign, Admin Optimization Agent Design Decision, Admin Optimization Baseline Finding, Admin Optimization Agent, Agents Registry, AreaFinding, AreaResult (+19 more)

### Community 54 - "Community 54"
Cohesion: 0.11
Nodes (31): Operations, API: Crew Jobs Route (Modified), API: Crew Support Profile Route, API: NDIS Job Matches Route, API: NDIS Participants Route (Admin), API: NDIS Pending Match Route (Admin), API: NDIS Job Publish Route, API: NDIS Job Requirements Route (+23 more)

### Community 55 - "Community 55"
Cohesion: 0.08
Nodes (30): Apple ICC Color Profile (2022), C2PA Actions Assertion (c2pa.actions.v2), C2PA Claim v2, C2PA Manifest (Content Credentials), C2PA Signature, ChatGPT Claim Generator, Display P3 Color Profile, GPT-4o Software Agent (+22 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (26): getBudCapabilities(), BudInitiative, buildBudInitiatives(), buildBudOsAutonomy(), buildBudOsMemoryLayer(), buildBudOsWorkforce(), deriveBudOsState(), BudThought (+18 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (30): Architecture Decision Records (ADR), Analyse Stage, Autonomous Improvement Pipeline, Bud Agent Quorum, Bud Architect Agent, Bud Design Constitution, Bud Memory Agent, Bud Taste Agent (+22 more)

### Community 58 - "Community 58"
Cohesion: 0.07
Nodes (21): ActionRow, AgentCard(), AgentRow, CATEGORY_COLOR, DOMAIN_DOT, ForemanConsole(), ForemanLobbyState, InsightRow (+13 more)

### Community 59 - "Community 59"
Cohesion: 0.07
Nodes (28): dependencies, framer-motion, @googlemaps/js-api-loader, konva, @marsidev/react-turnstile, next, @next/third-parties, @octokit/rest (+20 more)

### Community 60 - "Community 60"
Cohesion: 0.10
Nodes (27): Admin Dashboard Improvements — April 2026, DomainCard, ICONS, Props, Crew Today Widget, api/dashboard/route.ts, DashboardCrewMember type, DashboardData type (+19 more)

### Community 61 - "Community 61"
Cohesion: 0.07
Nodes (28): audio-recorder, backlink, bases, bookmarks, canvas, daily-notes, editor-status, file-explorer (+20 more)

### Community 62 - "Community 62"
Cohesion: 0.12
Nodes (24): audit_log, calculate_order_balance(), calculate_order_payments(), calculate_outstanding_receivables(), calculate_pending_payables(), customers, orders, payables (+16 more)

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (29): API: /api/portal/profile, Audit Log Table, Client Portal, Email Triggers, profileHydrated State Gate, Services Flow Improvements — April 2026 Phase 3, Stripe Checkout, 025_stripe_customer_id.sql (+21 more)

### Community 64 - "Community 64"
Cohesion: 0.11
Nodes (27): agent_actions Table, Quote Triage Agent, agent_runs Table, agents Table, ANTHROPIC_API_KEY, Autonomy Mode: review, CRON_SECRET, Admin Dashboard - /dashboard/agents (+19 more)

### Community 65 - "Community 65"
Cohesion: 0.12
Nodes (28): Agent: Crew Briefing, Autonomy Pipeline Component, Mission Control Autonomy Component, Concept: Agent Autonomy Levels (auto/review/manual), Autonomous Improvement Pipeline, Pipeline Debate (5-Persona Claude Scoring), Pipeline Stages (detect→analyze→design→sandbox→generate→validate→reject gate→debate→merge→deploy), Supabase Realtime (+20 more)

### Community 66 - "Community 66"
Cohesion: 0.10
Nodes (19): buildQuoteSummary(), WindowsEditor, FREQ_LABELS, getFrequencyLabel(), GlassCard(), Row(), S3_Card(), S3_Chip() (+11 more)

### Community 67 - "Community 67"
Cohesion: 0.08
Nodes (28): Admin Domain, Automations Log, Bug Tracker, Client Portal (/portal), Crew Portal (/crew), Admin Dashboard (/dashboard), Data & Analytics Domain, Design System Domain (+20 more)

### Community 68 - "Community 68"
Cohesion: 0.13
Nodes (23): Props, ROOM_TYPES, BaseShape, computeMetrics(), defaultEstimateConfig, EstimateConfig, FloorItem, FloorLayout (+15 more)

### Community 69 - "Community 69"
Cohesion: 0.12
Nodes (19): contexts, frequencies, serviceTypes, OrdersPage(), serviceTypeOptions, tabs, TabKey, ChecklistItem (+11 more)

### Community 70 - "Community 70"
Cohesion: 0.11
Nodes (27): Buds At Work Admin Dashboard, CSS Backdrop Filter (Glassmorphism), Badge Component, Chip Component, Content Grid Layout, Crew List Component, Delta Badge Component, CSS Design Tokens (+19 more)

### Community 71 - "Community 71"
Cohesion: 0.10
Nodes (20): SearchHit, priceOptimizerAgent, competitor-scout, agent_actions Table, agent-architect Agent, agent_runs Table, agents.config, Claude LLM (+12 more)

### Community 72 - "Community 72"
Cohesion: 0.08
Nodes (19): ActionRow, AgentCard(), AgentRow, BudConsole(), BudLobbyState, CATEGORY_COLOR, DOMAIN_DOT, LIFECYCLE_CONFIG (+11 more)

### Community 73 - "Community 73"
Cohesion: 0.14
Nodes (26): Court Architect Agent, Master of Familiars Agent, Sword Tester Agent, Autonomy: Review (by-decree), Captain's Quarters Department (Ops), Oracle of Coin Agent, Rover of the Realm Agent, Watcher of Rivals Agent (+18 more)

### Community 74 - "Community 74"
Cohesion: 0.12
Nodes (19): contexts, frequencies, SummaryCardsSkeleton(), frequencyOptions, SubscriptionsPage(), TabKey, tabs, Context (+11 more)

### Community 75 - "Community 75"
Cohesion: 0.09
Nodes (25): TriagePill, TriageStrip(), TriageStripProps, URGENCY_STYLES, /dashboard, AssignFormState, DispatchTab(), Employee (+17 more)

### Community 76 - "Community 76"
Cohesion: 0.10
Nodes (13): FocusArea, formatDelta(), formatDurationHours(), InsightsPageContent(), Tab, ArrowDownIcon(), ArrowUpIcon(), ErrorMessage() (+5 more)

### Community 77 - "Community 77"
Cohesion: 0.13
Nodes (25): Email: Booking Confirmed, Email: Checkout Expired, Email Templates, Email Triggers, Email: Quote Finalized, Email: Quote Received, Quotes Route (POST /api/quotes), Resend Email Client (+17 more)

### Community 78 - "Community 78"
Cohesion: 0.18
Nodes (23): Applicant Screener Agent, Customer Reply Agent, NDIS Compliance Agent, REQUIRED_DOCS, Activity Chart (14-day run history), Pending Approvals Queue, Autonomy Mode: Auto (Fully autonomous), Autonomy Mode: Review (Human-in-the-loop) (+15 more)

### Community 79 - "Community 79"
Cohesion: 0.09
Nodes (24): content-agent, foreman, seo-meta, Active-Issues — Design System Agent, Decisions — Design System Agent, Findings — Design System Agent, Design System Agent, Reports — Design System Agent (+16 more)

### Community 80 - "Community 80"
Cohesion: 0.09
Nodes (17): buildMessageHref(), CrewScore, EMPLOYMENT_OPTIONS, OrderOption, PipelinePerson, READINESS_COLORS, ReadinessFilter, ReadinessStatus (+9 more)

### Community 81 - "Community 81"
Cohesion: 0.09
Nodes (24): Admin, Dashboard Feedback Page, Dashboard Orders Page, Email Triggers, Engineering (from Customer Support), Failed Payment SOP, Operations (from Customer Support), Refund Process SOP (+16 more)

### Community 82 - "Community 82"
Cohesion: 0.19
Nodes (17): callModel(), adminClient(), GET(), adminClient(), AgentResult, POST(), CircuitOpenError, CircuitState (+9 more)

### Community 83 - "Community 83"
Cohesion: 0.11
Nodes (23): Admin (from Engineering), Cloudflare Turnstile CAPTCHA, Conversion Tracking (conversions.ts), Cron: 24h Quote Reminders, Dashboard API Route, Dashboard Layout + Sidebar, Dashboard Home Page (page.tsx), Data & Analytics (+15 more)

### Community 84 - "Community 84"
Cohesion: 0.10
Nodes (23): ActivityFeed Component, Brand Token: Accent (#10b981), Brand Token: Primary (#0F3D2E), Design System, Engineering, Framer Motion, Panel Component, Product Management (+15 more)

### Community 85 - "Community 85"
Cohesion: 0.15
Nodes (23): Order Assign Route (/api/orders/[id]/assign/route.ts), Checkout Route (/api/quotes/[id]/checkout/route.ts), Quote Submission API (/api/quotes/route.ts), Stripe Webhook Route (/api/webhooks/stripe/route.ts), Bug Tracker, Checkout Success Page, Post-Payment Admin Dispatch Workflow, From Price on Service Tile (+15 more)

### Community 86 - "Community 86"
Cohesion: 0.18
Nodes (22): applyOverrides(), decodeXmlEntities(), extractProviderMessage(), fetchCache(), GET(), isDev(), isRegoState(), lookupFromProvider() (+14 more)

### Community 87 - "Community 87"
Cohesion: 0.12
Nodes (15): DetectedVehicle, Props, STATES, CachedLookup, LookupArgs, LookupMeta, memoryCache, CarCategory (+7 more)

### Community 88 - "Community 88"
Cohesion: 0.09
Nodes (7): CookieConsent, contactMethods, iconProps, metadata, faqs, faqSchema, glassSoft

### Community 89 - "Community 89"
Cohesion: 0.11
Nodes (13): LatLng, BRISBANE_BOUNDS, coordsFromPath(), DEFAULT_CENTER, FRAME_EVENTS, MAP_OPTIONS, PERIMETER_STROKE_WEIGHTS, POLYGON_BASE (+5 more)

### Community 90 - "Community 90"
Cohesion: 0.24
Nodes (22): WORKSPACES, agentsRoot(), buildAgentsIndexReadme(), buildSubfolderReadme(), buildWorkspaceReadme(), filename(), fm(), logAgentRun() (+14 more)

### Community 91 - "Community 91"
Cohesion: 0.10
Nodes (17): DashboardHome(), useAuth(), OnboardingData, OnboardingPage(), SECTION_DESCRIPTIONS, SectionStatus, UNLOCK_BENEFITS, FinalizedQuote (+9 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (20): SURFACES, Autonomous Improvement Pipeline — Mission Control, autonomy_pipeline SQL Migration, MissionControlAutonomy.tsx, Mission Control Page (mission-control/page.tsx), pipeline_agent_scores Table, pipeline_artifacts Table, Pipeline Kill Switch (+12 more)

### Community 93 - "Community 93"
Cohesion: 0.10
Nodes (20): centerStrength, close, collapse-color-groups, collapse-display, collapse-filter, collapse-forces, colorGroups, hideUnresolved (+12 more)

### Community 94 - "Community 94"
Cohesion: 0.13
Nodes (21): Analytics Agent, Agents README, Frontend Agent, Meta Agent, Performance Agent, UX Agent, Agent Runtime (runAgent / executeApprovedAction), Agent Shared Types (+13 more)

### Community 95 - "Community 95"
Cohesion: 0.13
Nodes (14): ALLOWED_LEVELS, AUTHORITY_CAPABILITY_MATRIX, AUTHORITY_DESCRIPTIONS, AUTHORITY_LABELS, BudAuthority, BudAuthorityLevel, clamp(), ComputeAuthorityArgs (+6 more)

### Community 96 - "Community 96"
Cohesion: 0.14
Nodes (20): active, bases:Create new base, canvas:Create new canvas, command-palette:Open command palette, daily-notes:Open today's daily note, graph:Open graph view, switcher:Open quick switcher, templates:Insert template (+12 more)

### Community 97 - "Community 97"
Cohesion: 0.12
Nodes (21): ABN Registration, Australian Consumer Law (ACL), Admin (Wiki Note), Cloudflare Turnstile (CAPTCHA), Contractor Agreements, Cookie Policy, Customer Support (Wiki Note), Finance (Wiki Note) (+13 more)

### Community 98 - "Community 98"
Cohesion: 0.10
Nodes (7): Footer(), FeedbackWidget.tsx, FeedbackForm(), FeedbackType, iconProps, TYPE_OPTIONS, Props

### Community 99 - "Community 99"
Cohesion: 0.13
Nodes (13): ROLE_COLORS, ROLES, AccountPage(), SignInClient(), config, createMiddlewareClient(), homePathForRole(), ROLE_HIERARCHY (+5 more)

### Community 100 - "Community 100"
Cohesion: 0.14
Nodes (17): TrendResult, Analytics Intelligence Agent, Analytics Intelligence Layer (Concept), AbandonmentBreakdown, CtaPerformance, EventTrend, FunnelStep, getAbandonmentBreakdown() (+9 more)

### Community 101 - "Community 101"
Cohesion: 0.19
Nodes (16): AGENT_WORKSPACE_MAP, AgentDecision, AgentFinding, AgentIssue, AgentReport, AgentRunLog, AgentTask, DecisionImpact (+8 more)

### Community 102 - "Community 102"
Cohesion: 0.13
Nodes (18): conversion-funnel, photo-qa, authHeaders(), FIXTURES, funnel(), FunnelStep, get(), notableSessions() (+10 more)

### Community 103 - "Community 103"
Cohesion: 0.25
Nodes (19): clarity(), ClarityFn, hj(), HjFn, ph(), tagRageClickContext(), trackAdminAction(), trackAdminIdle() (+11 more)

### Community 104 - "Community 104"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 105 - "Community 105"
Cohesion: 0.16
Nodes (20): src/lib/agents/agents/admin-ux-designer.ts, src/app/api/agents/cron/route.ts, src/lib/bud/authority.ts, src/app/api/bud/authority/route.ts, src/lib/bud/health.ts, src/lib/bud/initiatives.ts, src/lib/agents/resilience/circuit-breaker.ts, BUD_AUTHORITY_COOKIE Constant (+12 more)

### Community 106 - "Community 106"
Cohesion: 0.10
Nodes (12): Context, CONTEXTS, Service, SERVICES, SOP, SopEntry, AVAILABILITY_LABELS, AVAILABILITY_OPTIONS (+4 more)

### Community 107 - "Community 107"
Cohesion: 0.12
Nodes (12): inferResponseStatus(), NDIS_MGMT_CLASS, NDIS_MGMT_LABELS, NdisManagementType, normalizeStatus(), QuotesPageContent(), QuoteStatus, sanitizeStatus() (+4 more)

### Community 108 - "Community 108"
Cohesion: 0.11
Nodes (17): Admin Agent Active Issues, Crew Briefing Agent, Admin Agent Decisions, Admin Agent Findings, NDIS Plan Matcher Agent, Quote Triage Agent, Admin Agent README, Admin Agent Reports (+9 more)

### Community 109 - "Community 109"
Cohesion: 0.13
Nodes (19): BudLeadsWorkspace Component, Bud Leads Workspace (Dashboard UI), MESSENGER_APP_SECRET Environment Variable, MESSENGER_INGEST_SECRET Environment Variable, MESSENGER_VERIFY_TOKEN Environment Variable, NEXT_PUBLIC_BASE_URL Environment Variable, Facebook Developer Console, Facebook Graph API Profile Lookup (+11 more)

### Community 110 - "Community 110"
Cohesion: 0.16
Nodes (16): DistanceConfiguratorProps, DistanceRouteConfigurator, loaderCache, loadGoogleMapsOnce(), LoadGoogleMapsOptions, normalizeLibraries(), QLD_BOUNDS, fetchDrivingDistance() (+8 more)

### Community 111 - "Community 111"
Cohesion: 0.11
Nodes (19): Admin (Wiki Note), Audit Log + Role-Based Access, Automations Log (Wiki Note), Crew Portal (/crew), Customer Portal (/portal), Engineering (Wiki Note), Google Ads Conversion Tracking, ICE Scoring Framework (+11 more)

### Community 112 - "Community 112"
Cohesion: 0.16
Nodes (17): clampMultiplier(), computeCoverageHours(), ConditionLevel, estimateGardenHours(), estimateGutterHours(), estimateHedgeHours(), estimateLawnHours(), estimatePressureHours() (+9 more)

### Community 113 - "Community 113"
Cohesion: 0.13
Nodes (15): UseEmployeeReturn, JobDetailPage(), AvailableJobsPage(), JobAssignment, MyJobsPage(), Tab, ScheduleJob, SERVICE_HOURS (+7 more)

### Community 114 - "Community 114"
Cohesion: 0.22
Nodes (17): ANTHROPIC_API_KEY(), callLLM(), fetchRunHistory(), generateAllReports(), generateReport(), RunSummary, capitalise(), getActiveIssues() (+9 more)

### Community 115 - "Community 115"
Cohesion: 0.13
Nodes (9): formatRelativeTime(), LearningCard(), SimulateOutcome, formatDuration(), Props, rejectionRate(), rollbackRate(), SURFACE_LABEL (+1 more)

### Community 116 - "Community 116"
Cohesion: 0.11
Nodes (17): Buds At Work Application, Agents Lobby Medieval Keep Page, Google Fonts (Cinzel, Lora, UnifrakturMaguntia), compat, __dirname, __filename, devDependencies, eslint (+9 more)

### Community 117 - "Community 117"
Cohesion: 0.13
Nodes (7): EXCLUDED_PATHS, PostHogProvider(), metadata, viewport, SkipLinks(), LocalBusinessSchema(), WebsiteSchema()

### Community 118 - "Community 118"
Cohesion: 0.16
Nodes (10): captureLeadAttribution(), getLeadAttribution(), getOrCreatePublicAnalyticsSessionId(), getPublicAnalyticsSessionId(), trackPublicAnalyticsEvent(), AnalyticsEventData, AnalyticsScalar, LeadAttribution (+2 more)

### Community 119 - "Community 119"
Cohesion: 0.11
Nodes (7): CHAT_MESSAGES, COLORS, EMPLOYEES, MESSAGES, NAV, NEWS, TASKS

### Community 120 - "Community 120"
Cohesion: 0.20
Nodes (15): adminClient(), CallModelResult, createQuoteEffect(), dispatchEffect(), executeApprovedAction(), flagForReviewEffect(), PRICING_PER_MTOK, RUN_TIMEOUT_MS (+7 more)

### Community 121 - "Community 121"
Cohesion: 0.21
Nodes (16): Admin UX Designer Agent, PageAudit, PageAudit, heatmap-analyst, layout-critic, Page: /crew, Page: /dashboard, Page: /portal (+8 more)

### Community 122 - "Community 122"
Cohesion: 0.20
Nodes (16): Finding: Admin Optimization Agent — Baseline Seed, Decision: Introduce Admin Optimization as a Dedicated Operational Intelligence Agent, admin_optimization_findings (Supabase Table), /dashboard/automations, /dashboard/crew, /dashboard/quotes, /dashboard/schedule, Friction Scoring Formula (+8 more)

### Community 123 - "Community 123"
Cohesion: 0.13
Nodes (11): CompetitorRow, computeCompetitorBand(), CrewRow, DEFAULTS, JobRow, ModelOutput, percentile(), PriceOptimizerConfig (+3 more)

### Community 124 - "Community 124"
Cohesion: 0.18
Nodes (13): coerceLeadSource(), hostFromReferrer(), LeadSource, LeadSourceInput, normalize(), REFERRER_HOST_PATTERNS, resolveLeadSource(), UTM_SOURCE_MAP (+5 more)

### Community 125 - "Community 125"
Cohesion: 0.12
Nodes (15): name, private, scripts, build, build:turbopack, dev, dev:turbopack, lint (+7 more)

### Community 126 - "Community 126"
Cohesion: 0.13
Nodes (7): Order, sanitizeScheduleState(), SchedulePageContent(), SERVICE_COLORS, View, DAYS, SERVICE_LABELS

### Community 127 - "Community 127"
Cohesion: 0.12
Nodes (16): Admin (Wiki Note), Average Job Value Metric, Data & Analytics, Engineering (Wiki Note), Finance (Wiki Note), Gross Margin Metric, Labour % Metric, Monthly Revenue Metric (+8 more)

### Community 128 - "Community 128"
Cohesion: 0.21
Nodes (14): AddressGeocode, extractMMM(), fetchMMMGeoJson(), geocodeAddressForMMM(), GeoJsonFeature, GeoJsonFeatureCollection, GeoJsonGeometry, getMMM() (+6 more)

### Community 129 - "Community 129"
Cohesion: 0.18
Nodes (15): dashboard/route.ts, types/dashboard.ts, insights/leads/ Directory, Dev Log Session c203c649 (19:33), ui/theme.ts, InsightsPage(), lead_conversations, lead_follow_ups (+7 more)

### Community 130 - "Community 130"
Cohesion: 0.20
Nodes (14): AdrInput, AdrStatus, DEV_DIR, INDEX, interactive(), localDate(), main(), nextAdrNumber() (+6 more)

### Community 131 - "Community 131"
Cohesion: 0.12
Nodes (12): Intel, IntelClient(), SERVICE_LABELS, Setting, CrewHomePage(), CrewStats, DAYS_SHORT, DOC_LABELS (+4 more)

### Community 132 - "Community 132"
Cohesion: 0.15
Nodes (15): Trial Arbiter Agent, Autonomy: Auto (at-will), Autonomy: Manual (by-summons), Bugler Agent, Town Crier Agent, Court Wizard Agent, Lead Ranger Agent, Royal Notary Agent (+7 more)

### Community 133 - "Community 133"
Cohesion: 0.21
Nodes (15): github-historian Agent (ADR Drafts Context), ADR Drafts README, Bug Tracker (Deployments Context), Deployments README, ADR-Index, Bug Tracker, github_events (Supabase Table), github-historian Agent (+7 more)

### Community 134 - "Community 134"
Cohesion: 0.21
Nodes (15): .bw-* Utility Classes, colors_and_type.css (Design Handoff), brand.accent Colour Token (#10b981 / #1C7C54), brand.accentSoft Colour Token (#DDF3E4), brand.primary Colour Token (#0F3D2E), home:cta-enter / home:cta-leave Custom Events, Rotating Headline Words Animation, CSS Design Tokens (:root variables) (+7 more)

### Community 135 - "Community 135"
Cohesion: 0.19
Nodes (10): blendTextures(), DirtyBlendUserData, mapZoneHit(), ShaderLike, CarSelectionPayload, CarType, CarZone, defaultPriceConfig (+2 more)

### Community 136 - "Community 136"
Cohesion: 0.19
Nodes (11): buildCapabilityTags(), buildFlags(), buildReadinessMeta(), CREW_ROLES, CrewScore, extractNoteFlags(), formatCapability(), ReadinessStatus (+3 more)

### Community 137 - "Community 137"
Cohesion: 0.16
Nodes (12): BOOSTS, end, format(), full, h1, main(), Note, rel (+4 more)

### Community 138 - "Community 138"
Cohesion: 0.21
Nodes (13): ADR_SIGNALS, ContentBlock, DEV_DIR, editedFiles(), hasAdrSignal(), hhmm(), isoDate(), main() (+5 more)

### Community 139 - "Community 139"
Cohesion: 0.13
Nodes (12): Applicant, COMMUNITY_ROLES, COMMUNITY_STAGE_LABELS, COMMUNITY_STAGES, CREW_ROLES, GroupFilter, ROLE_COLORS, ROLE_LABELS (+4 more)

### Community 140 - "Community 140"
Cohesion: 0.16
Nodes (4): LOCAL_LANDING_PAGE_LIST, rows, Slug, SLUGS

### Community 141 - "Community 141"
Cohesion: 0.18
Nodes (11): Design System, ConsolidationCandidate, SpecDecision, Violation, AUDIT_AREAS, AuditArea, buildAuditContext(), ComponentStandard (+3 more)

### Community 143 - "Community 143"
Cohesion: 0.16
Nodes (8): formatDuration(), Props, rejectionRate(), rollbackRate(), TelemetryStrip(), AutonomyPipeline.tsx, Supabase Realtime, SurfaceLabel

### Community 144 - "Community 144"
Cohesion: 0.36
Nodes (13): appendToNote(), budRoot(), categoryDir(), ensureDir(), isoDate(), isoTs(), readNote(), vaultRoot() (+5 more)

### Community 145 - "Community 145"
Cohesion: 0.14
Nodes (8): Agent, CAT, Insight, LobbyClient(), Pending, POSITIONS, Props, Run

### Community 146 - "Community 146"
Cohesion: 0.19
Nodes (13): buildStructuredFailure(), classify(), extractAffectedFiles(), extractFailedStep(), extractStack(), NETWORK_PATTERNS, PARSE_PATTERNS, PERMISSION_PATTERNS (+5 more)

### Community 147 - "Community 147"
Cohesion: 0.20
Nodes (14): Bug Tracker, Checklist Template, Bug: checkout.session.expired Not Handled, Bug: Commercial Niche Scope Cards Never Selected, Bug: payment_intent.payment_failed Not Handled, Bug: Phone Scroll-to-Invalid Digit Threshold, Bug: No Server-Side Validation in POST /api/quotes, Quote Flow (+6 more)

### Community 148 - "Community 148"
Cohesion: 0.15
Nodes (14): charge.dispute.created Webhook, charge.refunded Webhook, Email Triggers, Failed Payment SOP, NDIS Pricing Rewrite & Stripe Hardening — April 2026, New Booking SOP, Quote Flow, Services Flow Improvements — April 2026 (+6 more)

### Community 149 - "Community 149"
Cohesion: 0.22
Nodes (13): appendToCLAUDEMd(), CATEGORIES, Category, CLAUDE_MD, gather(), main(), parseArgs(), postToAPI() (+5 more)

### Community 150 - "Community 150"
Cohesion: 0.16
Nodes (10): AreaFinding, AreaResult, avg(), avgDaysInPipeline(), buildFindingBody(), FOCUS_AREAS, FocusAreaId, FrictionScore (+2 more)

### Community 151 - "Community 151"
Cohesion: 0.16
Nodes (11): calculate_outstanding_receivables(), calculate_pending_payables(), customers, orders, payables, rego_cache, update_payables_updated_at, update_rego_cache_updated_at (+3 more)

### Community 152 - "Community 152"
Cohesion: 0.14
Nodes (13): activeTile, addressInput, backBtn, cleaningTile, commercialTab, getQuoteBtn, homeTab, ndisTab (+5 more)

### Community 153 - "Community 153"
Cohesion: 0.15
Nodes (12): AgentLifecycleState, AgentMetrics, COMPLIANCE_IDS, CUSTOMER_IDS, FINANCE_IDS, foremanAgent, GROWTH_IDS, LIVE_OPS_IDS (+4 more)

### Community 154 - "Community 154"
Cohesion: 0.27
Nodes (11): ConstitutionRule, ConstitutionRuleSeverity, constitutionToPrompt(), isUiFile(), VIOLATION_WEIGHTS, buildSystemPrompt(), buildUserPrompt(), failOpen() (+3 more)

### Community 155 - "Community 155"
Cohesion: 0.32
Nodes (11): adminClient(), GET(), POST(), src/lib/bud/orchestrator.ts, AGENT_DEFAULT_MODEL env var (claude-sonnet-4-6), BUD_AUTONOMY_LEVEL env var, Bud Autonomy Level System, Buds OS — Agentic AI Operating System (+3 more)

### Community 156 - "Community 156"
Cohesion: 0.19
Nodes (13): Automation Opportunities, Compliance Documents, Contractor vs Employee, Crew Portal, Crew Roles, Dashboard /applicants Route, Document Expiry & Alerts, employee_payroll_details (Supabase Table) (+5 more)

### Community 158 - "Community 158"
Cohesion: 0.21
Nodes (10): TONE_STYLES, WorkbenchHeader(), WorkbenchQueue(), WorkbenchStat, WorkbenchTab, Customer, CustomerPageContent(), CustomerView (+2 more)

### Community 159 - "Community 159"
Cohesion: 0.22
Nodes (13): Analytics Behavior Library, Analytics Providers Aggregator, App Root Layout, Microsoft Clarity Init Component, Design System Agent (Concept), Design System Agent, Design System Rules, Dev Session c809b4fb (2026-05-18) (+5 more)

### Community 160 - "Community 160"
Cohesion: 0.27
Nodes (12): Checklist Template, Assignment, employee_documents, employees, trg_checklist_templates_updated_at, trg_employee_documents_updated_at, trg_employee_onboarding_updated_at, trg_employees_updated_at (+4 more)

### Community 161 - "Community 161"
Cohesion: 0.35
Nodes (13): emailRatelimit, AWS SES (Alternate Provider), budsatwork.com Application, DNS Records (SPF/DKIM/MX), Supabase SMTP Setup Guide for budsatwork.com, Email Deliverability, Postmark (Alternate Provider), Resend (Email Provider) (+5 more)

### Community 162 - "Community 162"
Cohesion: 0.17
Nodes (11): AgentLifecycleState, budAgent, COMPLIANCE_IDS, CUSTOMER_IDS, FINANCE_IDS, GROWTH_IDS, LIVE_OPS_IDS, LobbyKPIs (+3 more)

### Community 163 - "Community 163"
Cohesion: 0.29
Nodes (12): checkAgentFailureRate(), checkProductionHealth(), getConversionBaseline(), getConversionNow(), getLatestVercelDeployment(), getVercelDeploymentErrors(), scheduledHealthCheck(), TelemetryCheckResult (+4 more)

### Community 164 - "Community 164"
Cohesion: 0.23
Nodes (11): BrowserRunRow, BrowserTestResult, collectFailures(), execFileAsync, parsePlaywrightJson(), PlaywrightJsonReport, PlaywrightSpec, PlaywrightSuite (+3 more)

### Community 165 - "Community 165"
Cohesion: 0.20
Nodes (12): brand tokens, Continuous Learning Loop, glass token, glassSoft token, Panel component, Shared Components (components/shared/index.tsx), StatRow component, StatusChip component (+4 more)

### Community 166 - "Community 166"
Cohesion: 0.26
Nodes (11): classifyVehicle(), deriveSizeCategory(), emptyScores(), includesAny(), KB, KnowledgeBase, normalize(), PRIORITY (+3 more)

### Community 167 - "Community 167"
Cohesion: 0.24
Nodes (10): GET(), Params, POST(), requireAdmin(), AccountNotifications, DEFAULT_NOTIFICATIONS, GET(), normalizeNotifications() (+2 more)

### Community 168 - "Community 168"
Cohesion: 0.23
Nodes (8): AvailabilityMap, DAY_LABELS, DAYS, defaultAvailabilityMap(), formatSlotForDisplay(), parseSlot(), slotsToMap(), ProfilePage()

### Community 169 - "Community 169"
Cohesion: 0.24
Nodes (7): runAgent(), GET(), POST(), GET(), POST(), pctx, POST()

### Community 170 - "Community 170"
Cohesion: 0.17
Nodes (10): STAGE_BY_ID, StageDefinition, STAGES, PipelineAgentScore, PipelineKpis, PipelineRun, PipelineRunDetail, PipelineRunStatus (+2 more)

### Community 171 - "Community 171"
Cohesion: 0.24
Nodes (11): Commit 6ae4a76, Context-Aware Condition Section Label, Condition Tiles with Contextual Icons, NDIS Cleaning/Yard Quote Panel, ndisStep2Panel IIFE Block, NDIS Step 2 Visual Redesign — May 2026, Room Stepper Icons, Schedule Tiles with Time-of-Day Icons (+3 more)

### Community 172 - "Community 172"
Cohesion: 0.24
Nodes (10): Props, QuoteAssistantTrigger(), TRIGGER_LABEL, Context, M, MButton(), MDiv(), MOTION_PROPS (+2 more)

### Community 174 - "Community 174"
Cohesion: 0.20
Nodes (7): DAYS, ScheduleOrder, ScheduleTab(), SERVICE_COLORS, SERVICE_LABELS, TodayView, VIEWS

### Community 175 - "Community 175"
Cohesion: 0.29
Nodes (10): /api/crew/employees/[employeeId]/approve (API Endpoint), canConvertToStaff Logic, src/app/(app)/dashboard/crew/[employeeId]/documents/page.tsx, employees (Supabase Table), Crew Pipeline Fix & Approval Flow — May 2026, isApprovalAction Flag, 027_crew_pipeline_staff_setup.sql (Migration), src/app/api/crew/pipeline/route.ts (+2 more)

### Community 176 - "Community 176"
Cohesion: 0.40
Nodes (9): bud_improvement_executions, bud_improvement_learnings, bud_improvement_logs, bud_improvement_signals, bud_improvement_steps, bud_telemetry_events, trg_improvement_executions_updated_at, trg_improvement_signals_updated_at (+1 more)

### Community 177 - "Community 177"
Cohesion: 0.22
Nodes (9): args, main(), OUTCOME, SCRIPT, sleep(), StageId, STAGES, supabase (+1 more)

### Community 178 - "Community 178"
Cohesion: 0.27
Nodes (10): Automations Log, Checklist: Payment Flow End-to-End Test, Automations Dashboard Page (/dashboard/automations), Bug Tracker, Failed Payment, New Booking, Quote Flow, Refund Process (+2 more)

### Community 179 - "Community 179"
Cohesion: 0.29
Nodes (7): gtag(), trackPaymentCompleted(), trackQuoteSubmitted(), Window, OrderSummary, formatAUD(), OrderDetails

### Community 180 - "Community 180"
Cohesion: 0.22
Nodes (9): args, main(), OUTCOME, SCRIPT, sleep(), StageId, STAGES, supabase (+1 more)

### Community 181 - "Community 181"
Cohesion: 0.22
Nodes (9): EMPTY_ORG, EMPTY_PART, formatDate(), MatchingJob, NdisOrg, NdisPage(), OrgStatus, Participant (+1 more)

### Community 182 - "Community 182"
Cohesion: 0.33
Nodes (9): buildNote(), extractInlineTags(), parseFrontmatter(), parseYamlScalar(), parseYamlValue(), serializeFrontmatter(), serializeYamlValue(), splitFrontmatter() (+1 more)

### Community 183 - "Community 183"
Cohesion: 0.20
Nodes (9): public.cash_flow_forecasts, public.competitor_pages, public.content_drafts, public.crew_coach_notes, public.knowledge_articles, public.lapsed_outreach, public.ndis_plan_matches, public.stripe_disputes (+1 more)

### Community 184 - "Community 184"
Cohesion: 0.20
Nodes (9): cleaningOption, commercialButton, continueButton, h1, homeButton, ndisButton, pageContent, windowsOption (+1 more)

### Community 185 - "Community 185"
Cohesion: 0.22
Nodes (8): author, authorUrl, description, id, isDesktopOnly, minAppVersion, name, version

### Community 186 - "Community 186"
Cohesion: 0.31
Nodes (8): Job Matching Workflow, NDIS Participant Workers, Safety Flags, Support Profile, ndis_organisations, set_ndis_org_updated_at(), trg_ndis_org_updated_at, NDIS Participant Matching — May 2026

### Community 187 - "Community 187"
Cohesion: 0.22
Nodes (9): Cron: Remind Quotes Route, Orders API Route, Payables API Route, QuickActions Component, Resend Email Service, Supabase Orders Table, Supabase Payables Table, Vercel Cron Auto-Reminders (+1 more)

### Community 188 - "Community 188"
Cohesion: 0.42
Nodes (8): customers, orders, subscription_orders, subscriptions, update_customers_updated_at, update_orders_updated_at, update_subscriptions_updated_at, update_updated_at_column()

### Community 189 - "Community 189"
Cohesion: 0.44
Nodes (8): public.agent_actions, public.agent_memory, public.agent_runs, public.agents, public.set_updated_at(), public.v_pending_agent_actions, trg_agent_memory_updated_at, trg_agents_updated_at

### Community 190 - "Community 190"
Cohesion: 0.42
Nodes (8): public.bud_deployment_verifications, public.bud_lobby_states, public.bud_repair_executions, public.bud_repair_learnings, public.bud_repair_logs, public.bud_repair_steps, public.bud_tasks, public.bud_terminal_sessions

### Community 191 - "Community 191"
Cohesion: 0.33
Nodes (7): public.pipeline_agent_scores, public.pipeline_artifacts, public.pipeline_kill_switch, public.pipeline_kpis_7d, public.pipeline_policy, public.pipeline_runs, public.pipeline_stage_events

### Community 192 - "Community 192"
Cohesion: 0.22
Nodes (8): apiKey, crypto, cert, privateKey, publicKey, enableSecureServer, insecurePort, port

### Community 193 - "Community 193"
Cohesion: 0.25
Nodes (5): Agent, AgentCard(), badge(), CATEGORY_DOTS, Stat

### Community 194 - "Community 194"
Cohesion: 0.31
Nodes (5): ServicesAuthBar(), cx(), Header(), navLinks, portalLink()

### Community 195 - "Community 195"
Cohesion: 0.22
Nodes (3): LatLng, Props, YardJob

### Community 196 - "Community 196"
Cohesion: 0.22
Nodes (6): Pipeline Stage Fill Bar, Pipeline Stages, OrderRow, SERVICE_LABELS, Stage, STAGES

### Community 197 - "Community 197"
Cohesion: 0.25
Nodes (8): Outcome, POST(), SCRIPT, sleep(), StageId, STAGES, VALID_OUTCOMES, VALID_SURFACES

### Community 198 - "Community 198"
Cohesion: 0.22
Nodes (8): public.applicants, public.customers, public.employees, public.job_assignments, public.job_completions, public.orders, public.subscription_orders, public.subscriptions

### Community 199 - "Community 199"
Cohesion: 0.33
Nodes (7): public.pipeline_agent_scores, public.pipeline_artifacts, public.pipeline_kill_switch, public.pipeline_kpis_7d, public.pipeline_policy, public.pipeline_runs, public.pipeline_stage_events

### Community 200 - "Community 200"
Cohesion: 0.25
Nodes (4): SearchResult, typeColors, typeLabels, debounce()

### Community 201 - "Community 201"
Cohesion: 0.25
Nodes (4): MetricRow, ReportsView(), ReportsViewProps, TREND_ICON

### Community 202 - "Community 202"
Cohesion: 0.39
Nodes (8): Agent: A/B Test Architect, Agent: Copy Optimizer, Agent: Heatmap Analyst, Agent: Layout Critic, Concept: Design Insight Loop, DB Table: design_insights, External: Lucky Orange v2 API, Lucky Orange API Client

### Community 203 - "Community 203"
Cohesion: 0.39
Nodes (5): analytics_sessions, orders, page_views, quotes, visitor_events

### Community 204 - "Community 204"
Cohesion: 0.43
Nodes (7): public.graph_degree(), public.graph_export(), public.graph_neighbors(), public.graph_shortest_path(), public.memory_contradiction_log, public.memory_edges, public.memory_graph_extractions

### Community 205 - "Community 205"
Cohesion: 0.32
Nodes (7): public.bud_activity_feed, public.bud_approval_queue, public.bud_audit_logs, public.bud_change_requests, public.bud_insights, public.bud_lobby_states, public.bud_tasks

### Community 206 - "Community 206"
Cohesion: 0.25
Nodes (5): Order, SERVICE_ICONS, SERVICE_LABELS, STATUS_STEPS, TabKey

### Community 207 - "Community 207"
Cohesion: 0.29
Nodes (5): fmt(), PayConfirmModal(), SERVICE_ICONS, SERVICE_LABELS, Quote

### Community 208 - "Community 208"
Cohesion: 0.25
Nodes (5): convoInsert, InsertCapture, inserted, leadInsert, req

### Community 209 - "Community 209"
Cohesion: 0.32
Nodes (7): basePayout, DbCall, mocks, payloadFor(), postEvent(), signedRequest(), stripe

### Community 210 - "Community 210"
Cohesion: 0.33
Nodes (5): employees, handle_new_user(), on_auth_user_created, profiles, trg_profiles_updated_at

### Community 211 - "Community 211"
Cohesion: 0.48
Nodes (6): memory_documents_updated_at, public.memory_documents, public.memory_read_log, public.refresh_memory_freshness(), public.search_memory(), public.touch_memory_document()

### Community 212 - "Community 212"
Cohesion: 0.57
Nodes (6): design_audits, design_duplication_queue, design_latest_audit, design_open_critical, design_score_trend, design_violations

### Community 213 - "Community 213"
Cohesion: 0.29
Nodes (6): AssistantRegoLookup(), DETECTED_ANSWER_IDS, DetectedVehicle, Props, readDetectedVehicle(), STATES

### Community 214 - "Community 214"
Cohesion: 0.43
Nodes (5): fetchSenderProfile(), GraphProfile, ingestEvent(), verifyMetaSignature(), POST()

### Community 215 - "Community 215"
Cohesion: 0.29
Nodes (5): FeedbackItem, STATUS_COLORS, StatusFilter, TYPE_COLORS, TYPE_LABELS

### Community 217 - "Community 217"
Cohesion: 0.38
Nodes (7): Dev Log 2026-05-17, ivfflat Index, OpenAI Embeddings, pgvector, ADR-0001: Use pgvector for Memory Semantic Search, Semantic Search, Supabase

### Community 218 - "Community 218"
Cohesion: 0.48
Nodes (6): callLLM(), condenseMemory(), maybeCondense(), MemoryNote, mergeMemories(), Anthropic API

### Community 219 - "Community 219"
Cohesion: 0.33
Nodes (6): public.admin_ux_proposals, public.agent_evolutions, public.competitor_intel, public.enforce_single_active_theme(), public.lobby_themes, trg_lobby_themes_single_active

### Community 220 - "Community 220"
Cohesion: 0.29
Nodes (6): createBudTask, from, getAuthUser, queueApproval, update, writeBudActivity

### Community 221 - "Community 221"
Cohesion: 0.29
Nodes (6): cta, h1, images, img, nav, serviceHeadings

### Community 222 - "Community 222"
Cohesion: 0.33
Nodes (6): Active-Issues Folder Index — Analytics Agent, Analytics Agent Workspace Overview, Decisions Folder Index — Analytics Agent, Findings Folder Index — Analytics Agent, Reports Folder Index — Analytics Agent, Reviews Agent

### Community 223 - "Community 223"
Cohesion: 0.33
Nodes (6): AgentWorkflow, WORKFLOW_AGENT_IDS, WorkflowDomain, WORKFLOWS, workflowsByAgent(), WorkflowType

### Community 224 - "Community 224"
Cohesion: 0.33
Nodes (4): Agent, RecentRuns(), Run, STATUS_COLOR

### Community 225 - "Community 225"
Cohesion: 0.53
Nodes (6): Car Fallback SVG, Buds at Work Brand, Get a Quote CTA, Local Home & Property Services, Logan & South Brisbane, OG Image SVG

### Community 227 - "Community 227"
Cohesion: 0.53
Nodes (5): public.bud_repair_learnings, public.bud_rollback_events, search_repair_learnings(), v_bud_repair_success_rate, v_bud_rollback_trends

### Community 228 - "Community 228"
Cohesion: 0.33
Nodes (6): load(), "node_modules/body-parser/node_modules/debug/src/node.js"(), "node_modules/express/node_modules/debug/src/node.js"(), "node_modules/finalhandler/node_modules/debug/src/browser.js"(), "node_modules/finalhandler/node_modules/debug/src/node.js"(), "node_modules/send/node_modules/debug/src/node.js"()

### Community 229 - "Community 229"
Cohesion: 0.40
Nodes (6): authenticationMiddleware(), display(), getCertificateIsUptoStandards(), getCertificateValidityDays(), requestIsAuthenticated(), root()

### Community 230 - "Community 230"
Cohesion: 0.47
Nodes (6): forward-to-obsidian job, GitHub Historian Agent, trigger-historian job, Obsidian Vault (memory system), Buds At Work Webhook Handler (budsatwork.com/api/webhooks/github), Obsidian Memory Events workflow

### Community 231 - "Community 231"
Cohesion: 0.40
Nodes (6): CAPTCHA Expiry State, hasMinimumWork Computed Value, Phone +61 Normalisation, Step Progress Bar, Trust Signals on Step 3, Services Wizard Page (services/page.tsx)

### Community 232 - "Community 232"
Cohesion: 0.40
Nodes (4): formatAUD(), PayPage(), QuoteDetails, Window

### Community 233 - "Community 233"
Cohesion: 0.33
Nodes (3): EmployeeCard, FilterKey, OnboardingPipelinePage()

### Community 234 - "Community 234"
Cohesion: 0.73
Nodes (5): AnalyticsFinding, analytics_funnels, analytics_latest_report, analytics_open_critical, analytics_reports

### Community 235 - "Community 235"
Cohesion: 0.33
Nodes (4): from, getAuthUser, table, writeBudActivity

### Community 236 - "Community 236"
Cohesion: 0.33
Nodes (5): body, isProtectedPage, PROTECTED_ROUTES, PUBLIC_ROUTES, url

### Community 237 - "Community 237"
Cohesion: 0.60
Nodes (5): Next.js Config (withSentryConfig), Sentry Client Config, Sentry Edge Config, Sentry Error Tracking Integration, Sentry Server Config

### Community 238 - "Community 238"
Cohesion: 0.40
Nodes (5): quotes/[id]/checkout/route.ts, STRIPE_API_VERSION (2024-09-30.acacia), stripe/server.ts, @upstash/ratelimit, @upstash/redis

### Community 239 - "Community 239"
Cohesion: 0.40
Nodes (5): debounce(), loadSettings(), onload(), saveSettings(), setupRouter()

### Community 240 - "Community 240"
Cohesion: 0.40
Nodes (5): detectDeviceLabel(), formatDateTime(), formatRole(), getLocation(), SettingsWorkspace()

### Community 242 - "Community 242"
Cohesion: 0.40
Nodes (3): VALID_SEVERITIES, VALID_SIGNAL_TYPES, VALID_SURFACES

### Community 243 - "Community 243"
Cohesion: 0.40
Nodes (4): cta, ndisContent, ndisTab, scopeCard

### Community 244 - "Community 244"
Cohesion: 0.60
Nodes (4): extractErrorSummary(), fetchBuildLogs(), POST(), VercelWebhookPayload

### Community 245 - "Community 245"
Cohesion: 0.50
Nodes (3): hooks, Stop, UserPromptSubmit

### Community 246 - "Community 246"
Cohesion: 0.83
Nodes (3): GET(), makeClient(), POST()

### Community 247 - "Community 247"
Cohesion: 0.67
Nodes (4): Idempotent Migration Pattern (DROP POLICY IF EXISTS), Dev Session 579fc844 (2026-05-20 00:02), src/middleware.ts, supabase/migrations/054_bud_os.sql

### Community 248 - "Community 248"
Cohesion: 0.50
Nodes (3): audit_log, quotes, ratings

### Community 249 - "Community 249"
Cohesion: 0.67
Nodes (3): public.pricing_recommendations, public.service_pricing, public.v_pricing_recs_pending

### Community 250 - "Community 250"
Cohesion: 0.83
Nodes (3): client(), GET(), POST()

### Community 251 - "Community 251"
Cohesion: 0.83
Nodes (3): GithubEventRow, github_adr_queue, github_recent_failures

### Community 252 - "Community 252"
Cohesion: 0.50
Nodes (4): G(), k(), M(), "node_modules/marked/lib/marked.esm.js"()

### Community 253 - "Community 253"
Cohesion: 0.50
Nodes (4): findHeadingBoundary(), getSplicePosition(), isPatchOperation(), _vaultPatch()

### Community 255 - "Community 255"
Cohesion: 0.83
Nodes (3): adminClient(), GET(), POST()

### Community 256 - "Community 256"
Cohesion: 0.83
Nodes (3): adminClient(), GET(), PATCH()

### Community 257 - "Community 257"
Cohesion: 0.83
Nodes (3): client(), GET(), POST()

### Community 258 - "Community 258"
Cohesion: 0.50
Nodes (3): public.job_photos, public.phone_calls, public.quotes

### Community 259 - "Community 259"
Cohesion: 0.50
Nodes (3): public.agent_workflow_memberships, public.foreman_insights, public.foreman_lobby_states

### Community 260 - "Community 260"
Cohesion: 0.50
Nodes (4): Next.js Platform, Vercel Platform, Next.js Logo SVG, Vercel Logo SVG

### Community 271 - "Community 271"
Cohesion: 0.67
Nodes (3): webhooks/stripe/route.ts, stripe-webhook.test.ts, vitest.config.ts

### Community 272 - "Community 272"
Cohesion: 0.67
Nodes (3): E(), "node_modules/obsidian-dataview/lib/index.js"(), r

## Knowledge Gaps
- **1818 isolated node(s):** `crons`, `config`, `name`, `version`, `private` (+1813 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **92 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Brand` connect `Community 36` to `Community 131`, `Community 5`, `Community 10`, `Community 139`, `Community 140`, `Community 12`, `Community 14`, `Community 142`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 26`, `Community 28`, `Community 158`, `Community 32`, `Community 33`, `Community 168`, `Community 41`, `Community 172`, `Community 46`, `Community 47`, `Community 174`, `Community 49`, `Community 51`, `Community 181`, `Community 60`, `Community 194`, `Community 196`, `Community 69`, `Community 200`, `Community 201`, `Community 74`, `Community 75`, `Community 76`, `Community 206`, `Community 207`, `Community 80`, `Community 213`, `Community 215`, `Community 88`, `Community 216`, `Community 91`, `Community 98`, `Community 233`, `Community 106`, `Community 107`, `Community 113`, `Community 241`, `Community 126`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `ActivityFeed()` connect `Community 47` to `Community 33`, `Community 36`, `Community 75`, `Community 14`, `Community 24`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `createServiceClient()` connect `Community 1` to `Community 35`, `Community 39`, `Community 8`, `Community 136`, `Community 167`, `Community 10`, `Community 17`, `Community 19`, `Community 23`, `Community 86`, `Community 214`, `Community 22`, `Community 124`, `Community 30`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Improvement Executor` (e.g. with `API Route: /api/bud/improve` and `GitHub Executor`) actually correct?**
  _`Improvement Executor` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `crons`, `config`, `name` to the rest of the system?**
  _1828 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.010582010582010581 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.028430345653149783 - nodes in this community are weakly interconnected._