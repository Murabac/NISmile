# Session handoff (Windows ↔ Mac)

Short note so either machine can continue without Cursor chat history.  
**Do not put tokens, passwords, or `.env` values here.** Secrets stay in Supabase Edge secrets and local `app/.env.local` (never committed).

## Read first

1. [`CONTEXT.md`](CONTEXT.md) — current step, locked decisions, gaps  
2. [`.cursor/rules/dentaflow.mdc`](.cursor/rules/dentaflow.mdc) — agent rules  
3. Product plan: `DentaFlow-Project-Plan-v2.md`

## Current product step

**35 — Promotions Send WhatsApp** (not started).  
Steps 32–34 (sale / AR / appointment one-click WhatsApp) are done on Meta **test** number. Production API number is still human (**step 37**).

## What landed recently (pull before continuing)

- Coolify Docker for staff UI (`Dockerfile`, `app/nginx.conf`) — from the other machine; finish domain + Auth URL config if needed
- Sale WhatsApp copy: total / paid / open balance + 7-day due wording
- POS: reject tender overpay
- AR payment reminder + Dashboard/Customers WhatsApp buttons
- Appointment Send confirmation / reminder; reply **1** confirm / **2** cancel with ack text
- Customer Care footer on free-form WhatsApp (`wa.me` care line)
- Sale WhatsApp also sends English **A4 PDF** document (`sale-documents` bucket + `send-whatsapp`)
- Migrations through `20261017140000_sale_whatsapp_pdf.sql` — apply on remote if a machine’s DB is behind

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
- Reply acks only match **scheduled/confirmed** appointments (skip cancelled)  
- PDF attachment only on free-form **text** sale sends (not `hello_world` fallback)  
- Customer Care WhatsApp is a separate human number from the Cloud API sender  

## Next build focus

Implement **step 35** — promotions Send WhatsApp — then docs / e2e (36) and production Meta number (37).

Update this file when you finish a chunk of work on either machine.
