# DentaFlow — working context

This file is the map for building DentaFlow. The product spec is `DentaFlow-Project-Plan-v2.md`. The look and screen behavior come from `Design Ref/`. Logos live in `Brand/`.

**Current step:** Phase 5, step 26 (Reports). Step 25 campaigns done: apply `20261014190000_dental_campaigns.sql`, seed `20261014191000_seed_campaigns_sample.sql` / `node scripts/seed-campaigns.mjs` from `app/`. Marketing templates `promotion_announcement` / `promotion_ending_soon` (so/ar/en). Owner previews opt-in audience on `/promotions` → enqueues per customer language into `notification_queue`; `/whatsapp` Campaigns tab shows stats. Process due still sends via Meta. **Convention:** every build step includes sample seed SQL for new data only, and skips domains that already have seed data. Step 6 stays parallel. Credentials stay in Edge secrets / `app/.env.local`. Do not invent the VAT percentage, loyalty rates, a MyCash account number, or WhatsApp credentials.

## What this repo is

DentaFlow is a multi-branch dental clinic system: inventory, retail and wholesale sales, appointments, promotions, loyalty, and WhatsApp. Staff use it. There is no customer portal in v1.

| Path | Role |
|---|---|
| `DentaFlow-Project-Plan-v2.md` | Product spec. This file overrides the plan where a later decision is recorded. |
| `Design Ref/` | Visual and interaction reference only. Mock data, no backend. Do not add production code here. |
| `Brand/dentaflow-logo.svg` | Full wordmark. |
| `Brand/dentaflow-icon.svg` | DentaFlow tooth icon, for the staff app. |
| `Brand/nismile-logo.jpg` | Clinic logo. Use this on anything a customer receives. |
| `app/` | The real application. Vite, React, TypeScript, Tailwind 4. |
| `CONTEXT.md` | This file. Update the current step when a step is finished. |

## Locked decisions

- **Name:** DentaFlow is the staff app. The clinic is N.I SMILE. GitHub remote: https://github.com/Murabac/NISmile.git on `main`. Do not commit `app/.env.local`.
- **Currency:** USD only. Store money as `numeric(12,2)`. No exchange rates.
- **Staff app language:** English only. No language switcher, no translated screens, no RTL layout. Section 3.8 of the plan and the prototype's language switcher are superseded.
- **WhatsApp languages:** message content is **Somali, Arabic, and English** (`so` / `ar` / `en`). Each customer has a preferred message language. The sender picks that template. Staff UI stays English-only (no screen translation / no RTL switcher).
- **Branches:** The schema supports many branches, and Settings can add more later. **Seed one branch** for go-live. Owners can view all branches once more exist. Everyone else is limited to their branches.
- **Shared across branches:** items, services, price lists, tax rates.
- **Per branch:** customers (patients and wholesale), stock, sales, appointments, purchases, cash. A customer record belongs to one branch.
- **Wholesale:** staff enter orders. Buyer subtypes: clinic, pharmacy/shop, lab, individual dentist. Credit limit, due date, statement.
- **Stock:** one ledger. Never edit quantity in place. Deduct batches with FEFO (first expiry first).
- **Checkout:** sale, VAT, promotion, points, and stock deduction run in one database transaction.
- **Prices on a sale** are copied onto the line at sale time (net, tax, gross, promotion).
- **Loyalty:** earn and redeem rates are Settings fields, left blank until the owner fills them in. Earn on the paid amount excluding VAT. One balance per customer record. Every change is a ledger row. Returns reverse points.
- **Promotions:** best single promotion wins. No stacking. **Only the owner publishes promotions**, and chooses which branches they apply to.
- **VAT:** shelf prices **exclude** tax. VAT is added at checkout. The percentage is a Settings value and stays empty until the clinic confirms it.
- **Receipts:** thermal print at **80 mm by default, with 58 mm available**, A4 PDF invoice, and WhatsApp PDF, all from the same sale.
- **Checkout tenders:** Cash, Zaad, eDahab, and MyCash. MyCash is an Amal Bank service, not physical cash. Wholesale on-account balance (credit limit, due date, statement) stays in the product; it is not a fifth tender named cash.
- **WhatsApp:** a **new dedicated number** for the Cloud API. The clinic keeps its current WhatsApp for normal chat.
- **Clinic on customer-facing output:** legal name **N.I SMILE Oral care & Teeth whitening**. Logo file `Brand/nismile-logo.jpg` (green tooth, wordmark N.ISMILE). Address **26 June Road 1, Hargeisa, Somaliland**. Phone **+252 63 4749276**. Tax ID **11114**. Zaad **484594**. eDahab **764043**. MyCash (Amal Bank) prints as **Pending** until the clinic has an account number. These appear on receipts, invoices, and account statements. The staff app is still called DentaFlow.
- **Clinical chart:** out of v1. Visit notes only.
- **Offline POS:** out of v1.
- **WhatsApp tokens** live in Edge Function secrets, never in the frontend.

