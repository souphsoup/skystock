# SOP-Stock

Mobile web app (PWA) for daily stock counts at MAI The Sky Bar (Meliá Chiang Mai).
Kitchen and bar staff count on a phone or tablet, the supervisor reviews only what doesn't
match, and management sees daily/weekly/monthly reports with Excel export.

This is the "open the trial in 3 days" scope from the proposal (`SOP-Stock-Proposal.html`):

| Done | Feature |
|---|---|
| ✓ | Count with in / out / total columns, in the original sheet's order. The app computes the total and staff confirm with one tap |
| ✓ | Unit on every item. Categories nest up to 3 levels (category › type › cut) |
| ✓ | Blind count: the server never sends the expected figure to the counting device |
| ✓ | Offline counting: saved to IndexedDB first, synced automatically when back online. The page opens even with no signal (service worker) |
| ✓ | Supervisor review: matched lines approved in one go; mismatches can be confirmed, sent back for recount, or corrected with a reason |
| ✓ | Below-Par / out-of-stock alerts |
| ✓ | Management overview: day/week/month, inventory value, variances, Excel export |
| ✓ | Per-user 6-digit PIN, lockout after 5 wrong attempts, auto-logout after 15 idle minutes, append-only audit log |
| ✓ | Receive goods (with delivery-note photo and supplier), issue to kitchen, transfer between locations, waste (with reason). These fill in/out on the count sheet automatically, work offline, and can be voided with a reason |
| ✓ | Settings (supervisor/Admin): category › type › cut tree, add/edit/move items, set unit, location, Par, cost, Blind, deactivate items (history kept) |
| ✓ | Staff propose an item that is on the shelf but not on the sheet, right from the count screen (works offline, warns about similar names already on the sheet). The supervisor sets category, Par and cost and approves it into a real item, or rejects it with a reason staff can see |
| ✓ | User management (Admin): add users, reset PINs, change roles, deactivate accounts, sign out of every device immediately |
| ✓ | Morning summary at 08:00 to LINE OA groups and email: yesterday's count status, below-Par items, variances, waste value, link to the dashboard. Admin manages recipients and sends tests in Settings › สรุปตอนเช้า |
| ✓ | Thai/English UI per user (Me › Language). The language follows the user to any device; the login page remembers the last language used on the device. Excel export follows the user's language; each morning-summary recipient has its own language |
| – | POS integration (phase 2) |

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no `DATABASE_URL`, the app uses PGlite (Postgres running in-process) at `.data/pglite`
and seeds demo data automatically: the 31-item Freezer list (sample data) plus 7 days of approved counts.

| User | PIN | Role |
|---|---|---|
| ton | 111111 | Operation |
| ploy | 222222 | Operation |
| chef | 333333 | Supervisor |
| napa | 444444 | Management |
| admin | 999999 | Admin |

Reset demo data: stop the server, run `npm run db:reset`, then start it again.

The service worker (offline page opening) only registers in a production build: `npm run build && npm start`.
To test on a phone on the same Wi-Fi, use the Network URL that `next dev` prints.

## Go to production (Supabase + Vercel)

1. Create a Supabase project in Singapore. Copy the **Transaction pooler** connection string into `DATABASE_URL`.
2. Set `SESSION_SECRET` (`openssl rand -base64 48`). See `.env.example`.
3. Create the first user. The script also creates the outlet and locations, and runs migrations automatically:
   `DATABASE_URL=... npm run user:create -- chef "Chef Chai" supervisor 123456`
4. Import the shop's real items from CSV (template: `scripts/items-template.csv`):
   `DATABASE_URL=... npm run import:items -- items.csv`
