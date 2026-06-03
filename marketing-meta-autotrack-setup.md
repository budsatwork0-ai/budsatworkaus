# Auto-Tracking Setup — Instagram + Facebook (Meta)

This connects your Instagram and Facebook numbers to the Marketing Studio scoreboard so they fill in automatically every day instead of you typing them.

**The code is already built and deployed.** All that's left is creating a Meta app, getting one access token, and pasting three values into Vercel. Follow these in order — it's about 20–30 minutes, mostly clicking.

> You only need to do this once. Tokens below don't expire (Page tokens from a long-lived user token are permanent), so it's set-and-forget.

---

## Before you start — accounts must be linked

1. Your **Instagram must be a Business (or Creator) account.** In the Instagram app: Settings → Account type and tools → Switch to professional account → Business.
2. That Instagram account must be **linked to a Facebook Page** you manage. In the IG app: Settings → Business tools and controls → Connect a Facebook Page (or do it from the Page's settings on Facebook → Linked accounts → Instagram).

If those two things are true, you're ready.

---

## Step 1 — Create a Meta developer app

1. Go to **https://developers.facebook.com/apps** and log in with the Facebook account that manages your Page.
2. Click **Create app**.
3. Use case: choose **Other** → **Business** → name it `Buds At Work Metrics` → Create.
4. On the app dashboard, add the **Instagram** product and the **Facebook Login for Business** product (just click "Set up" on each — you don't need to configure them deeply).

---

## Step 2 — Get your access token + IDs (Graph API Explorer)

1. Go to **https://developers.facebook.com/tools/explorer**.
2. Top right: select your app `Buds At Work Metrics`.
3. Click **Add permissions** and tick all of these:
   - `pages_show_list`
   - `pages_read_engagement`
   - `read_insights`
   - `business_management`
   - `instagram_basic`
   - `instagram_manage_insights`
4. Click **Generate Access Token** → approve the popups, choosing your Page and Instagram account when asked.
5. You now have a **short-lived token** in the box. We'll make it permanent in Step 3, but first grab your IDs:

   **Find your Facebook Page ID** — in the Explorer query box, run:
   ```
   me/accounts
   ```
   Find your Page in the result and copy its `id`. That's your **`META_FB_PAGE_ID`**.

   **Find your Instagram account ID** — run (replace `PAGE_ID`):
   ```
   PAGE_ID?fields=instagram_business_account
   ```
   Copy the `instagram_business_account.id`. That's your **`META_IG_USER_ID`**.

---

## Step 3 — Make the token permanent

1. **Exchange for a long-lived user token.** Paste this in your browser, replacing `APP_ID`, `APP_SECRET` (both on your app's Settings → Basic page) and `SHORT_TOKEN` (from Step 2):
   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN
   ```
   Copy the `access_token` it returns — that's a ~60-day user token.

2. **Get the never-expiring Page token.** Back in the Graph API Explorer, paste that long-lived user token into the token box, then run:
   ```
   me/accounts
   ```
   The `access_token` shown next to your Page in the result **does not expire**. Copy it — that's your **`META_ACCESS_TOKEN`**.

---

## Step 4 — Add the three values to Vercel

1. Go to **https://vercel.com** → your `budsatworkaus` project → **Settings → Environment Variables**.
2. Add these three (Environment: **Production**):

   | Name | Value |
   |---|---|
   | `META_ACCESS_TOKEN` | the never-expiring Page token (Step 3.2) |
   | `META_FB_PAGE_ID` | your Page ID (Step 2) |
   | `META_IG_USER_ID` | your Instagram account ID (Step 2) |

   *(Optional: `META_GRAPH_VERSION` = `v21.0` — only if Meta later tells you to upgrade.)*

3. **Redeploy** so the new env vars take effect: Vercel → Deployments → latest → ⋯ → Redeploy. (Or just push any commit.)

---

## That's it

Once redeployed, the job runs automatically every day (5:30am Brisbane) and writes that day's Instagram + Facebook reach, engagement and followers into the scoreboard with a `source: api` tag. Your manual entry still works as a backup, and **Content Published** keeps counting itself from the queue.

**Want to test it immediately** instead of waiting for the morning run? Tell me and I'll trigger the endpoint, or you can visit it once while logged in. If a number looks off, it's almost always a missing permission in Step 2 — send me the response and I'll pinpoint it.

---

## TikTok (next)

TikTok is the same idea but needs its own developer app and an approval step that's slower than Meta's, so we're doing it after this is proven. When you're ready, say the word and I'll build the TikTok side and write you the same kind of checklist.
