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
