# DentaFlow — working context

This file is the map for building DentaFlow. The product spec is `DentaFlow-Project-Plan-v2.md`. The look and screen behavior come from `Design Ref/`. Logos live in `Brand/`.

**Current step:** Phase 0, step 3 — theme tokens, fonts, dark mode, logo, and print hooks. Supabase credentials are in `app/.env.local` (gitignored). Do not copy keys into source or docs. Do not invent the VAT percentage, loyalty rates, a MyCash account number, or WhatsApp credentials.

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

- **Name:** DentaFlow is the staff app. The clinic is N.I SMILE. GitHub remote: https://github.com/Murabac/NISmile.git (empty, not connected yet). Do not commit `app/.env.local`.
- **Currency:** USD only. Store money as `numeric(12,2)`. No exchange rates.
- **Staff app language:** English only. No language switcher, no translated screens, no RTL layout. Section 3.8 of the plan and the prototype's language switcher are superseded.
- **WhatsApp languages:** message content is **Somali and Arabic**. Each customer has a preferred message language (`so` or `ar`). The sender picks that template. English is not a WhatsApp template language.
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
- **Logo:** tooth silhouette with a teal wave through the lower half, then "Denta" (weight 800) + "Flow" (weight 400). Use `Brand/` assets in the real app. The inline SVG in `Design Ref/src/components/common/Logo.tsx` is the in-app version.
- **Shell:** fixed marine sidebar (`lg:ms-64` is fine as spacing from the sidebar), header with branch switcher, dark toggle, notification count. No language switcher. Mobile sidebar is a drawer. Content max width `max-w-7xl`.
- **Screens and nav order** match `Design Ref/src/components/common/Sidebar.tsx`: Dashboard, Point of Sale (highlighted), Stock, Transfers, Purchases, Services, Customers, Appointments, Promotions (coral), WhatsApp, Reports, Import, Settings.
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
- Imports: template → upload → row validation → dry run → confirm, through `import_batches` / `import_rows`. Opening stock needs a batch and expiry, or a flagged legacy batch. Revert is allowed only while no sale references the imported rows.
- Phone numbers are stored in international form (`+252…`).
- `customers.language` is the WhatsApp language: `so` or `ar`. It does not change the staff UI.
- Item, service, and promotion names in the app are English. Somali and Arabic wording is stored on the WhatsApp template or campaign message, not as a second set of screen labels.

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
  import-processor  validate and load CSV
        │
WhatsApp Cloud API
```

A Cloud API number cannot stay logged into the normal WhatsApp app. Preferred path: a new dedicated number, and the clinic keeps its current chat number.

## Build steps

Work in order. Finish a step before starting the next one inside the same phase. Phases match section 8 of the plan.

### Phase 0 — Foundation (about 4–5 days)

1. **Questions.** Close the open questions below, or explicitly mark one as "decide later in Settings."
2. **App skeleton.** Done. `app/` is Vite, React, TypeScript, and Tailwind 4. `Design Ref/` is untouched. English UI only.
3. **Theme.** Tokens, fonts, dark mode, logo, 10px radius, print stylesheet hooks. Left-to-right layout. No language switcher.
4. **Database.** Existing Supabase project `iwnswhnoxbvgyqljfvel`. Client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `app/.env.local`. The service role key stays server-only and is never prefixed with `VITE_`. `dental` schema: `branches` (seed one), `profiles`, `user_branches`, RLS helpers. Customers are branch-owned and store a WhatsApp language of `so` or `ar`. Auth: email login, role on the profile.
5. **Shell.** Login, sidebar, header, branch switcher, role-gated navigation. Empty screen routes for the 13 screens. No demo role switcher and no language switcher.
6. **WhatsApp prep (human, in parallel).** Meta Business account, business verification, dedicated number. Submit Somali and Arabic templates. Not blocking UI work.

### Phase 1 — Inventory and import (about 2–3 weeks)

7. **Catalog.** Categories, tax rates, items (English name, SKU, barcode, unit, cost, reorder level), price lists with quantity tiers.
8. **Suppliers and purchases.** Purchase orders per branch, goods receipt with batch number, expiry, and unit cost.
9. **Ledger.** `stock_batches`, `stock_movements`, FEFO deduction function. UI: items, batches, movements, adjustments.
10. **Alerts.** Low stock, out of stock, near expiry at 30/60/90 days, on the stock screen and dashboard.
11. **Transfers.** Draft, send, receive, cancel. Quantity differences become adjustments.
12. **Stock count.** Count session writes adjustment movements.
13. **Import.** Items with prices, customers, opening stock. Validation, dry run, confirm, revert.

### Phase 2 — Sales and VAT (about 2–3 weeks)

14. **Services.** Price, duration, VAT, optional recipe. Completing a service deducts the recipe.
15. **POS.** Branch from the session, customer or walk-in at that branch, items and services, best promotion, VAT added on top, partial payment. Tenders: Cash, Zaad, eDahab, MyCash.
16. **Wholesale.** Credit limit, due date, statement, payment against balance.
17. **Documents.** English thermal receipt, 80 mm default and 58 mm option. English A4 PDF with clinic tax details.
18. **Returns.** Linked to the original sale, optional restock, points and promotion usage reversed.

### Phase 3 — Appointments and WhatsApp (about 2 weeks)

19. **Patients and calendar.** Per branch and dentist. Status flow from the plan. Preferred WhatsApp language is Somali or Arabic.
20. **Queue.** `notification_queue`, `notification_log`, `message_templates` with one Somali version and one Arabic version of each message.
21. **Utility messages.** Booking confirmation, 24h and 2h reminders, reschedule/cancel, receipt or invoice notice. Body text is Somali or Arabic. Attached PDFs stay English.
22. **Webhook.** Delivery status, reply 1/2, opt-out. Reply instructions inside the template are in that template's language.

### Phase 4 — Promotions and loyalty (about 2 weeks)

23. **Engine.** Percentage, fixed amount, buy X get Y, bundle, spend threshold. Audience, scope, branches, limits. Best single promotion. The promotion record in the app is English. Its WhatsApp announcement has Somali and Arabic text.
24. **Points.** Settings for earn rate, redeem value, minimum balance, optional expiry. Ledger. Redeem at checkout.
25. **Campaigns.** Preview recipients, opt-in only, enqueue the Somali or Arabic template that matches the customer.

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