## Stack

React + TypeScript + Vite + Tailwind CSS 4 + TanStack Query. The staff UI is English, so the app does not use react-i18next.

Supabase: Auth, Postgres in a dedicated `dental` schema, Row Level Security by branch, Storage for PDFs, Edge Functions for checkout side effects, PDFs, WhatsApp send, webhook, campaigns, and import.

The plan names shadcn/ui. The prototype does not use it. **Match the prototype's layout, type, color, and components.** Add a small set of our own primitives (button, input, modal, drawer, status pill) in that visual language. Do not restyle the product to look like default shadcn.

## Design system

Copy these tokens from `Design Ref/src/index.css`.

| Token | Value | Use |
|---|---|---|
| Marine | `#0C3B4A` | Sidebar, primary actions, logo tooth |
| Flow Teal | `#12A6A0` | Accent, links, focus |
| Enamel | `#F4F8F7` | Page background |
| Ink | `#10262D` | Body text |
| Coral | `#FF6B57` | Promotions only |
| Green / Amber / Red | `#2E9E6B` / `#E0A100` / `#D64545` | Status |

- **Fonts:** Bricolage Grotesque (headings), Figtree (body), IBM Plex Mono (numbers, SKUs, money).
- **Radius:** 10px.
- **Dark mode:** the prototype has it. Keep it. Toggle on `<html class="dark">`.
- **Direction:** the staff app stays left-to-right. Do not set `dir="rtl"` and do not build a mirrored layout.
- **Staff logo:** `Brand/dentaflow-logo.svg` for the wordmark and `Brand/dentaflow-icon.svg` for the app icon and favicon. Do not redraw the tooth from `Design Ref`, and do not use `Brand/nismile-logo.jpg` in the staff app.
- **Shell:** fixed marine sidebar (`lg:ms-64` is fine as spacing from the sidebar), header with branch switcher, dark toggle, notification count. No language switcher. Mobile sidebar is a drawer. Content max width `max-w-7xl`.
- **Screens and nav order** match `Design Ref/src/components/common/Sidebar.tsx`, plus **Sales** (branch sale history for documents/returns) after Point of Sale: Dashboard, Point of Sale (highlighted), Sales, Stock, Transfers, Purchases, Services, Customers, Appointments, Promotions (coral), WhatsApp, Reports, Import, Settings.
- **English labels** are written in the components. `Design Ref/src/i18n/translations.ts` is not the app catalog. Somali and Arabic strings belong on WhatsApp templates.

### Prototype behavior to drop

- The header **role switcher** and **language switcher** are prototype-only. Real roles come from Supabase Auth and `profiles`. The staff UI has no language control.
- Sample patients, stock, and sales in `Design Ref/src/data/mockData.ts` are fake. Customer-facing screens read the real clinic identity from `Design Ref/src/data/clinic.ts`.
- `Customer.branchId` in the prototype matches the decision: each customer belongs to one branch. Do not make customers global.
- Item retail/wholesale prices sit on the item in the prototype. The real model uses `item_prices` and `service_prices`, including quantity tiers.

## Roles

