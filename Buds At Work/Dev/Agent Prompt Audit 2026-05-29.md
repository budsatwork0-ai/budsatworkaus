# Agent Prompt Audit — Are the agents running real prompts or stubs?

**Date:** 2026-05-29
**Scope:** `src/lib/agents/` — runtime, registry, and all 42 agent definition files.
**Verdict:** The agents are **real**, not stubbed. Every registered agent calls the live model and the live database. The only fakery is two env-gated *data inputs* and one piece of dead legacy code.

---

## How the runtime actually works (it's real)

`src/lib/agents/runtime.ts` is a genuine execution layer, not a mock:

- `callModel()` POSTs to `https://api.anthropic.com/v1/messages` with real prompt caching, retry/backoff on 429/529/503, and a fleet-wide circuit breaker.
- Token usage and USD cost are computed per call and persisted to `agent_runs` (`input_tokens`, `output_tokens`, `cost_cents`, `cache_*`).
- Approved actions run **real effects** via `dispatchEffect`: `send_email` (Resend), `send_sms` (Twilio), `create_quote` / `schedule_job` / `update_service_price` (Supabase writes).
- Guardrails (depth caps, loop detection, drift/cost checks) wrap every LLM call, action, and child-agent call.

So the plumbing the console reports on is genuine.

## Agent-by-agent signal

Across 42 files: **41 are registered** in `registry.ts` and wired to the runtime. Static scan results:

- **No `Math.random()` fabrication** anywhere.
- Almost every agent calls `ctx.llm(...)` with a real, domain-specific system prompt and queries Supabase for real inputs.
- The handful with **zero LLM calls** (`cash-flow-forecaster`, `crew-briefing`, `ndis-compliance`, `photo-qa`, `reconciliation`, `whs-safety-reminder`) are legitimately **deterministic** — they compute from real DB rows and propose real actions. Example: `whs-safety-reminder` reads `whs_records` + `crew_members` and proposes real `send_sms` / `flag_for_review`. That's correct design, not a stub. (`photo-qa` and `yard-map-geo` call the vision API directly rather than through `ctx.llm`.)

## The only genuine stubs (2) — both are env-gated data inputs, not fake prompts

1. **`scheduling.ts` — weather is hardcoded.**
   `fetchBrisbaneForecast()` always returns `{ rain_probability: 0.2, high_c: 26, low_c: 17 }` with a comment: *"Plug into BOM or OpenWeather here."* The prompt, crew/job data, and LLM call are real, but the rain-based reschedule logic runs on fake weather until a provider is wired. **Impact:** medium — scheduling decisions ignore real rain.

2. **`yard-map-geo.ts` — satellite image falls back to a placeholder.**
   If `GOOGLE_MAPS_API_KEY` is unset, `staticMapUrl()` returns `https://placeholder.budsatwork.com/satellite?...`, which the vision model can't actually read. With the key set, it uses real Google Static Maps. **Impact:** medium — yard sizing is only real when the Maps key is configured.

Neither is a fake *prompt*; both are missing *external integrations* with dev fallbacks.

## Dead legacy code found (not a stub, but worth knowing)

**The Foreman** is fully superseded by Bud and is now broken cruft:

- `foreman.ts` exports `foremanAgent` but it is **not in `AGENT_REGISTRY`**, so `runAgent('foreman')` throws *"Unknown agent: foreman"*.
- `/api/agents/foreman/route.ts` still calls `runAgent({ agentId: 'foreman' })` → would 500.
- `agents/lobby/page.tsx` (which renders `ForemanConsole`) **redirects to Mission Control**, so the console is unreachable.

Recommended (separate change, needs approval): delete `foreman.ts`, `/api/agents/foreman/route.ts`, and `ForemanConsole.tsx`, or re-register Foreman if it's still wanted. Left untouched for now.

## Bottom line

The "fake prompts" worry does **not** apply to the agent layer — prompts and execution are real. The fake feeling came from (a) the Mission Console's synthesized narrative panels (now removed) and (b) these two unwired data integrations plus the dead Foreman path.

### Suggested follow-ups (each needs your sign-off)
- Wire a real weather provider into `scheduling.ts` (BOM or OpenWeather).
- Set `GOOGLE_MAPS_API_KEY` so `yard-map-geo` uses real imagery (and have it skip/flag when absent instead of feeding a placeholder).
- Remove the dead Foreman files.
