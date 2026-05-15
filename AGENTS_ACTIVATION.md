# Activating the Agents in Your Live Dashboard

Step-by-step. Do these in order. Each step is small.

## Step 1 — Add your API keys to `.env.local`

Open `.env.local` in the repo root. Add (or update) these lines. Only the
first two are mandatory; the others give the design / vision agents
more to work with.

```
ANTHROPIC_API_KEY=sk-ant-...                # required — get from console.anthropic.com
CRON_SECRET=<paste a long random string here>  # required — pick anything, like a 32-char hex
SUPABASE_SERVICE_ROLE_KEY=<from supabase>   # you likely already have this
AGENT_DEFAULT_MODEL=claude-sonnet-4-6        # optional

# Optional — unlocks more agents
LUCKY_ORANGE_SITE_ID=a592b727
LUCKY_ORANGE_API_KEY=...                    # dash.luckyorange.com → Settings → API
LUCKY_ORANGE_API_SECRET=...
GOOGLE_MAPS_API_KEY=...                     # Yard Map / Geo agent
OPENAI_API_KEY=...                          # Phone Transcriber (Whisper)
```

Without `ANTHROPIC_API_KEY` nothing works. Without the others, those
specific agents fall back to fixture data so the system still runs.

## Step 2 — Apply the migrations to Supabase

You have four new migrations (`037` → `040`). Pick whichever path
matches how you normally apply migrations:

**Supabase CLI:**
```
supabase db push
```

**Supabase Studio (SQL Editor), if you'd rather paste:**
Open each file and paste contents into the SQL editor, in order:
1. `supabase/migrations/037_agents.sql`
2. `supabase/migrations/038_design_agents.sql`
3. `supabase/migrations/039_agents_batch2.sql`
4. `supabase/migrations/040_agents_batch345.sql`

Run them one at a time. If a `CREATE TABLE` fails because a referenced
table (`jobs`, `customers`, `crew_members`, etc.) is named differently
in your schema, the error message will tell you which line — adjust
that reference and re-run. The migrations use `if not exists` so they're
safe to re-run.

If you get errors on `whs_records` (references `crew_members`) or
`stripe_disputes` (references `customers`), check that those exact
table names match your schema. If not, fix the `references` clause or
just drop those `references` to get unblocked.

The `knowledge_articles` table uses `vector(1536)`. If you haven't
installed pgvector:
```sql
create extension if not exists vector;
```
If you can't install it, comment out that one column — Internal Q&A
will fall back to full-text search.

## Step 3 — Turn on Supabase Realtime for the lobby

Go to Supabase Studio → Database → Replication, and toggle replication
on for `agent_runs`, `agent_actions`, and `design_insights`. Or paste
this in SQL Editor:

```sql
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.agent_actions;
alter publication supabase_realtime add table public.design_insights;
```

Without this the lobby page works but won't update live as agents run.

## Step 4 — Start the dev server and visit the new pages

```
npm run dev
```

Then open:
- `http://localhost:3000/dashboard/agents` — the admin dashboard
- `http://localhost:3000/dashboard/agents/lobby` — the live lobby

You should see new sidebar entries **Agents** and **Lobby** — these
are admin-only, so make sure your user's row in the `profiles` table
has `role = 'admin'` or `'owner'`.

## Step 5 — Run your first agent

In the dashboard at `/dashboard/agents`, click **Run now** on
**Quote Triage**. Three things should happen:

1. The button shows "Running…" for a few seconds.
2. A row appears in **Recent runs** at the bottom.
3. If there are any unprocessed quotes in your DB, you'll see a row
   in **Pending approvals** — click **Approve** or **Reject**.

If you get an error:
- **"agent not found"** — migration didn't run; redo step 2.
- **"Anthropic 401"** — your `ANTHROPIC_API_KEY` is wrong or unset.
- **"unauthorized"** — your profile row isn't admin/owner. Set it:
  ```sql
  update public.profiles set role = 'owner' where id = '<your-user-uuid>';
  ```
- **"fetch quotes: column ... does not exist"** — the quote-triage agent
  expects an `agent_triaged_at` column. Add the columns from the
  README's Step 6:
  ```sql
  alter table public.quotes
    add column if not exists agent_triaged_at  timestamptz,
    add column if not exists agent_estimate_aud numeric,
    add column if not exists agent_service     text,
    add column if not exists agent_ndis        boolean,
    add column if not exists lead_score        integer,
    add column if not exists lead_score_at     timestamptz,
    add column if not exists yard_sqm          numeric,
    add column if not exists yard_complexity   text,
    add column if not exists geo_image_url     text;
  ```

## Step 6 — Wire the effect handlers (the part that actually sends things)

Open `src/lib/agents/runtime.ts`. Find the `dispatchEffect` function
at the bottom. Right now it `console.log`s — it doesn't actually send
email or SMS. That's intentional: until you connect it to your
existing libraries, nothing leaves your machine.

Replace each `case` with a real call. Example:

```ts
case 'send_email': {
  // You already use Resend in src/lib/email
  const { sendTransactional } = await import('@/lib/email');
  const p = payload as { to: string; subject: string; html: string };
  await sendTransactional({ to: p.to, subject: p.subject, html: p.html });
  return;
}
case 'send_sms': {
  // Wire to whichever SMS provider you use (Twilio, MessageBird, etc.)
  const p = payload as { to: string; body: string };
  await fetch('https://api.twilio.com/...', { /* ... */ });
  return;
}
case 'create_quote': {
  // Use your existing quote insert path
  await fetch('http://localhost:3000/api/quotes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return;
}
```