| Role | Scope |
|---|---|
| Owner / Admin | All branches. Prices, tax, promotions, users, branches, combined reports. |
| Branch Manager | Own branch. Inventory, purchases, transfers, branch reports. Promotions are owner-only. |
| Receptionist | Own branch. Patients, appointments, checkout, reminders. |
| Dentist | Own branch. Own appointments, services performed, items used. |
| Storekeeper | Own branch. Stock in/out, adjustments, counts, transfers. |

A user can belong to more than one branch (`user_branches`). RLS enforces this. Owners see every branch and may pick "All branches" on the dashboard and reports. Checkout, transfers, and purchases always happen in one real branch.

## Data rules

Schema outline is section 4 of the plan. These rules are easy to get wrong:

- Stock quantity changes only inside database functions that insert `stock_movements`.
- Transfer statuses: `draft → in_transit → received`, or `cancelled`. Stock leaves the source when sent and enters the destination when received. In-transit stock stays visible.
- Appointment statuses: `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`. Completing an appointment creates the sale and deducts the service recipe at that branch.
- Checkout tenders: Cash, Zaad, eDahab, MyCash (Amal Bank). Print the merchant or account numbers once the clinic supplies them. Do not treat MyCash as cash, and do not add Telesom or Dahabshiil unless asked.
- Imports: Excel (.xlsx) template → upload → row validation → dry run → confirm, through `import_batches` / `import_rows`. Opening stock needs a batch and expiry, or a flagged legacy batch. Revert is allowed only while no sale references the imported rows.
- Services: optional `service_recipes` (item + qty). Completing a service calls `apply_service_recipe`, which deducts each line with FEFO `service_usage`. **Services are patient-priced only** (retail `service_prices`). No wholesale list on services — wholesale stays on items.
- Checkout: `checkout_sale` writes `sales` / `sale_lines` / `payments` in one transaction, then FEFO `sale_out` for items and `apply_service_recipe` per service unit. VAT from each line’s tax rate (0 if none). Tenders: Cash, Zaad, eDahab, MyCash. Partial payment → status `partial`. Promotions/points/documents later.
- Wholesale: on-account is unpaid AR (not a fifth tender). Unpaid wholesale sales need `due_date` and a positive `credit_limit`. `customer_ar_balance` + `apply_customer_payment` settle open invoices FIFO.
- Phone numbers are stored in international form (`+252…`).
- `customers.language` is the WhatsApp language: `so`, `ar`, or `en`. It does not change the staff UI.
- Item, service, and promotion names in the app are English. Somali, Arabic, and English WhatsApp wording is stored on the message template or campaign, not as a second set of screen labels.

## Architecture

```
app/  React (Vite, TS, TanStack Query, English UI)
        │
Supabase Auth · Postgres dental schema · Storage (PDFs)
        │
Edge Functions
  checkout          sale + VAT + promo + points + stock, one transaction
  generate-document A4 invoice and receipt PDF
  send-whatsapp     queue worker (pg_cron)
  whatsapp-webhook  delivery status and replies (1 = confirm, 2 = cancel, opt-out)
  campaign-builder  resolve audience, enqueue
  import-processor  validate and load Excel
        │
WhatsApp Cloud API
```

A Cloud API number cannot stay logged into the normal WhatsApp app. Preferred path: a new dedicated number, and the clinic keeps its current chat number.

## Build steps

Work in order. Finish a step before starting the next one inside the same phase. Phases match section 8 of the plan.

### Phase 0 — Foundation (about 4–5 days)

1. **Questions.** Close the open questions below, or explicitly mark one as "decide later in Settings."
2. **App skeleton.** Done. `app/` is Vite, React, TypeScript, and Tailwind 4. `Design Ref/` is untouched. English UI only.
3. **Theme.** Done. Tokens, fonts, dark mode, logo, 10px radius, and print hooks are in `app/`. Left-to-right layout. No language switcher.
4. **Database.** Done. `dental` is exposed on project `iwnswhnoxbvgyqljfvel`. One branch is seeded. `profiles`, `user_branches`, and `customers` exist, with row-level security. The client is `app/src/lib/supabase.ts` and uses only the anon key. The first email signup becomes the owner.
5. **Shell.** Done. Email sign-in and account creation, marine sidebar, header, branch switcher, and role-gated routes for the 13 screens. Owners can use All branches on Dashboard and Reports. Login has quick buttons for the five demo roles (`owner@nismile.local` through `storekeeper@nismile.local`, password `dentaflow-demo`). Re-seed with `node scripts/seed-demo-users.mjs` from `app/`. No in-app role switcher and no language switcher.
6. **WhatsApp prep (human, in parallel).** Meta Business account, business verification, dedicated number. Submit Somali and Arabic templates. Not blocking UI work.

