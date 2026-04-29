# Supabase SMTP setup for budsatwork.com

## Why this is needed

Supabase's built-in email service is for dev/testing only. It:
- Rate-limits to ~2 emails/hour
- In practice only reliably delivers to members of your Supabase organization
- Is why `silvandaley@gmail.com`, `disabilityworks9@gmail.com`, and `disabilitywork9@gmail.com` never got confirmation emails

Until you plug in a real SMTP provider, every employee signup will have this same problem.

## Recommended provider: Resend

- Free tier: 3,000 emails/month, 100/day (plenty for your scale)
- Excellent Gmail deliverability
- First-party Supabase integration — they publish the exact settings
- Setup takes ~15 minutes

---

## Step 1 — Create a Resend account

1. Go to https://resend.com and sign up with your `admin@budsatwork.com` account (or your personal email; the account owner doesn't matter).
2. You'll land in the Resend dashboard.

## Step 2 — Verify your domain

This is the step that makes Gmail trust your emails. Skipping it means Resend will send from `onboarding@resend.dev` and emails will land in spam.

1. In Resend, go to **Domains → Add Domain**.
2. Enter `budsatwork.com`.
3. Resend will show you 3 DNS records to add — an **MX record**, a **TXT (SPF) record**, and a **TXT (DKIM) record**.
4. Go to wherever you manage DNS for budsatwork.com (Cloudflare, GoDaddy, Namecheap, Squarespace, etc.).
5. Add each record exactly as Resend shows. For each one:
   - Name / Host: what Resend shows (e.g. `send`, `resend._domainkey`)
   - Type: MX or TXT as shown
   - Value / Points to: copy-paste exactly from Resend
   - TTL: leave default (Auto / 3600)
6. Back in Resend, click **Verify DNS Records**. It usually takes 5–30 minutes. You can move on to Step 3 while waiting.

## Step 3 — Get an API key / SMTP credentials

1. In Resend, go to **API Keys → Create API Key**.
2. Name it `supabase-budsatwork`.
3. Permission: **Sending access** is enough.
4. Copy the key — it starts with `re_`. You'll only see it once. Save it somewhere safe like 1Password.

## Step 4 — Configure Supabase to use Resend

1. Go to your Supabase project: https://supabase.com/dashboard/project/ukuhrycxptcbamgacnfm
2. In the left sidebar: **Project Settings → Auth → SMTP Settings** (may also be labeled "Email").
3. Toggle **Enable Custom SMTP** on.
4. Fill in:
   - **Sender email**: `no-reply@budsatwork.com` (or `hello@budsatwork.com` — anything `@budsatwork.com`)
   - **Sender name**: `Buds at Work`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: the `re_...` API key from Step 3
   - **Minimum interval between emails**: leave default (60 seconds is fine)
5. Click **Save**.

## Step 5 — Update email rate limits (optional but recommended)

In the same Auth settings page:
1. Scroll to **Rate Limits**.
2. Increase "Emails per hour" from the default 2 to something like `30`. Resend's free tier handles this easily.

## Step 6 — Test it

**Option A — via the Supabase dashboard:**
1. In Supabase: **Authentication → Users**.
2. Find one of the unconfirmed users (e.g. disabilityworks9@gmail.com).
3. Click the `...` menu → **Send magic link** or **Resend confirmation**.
4. Check the recipient's inbox. Should arrive within 30 seconds.

**Option B — fresh signup from the app:**
1. Have an employee (or a test Gmail account of yours) go through the signup flow on budsatwork.com.
2. The confirmation email should arrive within a minute from `no-reply@budsatwork.com`.

## Step 7 — Clean up stuck accounts (optional)

Two employees signed up previously and never got their email. You now have two choices for them:

- **Resend their confirmation** from the Supabase dashboard (Authentication → Users → click user → Send confirmation email). With Resend configured, these will now arrive.
- **Manually confirm them** (same thing I did for Silvan) so they can log in directly. Ask me and I'll run the SQL.

Affected users:
- `disabilityworks9@gmail.com` (signed up 2026-03-17)
- `disabilitywork9@gmail.com` (signed up 2026-03-17)

---

## If something goes wrong

- **DNS records won't verify**: TTL caching can take up to an hour. Re-check with `dig TXT budsatwork.com` or https://mxtoolbox.com.
- **Emails going to spam**: Make sure all 3 DNS records verified in Resend. SPF + DKIM together are what Gmail cares about.
- **Supabase says "SMTP error"**: Double-check the password field has the API key (not a placeholder) and port is 465 (not 587 — 587 requires STARTTLS which Resend supports, but 465 is simpler).

## Alternate providers (if you prefer)

- **SendGrid** — 100 emails/day free, more enterprise-oriented setup
- **Postmark** — excellent deliverability, $15/mo minimum
- **AWS SES** — cheapest at scale (~$0.10 per 1k emails) but requires more configuration and you have to request production access

Resend is the right pick for where you are now. Move to SES later if you scale to tens of thousands of emails/month.