5. Create a **private** Storage bucket named `sop-stock` in Supabase and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for delivery-note photos).
6. Morning summary (optional, can be done later):
   - **LINE:** create a Messaging API channel for the shop's LINE Official Account in LINE Developers. Set `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET`. Set the Webhook URL to `https://<app>/api/line/webhook` and turn "Use webhook" on. Allow the bot to join groups (LINE Official Account Manager › Settings › Allow bot to join group chats).
     Then add the bot to the management LINE group. The group shows up in Settings › สรุปตอนเช้า switched off; Admin switches it on.
   - **Email:** create a [Resend](https://resend.com) account, verify the sending domain, and set `RESEND_API_KEY` and `EMAIL_FROM`.
   - Set `CRON_SECRET` (`openssl rand -base64 32`) and `APP_URL` (the app's https URL, used for the dashboard link).
   - `vercel.json` runs `/api/cron/morning` every day at 01:00 UTC (08:00 Bangkok). Any other scheduler can call it with `Authorization: Bearer $CRON_SECRET`.
7. Deploy to Vercel (region `sin1`) with the same env vars.

Every table has RLS enabled with no policies, so Supabase anon/authenticated keys can't read anything.
The database is reachable only through this app's server.

## Code layout

```
src/lib/migrations.ts   schema (the same SQL can be pasted into the Supabase SQL editor)
src/lib/db.ts           Postgres (prod) / PGlite (local) adapter + migrations + demo seed
src/lib/stock.ts        all business logic: count sheet, opening balance, submit, review, alerts, reports
src/lib/settings.ts     categories / items / users (every change is written to the audit log)
src/lib/movements.ts    receive / issue / transfer / waste, attaching movements to count rounds, void
src/lib/notify.ts       morning summary: build from reports, recipients, send once per day
src/lib/digest.ts       summary → LINE Flex message / email HTML (also the settings preview)
src/lib/line.ts         LINE Messaging API: push, reply, webhook signature
src/i18n/               Thai/English: Thai text is the key, English in src/i18n/en/*.ts
src/lib/proposals.ts    items proposed by staff: propose, approve (creates or re-activates the item), reject
src/lib/files.ts        photo storage (Supabase Storage in production, .data/uploads locally)
src/lib/session.ts      PIN login, JWT cookie, revoke via session_version
src/client/             IndexedDB (Dexie) + offline-queue sync engine
src/app/count/          count screen (client, works offline)
src/app/(app)/          home, review, dashboard, alerts, me, settings
public/sw.js            service worker
scripts/                import items from CSV, create users
```

Counting rules:
- **Opening** = the latest count of that item from an earlier day that has been submitted. No earlier count = initial count (no variance check).
- **Expected** = opening + in − out (a generated column in the DB). **Total** = what was actually counted.
- On submit: lines that match → `ok`, lines that differ → `flag`. The round is approved once every line is `confirmed`.
- Counts before 06:00 belong to the previous business day (the bar closes at midnight).
- A new item appears in the draft count for its location right away. Deactivating or moving an item removes it from any draft count that hasn't been submitted yet; counts already submitted are not changed.
- **in/out on the count sheet = recorded movements (`mv_in`/`mv_out`, maintained by the server) + amounts typed on the sheet (`in_qty`/`out_qty`)**. Devices never send `mv_*`, so a stale offline value can't overwrite a recorded receipt.
- Which count a movement belongs to: if the item hasn't been counted yet in today's draft, it goes into today's count. If it's already counted, or no round is open, it waits for the next round of that location (`attachPendingMoves`). Example: goods received at 18:00 after the 15:30 count go into tomorrow's count.
- A transfer to a location that doesn't have the item yet creates the item there automatically (same Thai name, Par 0).
- A movement can only be voided before the count round that uses it is submitted. After that, the supervisor corrects the figure on the review page instead.
- Changing a role, resetting a PIN, or deactivating an account bumps `session_version`, which signs that user out on every device immediately.
- Approving a proposed item: if an inactive item with the same name exists at that location it is switched back on (history kept) instead of creating a duplicate. The proposer's counted amount goes into that day's count: still a draft → filled in; submitted → added as a line for the supervisor to check; already approved → the item starts in the next count.
- Morning summary: sent at most once per business date (`notify_runs`); a failed run can be retried, a sent or partly sent one is not resent. LINE chats that add the bot register switched off, so adding the bot to an outside group never leaks stock figures. Without LINE/email keys the summary is written to the server log instead (dry run).

Translations:
- Write UI text in Thai inside `t("…")` (server: `await getT()`, client: `useT()`), and add the English to `src/i18n/en/<area>.ts`. Labels in constants use `tk("…")` and are rendered with `t(LABEL[x])`. Use `{placeholders}` instead of `${…}`; English can pluralise with `{n, # item, # items}`.
- `npm run i18n:check` lists Thai text with no English (and English nobody uses). A missing entry shows the Thai text, so nothing breaks.
- Data (item, category and location names, units) is shown as entered. Items have Thai and English names; name categories and locations in whichever language the team reads.