### Phase 1 — Inventory and import (about 2–3 weeks)

7. **Catalog.** Done. Shared `categories`, `tax_rates`, `items`, `item_prices`, `services`, and `service_prices`. Stock manages products; Services manages clinical/whitening services; Settings manages tax rates and categories. English names only. No stock quantities or service recipes yet. Sample data from `app/scripts/data/NI_Smile_Products_and_Services_Catalog.xlsx` via `node scripts/seed-nismile-catalog.mjs`.
8. **Suppliers and purchases.** Done. Migration `20261014020000_dental_purchases.sql`. Sample data: `supabase/seed/20261014021000_seed_purchases_sample.sql` (suppliers, one open PO, one received PO with batches). Does not re-seed catalog/services.
9. **Ledger.** Done. Tables from purchases; functions `deduct_stock_fefo` and `adjust_stock` in `20261014030000_dental_stock_ledger.sql`. Stock UI shows on-hand qty, batches, movements, and adjustments. Direct client writes to batches/movements revoked. Sample: `supabase/seed/20261014031000_seed_stock_ledger_sample.sql` (extra FEFO gloves batch + one gloves write-off). Does not re-seed catalog/purchases.
10. **Alerts.** Done. Low stock, out of stock (previously stocked), near expiry at 30/60/90 days on Stock filters + banner and Dashboard KPI/attention list. No new tables; WhatsApp digest stays for later. Sample: `supabase/seed/20261014032000_seed_stock_alerts_sample.sql` (gloves reorder/low, 18d + 50d batches, carton zeroed).
11. **Transfers.** Done. Migration `20261014040000_dental_transfers.sql`: `stock_transfers`, lines, allocations; RPCs create/send/receive/cancel. Send uses FEFO (`transfer_out`); receive creates destination batches (`transfer_in`); short receive writes an adjustment. Transfers UI on `/transfers`. Sample seed adds demo branch **Hargeisa North**, one draft and one in-transit gloves transfer. Does not re-seed catalog/purchases.
12. **Stock count.** Done. Migration `20261014050000_dental_stock_counts.sql` plus all-active-items snapshot. Stock UI: **Stock count** drawer with Restart. Opening batches for unstocked items seeded. Sample variance count seeded.
13. **Import.** Done once migration + seed are applied. Migration `20261014060000_dental_imports.sql`: `import_batches` / `import_rows`; create → validate → dry run → confirm → revert. Types: items (shared), customers, opening stock (branch). UI at `/import` with Excel (.xlsx) templates and uploads. Sample: confirmed customer import (`20261014061000_seed_imports_sample.sql`).

### Phase 2 — Sales and VAT (about 2–3 weeks)

