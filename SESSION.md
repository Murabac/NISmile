# Session handoff (Windows ↔ Mac)

Short note so either machine can continue without Cursor chat history.  
**Do not put tokens, passwords, or `.env` values here.** Secrets stay in Supabase Edge secrets and local `app/.env.local` (never committed).

## Read first

1. [`CONTEXT.md`](CONTEXT.md) — current step, locked decisions, gaps  
2. [`.cursor/rules/dentaflow.mdc`](.cursor/rules/dentaflow.mdc) — agent rules  
3. Product plan: `DentaFlow-Project-Plan-v2.md`

## Current product step

Apply **`20261017150000_dental_branch_region_fx.sql`** on Supabase; owner fills Exchange rates.  
WhatsApp **36/37** still open. Step **38** (regions + FX) is in the codebase.

## What landed recently (pull before continuing)

- Coolify Docker for staff UI (`Dockerfile`, `app/nginx.conf`)
- Steps 32–35 one-click WhatsApp + promotions Send WhatsApp
- Step 38: branch `region`, Settings FX (SLSH/ETB per USD), POS dual total, docs/PDF dual currency
- Migrations through `20261017150000_dental_branch_region_fx.sql` — **apply on remote**
- **Patient roster (live DB):** **1774** retail patients on N.I SMILE Hargeisa (`en`, opt-in true). Location in notes (`CLINIC-PATIENT-LIST-2026-11 | …`). Phones normalized to `+252…` when usable (**94** with phone; rest null / raw kept in notes). Data: `app/scripts/data/clinic-patient-roster.tsv`. Script: `app/scripts/enrich-clinic-patients.mjs` (requires `CONFIRM_CUSTOMER_RESET=YES`). Do not re-run casually.
- **Stock catalog (live DB):** Shared **21** products (`NS-###`). Stock **split by branch** (not summed): **Hargeisa** retail **2790** units (12 with stock); **N.I SMILE Wholesale** **22945** units (9 with stock). Cost `0`, **no sell prices** yet. Restock clinic via **Transfers** (Wholesale → Hargeisa). Roster: `app/scripts/data/clinic-stock-roster.json` (`retail_qty` / `wholesale_qty`). Script: `app/scripts/split-wholesale-stock.mjs` (`CONFIRM_STOCK_RESET=YES`). Older sum script `reset-stock-catalog.mjs` is obsolete for live qty.
- **Branches (active):** N.I SMILE Hargeisa, **N.I SMILE Wholesale** (new), **N.I SMILE Jigjiga** (already present). Demo **Hargeisa North** from transfers sample is not in this DB (was never real).

## Cross-machine checklist

```text
git pull
cd app && npm install
# Ensure app/.env.local exists locally (not in git)
# Apply any new supabase/migrations/*.sql to project iwnswhnoxbvgyqljfvel if needed
# Redeploy Edge functions if _shared or send/webhook changed:
#   npx supabase functions deploy send-whatsapp --project-ref iwnswhnoxbvgyqljfvel
#   npx supabase functions deploy whatsapp-webhook --project-ref iwnswhnoxbvgyqljfvel --no-verify-jwt
```

## Known ops notes (no secrets)

- Meta temporary Graph tokens expire; refresh `WHATSAPP_ACCESS_TOKEN` in Edge secrets when sends return Access denied  
- Webhook must stay `verify_jwt = false` and subscribe to **messages**  
- Promo Send WhatsApp processes the due queue in batches of 20 (may also flush other pending utility rows)  
- Coolify custom domain needs Ports Exposes `80` + Domains `https://nismile.m2btek.com` + healthy container  

## Next build focus

**36** — docs / e2e checklist against Meta test number; then **37** production API number.

Update this file when you finish a chunk of work on either machine.
