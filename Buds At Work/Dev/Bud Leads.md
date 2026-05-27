# Bud Leads

Lead workspace added 2026-05-24. Centralises inbound lead capture from Facebook Messenger and future channels into a single admin view.

## What was built

- **Workspace UI** — `src/app/(app)/dashboard/insights/leads/` — dark-themed lead feed with channel badge, status, and follow-up tracking
- **Messenger webhook** — `src/app/api/webhooks/messenger/route.ts` — receives Facebook Graph API events, verifies HMAC signature, writes directly to `lead_conversations`
- **DB schema** — `lead_conversations` (channel, sender, message, status) + `lead_follow_ups` (linked follow-up notes per lead)

## Environment variables

| Key | Purpose |
|---|---|
| `MESSENGER_APP_SECRET` | HMAC signature verification for Facebook webhook payloads |
| `MESSENGER_INGEST_SECRET` | Auth token for the internal ingest endpoint |
| `MESSENGER_VERIFY_TOKEN` | Handshake token for Facebook webhook registration |
| `NEXT_PUBLIC_BASE_URL` | Absolute base URL used in webhooks and email links |

## Setup (Facebook side)

1. Facebook Developer Console → App → Webhooks → subscribe `messages` + `messaging_postbacks`
2. Set Callback URL to `https://budsatwork.com/api/webhooks/messenger`
3. Verify token = `MESSENGER_VERIFY_TOKEN`

## Related

- [[Engineering]] — full env var and file map
- [[00 System Core/Home|Home]] — listed under Dev
- [[Processes/Quote Flow|Quote Flow]] — leads that convert enter the quote flow
- [[Admin/Sales Pipeline|Sales Pipeline]] — lead scoring and follow-up