14. **Services.** Done once migration + seed are applied. Migration `20261014070000_dental_service_recipes.sql`: `service_recipes` + `apply_service_recipe` (FEFO `service_usage`). Services UI: list + recipe panel, edit drawer with materials, **Record usage** when a branch is selected. Sample recipes on SRV-001/002/003 + one SRV-002 usage movement (`20261014071000_seed_service_recipes_sample.sql`).
15. **POS.** Done once migration + seed are applied. Migration `20261014080000_dental_sales.sql`: `sales`, `sale_lines`, `payments`, `checkout_sale`. UI at `/pos` (branch required): catalog, walk-in/customer, cart, tenders, partial OK. Promotions/points/receipts deferred. Sample walk-in sale (`20261014081000_seed_sales_sample.sql`).
16. **Wholesale.** Done once migration + seed are applied. Migration `20261014090000_dental_wholesale.sql`: `sales.due_date`, extended `checkout_sale`, `customer_ar_balance`, `apply_customer_payment`. POS charge-to-account for wholesale. Customers page at `/customers` with AR, statement (browser print), record payment. Sample wholesale customer + on-account + Zaad settlement (`20261014091000_seed_wholesale_sample.sql`).
17. **Documents.** Done. English thermal receipt (80 mm default, 58 mm option) and A4 tax invoice from the same sale via `SaleDocumentsModal` + browser print / Save as PDF. Clinic identity from `app/src/lib/clinic.ts` and `Brand/nismile-logo.jpg` in `app/public/`. Wired on POS after checkout and Customers recent sales. WhatsApp PDF send stays for later.
18. **Returns.** Done once migration + seed are applied. Migration `20261014100000_dental_returns.sql`: `returns` / `return_lines` / `return_refunds`, `process_return` (partial lines, AR credit then tender refunds, optional item restock onto original sale_out batches). UI: Return on POS last-sale banner and Customers recent sales. Points/promotions reverse later when those ledgers exist. Sample: return walk-in item line (`20261014101000_seed_returns_sample.sql` / `node scripts/seed-returns.mjs`).

### Phase 3 — Appointments and WhatsApp (about 2 weeks)

19. **Patients and calendar.** Done once migration + seed are applied. Migration `20261014110000_dental_appointments.sql`: `appointments` + `create_appointment` / `set_appointment_status` / `complete_appointment` (complete → `checkout_sale` for the booked service). UI at `/appointments`: week calendar + list, book drawer (retail patients, dentist, service, so/ar on customer), status actions. Patients stay on Customers (Retail). Sample: Ayaan Abdi + today/tomorrow slots (`20261014111000_seed_appointments_sample.sql` / `node scripts/seed-appointments.mjs`). WhatsApp send is step 20+.
20. **Queue.** Done once migration + seed are applied. Migration `20261014120000_dental_notification_queue.sql`: `message_templates` (so+ar per kind), `notification_queue`, `notification_log`, `enqueue_notification` / `cancel_queued_notification`. UI at `/whatsapp` (templates, queue, log). No Meta send yet — Cloud API credentials stay for Edge Functions. Sample: utility draft templates + one pending 24h reminder (`20261014121000_seed_notification_queue_sample.sql` / `node scripts/seed-notifications.mjs`).
21. **Utility messages.** Done once migration + seed are applied. Migration `20261014130000_dental_utility_messages.sql`: booking → confirmation + 24h/2h reminders; cancel/no-show → cancel notice; `reschedule_appointment`; sales insert → receipt/invoice notice (opt-in only, so/ar). UI: Appointments reschedule + queue hints; documents “Queue WhatsApp notice”. Meta send still deferred. Sample: `20261014131000_seed_utility_messages_sample.sql` / `node scripts/seed-utility-messages.mjs`.
22. **Webhook.** Done once migration + function are applied. Migration `20261014140000_dental_whatsapp_webhook.sql`: delivery status, inbound reply `1`=confirm / `2`=cancel, opt-out keywords, simulate RPCs for local testing. Edge Function `supabase/functions/whatsapp-webhook` (GET verify + POST statuses/messages). UI: Simulate delivered / Reply 1·2 / Opt-out on WhatsApp queue. Sample: `20261014141000_seed_whatsapp_webhook_sample.sql` / `node scripts/seed-whatsapp-webhook.mjs`.
22b. **Send (Cloud API).** Done for the Meta **test number** (+1 555-664-1276 / phone id `1373497502510936`). Migration `20261014150000_dental_send_whatsapp.sql`: `claim_due_notifications`, `mark_notification_failed`, extended `mark_notification_sent`. Edge Function `send-whatsapp`: approved Meta template name when set; otherwise falls back to `hello_world` (free-form text fails outside the 24h window — Meta `#131047`). UI: Process due / Send via Meta on `/whatsapp`. Secrets: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (replace with production phone id later). Optional `WHATSAPP_TEST_FALLBACK_TEMPLATE`. Test number Cloud API–registered once. Allowlist recipients until production. Sample: `20261014151000_seed_send_whatsapp_sample.sql` / `node scripts/seed-send-whatsapp.mjs`.