Until you do this step, you can still **approve** actions in the
dashboard — they'll be marked "executed" but won't actually send.
Good for safe testing.

## Step 7 — Deploy to Vercel

```
git add .
git commit -m "Add agents system"
git push
```

Vercel will pick this up and deploy. Make sure the same env vars from
Step 1 are set in your Vercel project settings → Environment Variables.

## Step 8 — Turn on the cron schedule

Edit `vercel.json` in the repo root. Add a `crons` block (merge with
existing config if any):

```json
{
  "crons": [
    { "path": "/api/agents/cron?agent_id=quote-triage&secret=${CRON_SECRET}",        "schedule": "*/10 * * * *" },
    { "path": "/api/agents/cron?agent_id=customer-reply&secret=${CRON_SECRET}",      "schedule": "*/15 * * * *" },
    { "path": "/api/agents/cron?agent_id=lead-scorer&secret=${CRON_SECRET}",         "schedule": "*/5 * * * *"  },
    { "path": "/api/agents/cron?agent_id=phone-transcriber&secret=${CRON_SECRET}",   "schedule": "*/10 * * * *" },
    { "path": "/api/agents/cron?agent_id=photo-qa&secret=${CRON_SECRET}",            "schedule": "*/20 * * * *" },
    { "path": "/api/agents/cron?agent_id=crew-briefing&secret=${CRON_SECRET}",       "schedule": "0 6 * * *"    },
    { "path": "/api/agents/cron?agent_id=reconciliation&secret=${CRON_SECRET}",      "schedule": "0 7 * * *"    },
    { "path": "/api/agents/cron?agent_id=scheduling&secret=${CRON_SECRET}",          "schedule": "0 16 * * *"   },
    { "path": "/api/agents/cron?agent_id=ndis-compliance&secret=${CRON_SECRET}",     "schedule": "0 8 * * *"    },
    { "path": "/api/agents/cron?agent_id=reviews&secret=${CRON_SECRET}",             "schedule": "0 10 * * *"   },
    { "path": "/api/agents/cron?agent_id=heatmap-analyst&secret=${CRON_SECRET}",     "schedule": "0 5 * * 1"    },
    { "path": "/api/agents/cron?agent_id=conversion-funnel&secret=${CRON_SECRET}",   "schedule": "0 4 * * *"    },
    { "path": "/api/agents/cron?agent_id=lapsed-win-back&secret=${CRON_SECRET}",     "schedule": "0 10 * * 2"   },
    { "path": "/api/agents/cron?agent_id=cash-flow-forecaster&secret=${CRON_SECRET}","schedule": "0 7 * * 1"    },
    { "path": "/api/agents/cron?agent_id=whs-safety-reminder&secret=${CRON_SECRET}", "schedule": "0 6 * * *"    },
    { "path": "/api/agents/cron?agent_id=crew-coach&secret=${CRON_SECRET}",          "schedule": "0 8 1 * *"    }
  ]
}
```

Vercel Hobby plan only allows daily crons. If you're on Hobby, keep
the daily ones (e.g. `0 6 * * *`) and remove the sub-hour ones — those
can be triggered manually from the dashboard until you upgrade to Pro,
or run them from a Supabase scheduled function instead.

Commit and push again. Vercel auto-detects `vercel.json` changes.

## Step 9 — Watch it work

Open `/dashboard/agents/lobby` in production. As cron jobs fire, you'll
see desks light up, speech bubbles pop, and the event ticker fill on
the right.

## Step 10 — Promote autonomy as you trust each agent

Every agent starts in `review` mode (you click Approve before anything
sends). Once you've watched an agent for a week and approved-vs-rejected
ratio is good, promote it to `auto`:

```sql
update public.agents set autonomy = 'auto' where id = 'quote-triage';
```

The `auto`-already agents (Lead Scorer, Crew Briefing, Yard Map, Phone
Transcriber, WHS Safety) are deliberately ones whose actions are either
internal-only or low-risk reminders.

---

## Common gotchas

- **The lobby is dark — desks but no activity.** Either no agents have
  run yet (click Run now in the admin dashboard), or Realtime isn't on
  (Step 3).
- **Approval button does nothing.** Browser devtools → Network → look
  at the `POST /api/agents/actions/...` response. If 401, your session
  expired or your role isn't admin.
- **Costs feel high.** Switch the chatty agents to Haiku:
  `update public.agents set config = config || '{"model":"claude-haiku-4-5-20251001"}'::jsonb where id in ('lead-scorer','customer-reply','heatmap-analyst');`
  Then update `runtime.ts` to read `config.model` if present.
- **Tables that don't exist yet.** A few agents reference tables you may
  not have (`payables`, `subscriptions`, `reviews`, `customer_messages`).
  Those agents will return early with a Supabase error. Either skip them,
  rename to your existing tables in the agent file, or add the table.

---

## What you can do right now without finishing setup

If you just want to see it working without doing all the wiring:

1. Open `agents-preview.html` in any browser — admin dashboard view.
2. Open `agents-lobby-preview.html` in any browser — animated lobby.

Both work offline with no API keys, no Supabase, no nothing.