### Phase 4 — Promotions and loyalty (about 2 weeks)

23. **Engine.** Done once migration + seed are applied. Migration `20261014170000_dental_promotions.sql`: `promotions` / `promotion_branches` / `promotion_targets` / `promotion_redemptions`; types percentage, fixed_amount, buy_x_get_y, bundle, spend_threshold; audience/scope/branches/limits; `evaluate_best_promotion` + checkout applies best single discount before VAT; owner `publish_promotion`. UI at `/promotions` (English promo record; so/ar/en WhatsApp announcement text). POS coral promo preview. Sample: buy-10-get-1 gloves, 15% hygiene services, $7 checkup (`20261014171000_seed_promotions_sample.sql` / `node scripts/seed-promotions.mjs`). Campaign broadcast enqueue stays for step 25.
24. **Points.** Done once migration + seed are applied. Migration `20261014180000_dental_loyalty.sql`: `clinic_settings` (rates blank until owner), `loyalty_transactions`, `customers.loyalty_points`, checkout `p_redeem_points` + earn on paid ex-VAT, return reverse. UI: Settings/Promotions loyalty fields; POS redeem; Customers shows balance. Sample adjust 250 pts for seed patient (`20261014181000_seed_loyalty_sample.sql` / `node scripts/seed-loyalty.mjs`) — does not invent rates.
25. **Campaigns.** Done once migration + seed are applied. Migration `20261014190000_dental_campaigns.sql`: `campaigns`, marketing templates so/ar/en, `list_promotion_audience` / `enqueue_promotion_campaign` / `cancel_campaign` / `campaign_stats`. Owner UI: Promotions Preview & enqueue; WhatsApp Campaigns tab. Opt-in + phone only; 7-day duplicate skip. Sample: `20261014191000_seed_campaigns_sample.sql` / `node scripts/seed-campaigns.mjs`.

### Phase 5 — Reports and go-live (about 1–2 weeks)

26. **Reports.** Sales, profit, stock valuation, expiry, debts, VAT, promotion results. One branch or all.
27. **Dashboard.** Today's appointments, sales, low stock, near expiry, debts. Branch switcher.
28. **Go-live.** Somali and Arabic template approval, backup, role training, template quality rating.

## Decisions locked on 2026-10-13

| Topic | Decision |
|---|---|
| Supabase | Existing project `iwnswhnoxbvgyqljfvel`. Schema name `dental`. Keys live only in `app/.env.local`. |
| Branches | One branch at launch. Schema and Settings still allow more. |
| Customers | Each customer belongs to one branch. |
| VAT | Prices exclude VAT. Rate is a Settings field, still blank. |
| Loyalty | Earn rate and redeem value are Settings fields, still blank. |
| Thermal | Both widths. Default 80 mm. |
| WhatsApp number | New dedicated number. Keep the clinic's current chat number. |
| Languages | Staff app is English only. WhatsApp message content is Somali and Arabic. |
| Promotions | Owner only. Owner picks the branches. |
| Tenders | Cash, Zaad, eDahab, MyCash (Amal Bank, not cash). |
| Clinic | N.I SMILE Oral care & Teeth whitening. 26 June Road 1, Hargeisa, Somaliland. Phone +252 63 4749276. Tax ID 11114. Zaad 484594. eDahab 764043. MyCash pending. |

## Still needed later

These do not block the app skeleton.

1. **Supabase CLI login**, if it is not already authenticated, when step 4 creates the `dental` schema. The project ref and keys are already in `app/.env.local`.
2. **VAT percentage.** Needed before real invoices.
3. **Loyalty rates.** Needed before points go live.
4. **MyCash account number.** Documents show “Pending” until the clinic has one.
5. **The dedicated WhatsApp number** once Meta Business verification starts. Human task, parallel with Phase 0.
