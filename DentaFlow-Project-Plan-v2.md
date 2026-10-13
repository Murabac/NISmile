# DentaFlow: Dental Clinic Inventory, Sales & WhatsApp System (Plan v2)

**Stack:** React (TypeScript) + Supabase (dedicated `dental` schema) + WhatsApp Cloud API
**Scope:** Inventory and stock alerts, retail and wholesale sales, appointments and patients, promotions and loyalty points, multi-branch
**Brand:** see the DentaFlow brand kit (Marine `#0C3B4A`, Flow Teal `#12A6A0`, Coral `#FF6B57` for promotions only)

---

## 0. Decisions Locked In

| Topic | Decision | Effect on the build |
|---|---|---|
| Name | DentaFlow | Brand kit and theme tokens ready |
| Stack | React + Supabase, WhatsApp Cloud API | Edge Functions for messaging and scheduled jobs |
| Branches | Multiple branches | `branch_id` on stock, sales, appointments and purchases; branch-scoped access; stock transfers |
| Currency | USD only | One currency, no exchange rates |
| Languages | English, Somali, Arabic | i18n for the app, RTL layout for Arabic, WhatsApp templates per language |
| WhatsApp today | Normal WhatsApp number | Needs a dedicated number for the Cloud API (see 3.7) |
| Wholesale buyers | Clinics, pharmacies/shops, labs, individual dentists | Wholesale customer subtype and credit limit |
| Wholesale ordering | Staff enter orders | No client portal in v1 |
| Tax | VAT / sales tax | Tax rates, tax line on invoices and reports |
| Receipts | Thermal printer, A4 PDF invoice, WhatsApp | Three output formats from one sale record |
| Loyalty | Points plus discounts and bonuses | Points ledger in v1 |
| Existing data | Item list with prices, customer/patient list, stock counts | CSV import tool with validation |

## 1. Goals

1. Track every dental item (consumables, instruments, retail products) per branch with accurate stock, batches and expiry.
2. Sell **services** and **items** to retail and wholesale customers, each with its own pricing and VAT.
3. Send **WhatsApp** appointment reminders, receipts, invoices and promotions automatically, in the customer's language.
4. Run a **promotion and loyalty system** (discounts, bonuses, points) that applies at checkout and notifies the right customers.
5. Give owners and branch managers clear reports: sales, profit, stock, debts, VAT, promotion results, by branch and combined.

## 2. Users, Roles and Branch Access

| Role | Scope | Can do |
|---|---|---|
| Owner / Admin | All branches | Everything, including prices, tax, promotions, users, branches, cross-branch reports |
| Branch Manager | Own branch | Inventory, purchases, transfers, promotions for the branch, branch reports |
| Receptionist | Own branch | Patients, appointments, checkout, send reminders |
| Dentist | Own branch | Own appointments, record services and items used |
| Storekeeper | Own branch | Stock in/out, adjustments, counts, transfers |

- A user belongs to one or more branches (`user_branches`). Row Level Security limits every branch-owned table to the user's branches. Owners see all.
- Customers, items, services, price lists and tax rates are **shared across branches**. Stock, sales, appointments, purchases and cash are **per branch**.

## 3. Modules

### 3.1 Inventory (per branch)
- **Items**: SKU/barcode, names in English/Somali/Arabic, category, unit, cost, reorder level, tax rate, active flag.
- **Batches**: batch number, expiry date, quantity, unit cost, branch. Deduct with **FEFO** (first-expiry-first-out).
- **Suppliers and purchases**: purchase orders, goods received into a branch, supplier invoices and balance.
- **Stock movements**: one ledger, never edit stock directly. Types: purchase in, sale out, service usage, adjustment, write-off, transfer out, transfer in.
- **Stock transfers**: branch A sends, branch B receives. Status `draft → in_transit → received` (or `cancelled`). Stock leaves A when sent and enters B when received, so in-transit stock is visible.
- **Alerts** (per branch): low stock, near expiry (30/60/90 days), out of stock. Dashboard plus a daily WhatsApp digest to each branch manager.
- **Stock count**: periodic count that produces adjustment entries.

### 3.2 Services Catalog
- Each service has a price, a duration, a VAT rate and an optional **recipe** (items it consumes). Completing the service deducts the recipe from the branch's stock.

### 3.3 Sales (Retail and Wholesale)
- **Customer types**: Retail (patients and walk-ins) and Wholesale with a subtype: clinic, pharmacy/shop, lab, individual dentist.
- **Price lists**: `retail` and `wholesale` prices per item and service, with optional quantity tiers.
- **Checkout** (staff-entered for all orders): items and services, automatic promotion, VAT, payments (cash, mobile money, bank, credit), partial payment.
- **Wholesale extras**: credit limit, invoice with due date, customer statement, outstanding balance, receipts for payments.
- **Documents** (generated from the same sale record):
  - **Thermal receipt** (58/80 mm) printed from the browser at the counter.
  - **A4 PDF invoice** for wholesale, showing the VAT line and the clinic's tax details.
  - **WhatsApp**: the receipt or invoice sent as a PDF.
- **Returns and refunds**: linked to the original sale, restock optional, points and promotion usage reversed.
- **Currency**: USD only. Amounts are stored as `numeric(12,2)`.

### 3.4 VAT / Sales Tax
- `tax_rates` table (name, rate, active). Items and services each point to a rate.
- Setting: prices **include** tax or **exclude** tax.
- Each sale line stores net, tax and gross at the time of sale. Invoices show subtotal, VAT and total. A VAT report summarises tax collected by period and branch.
- The rate to use must be confirmed with the clinic's accountant.

### 3.5 Patients and Appointments
- Patient profile: name, WhatsApp number, **preferred language**, notes, visit history, services done.
- Appointment calendar by branch and dentist. Statuses: `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`.
- Completing an appointment creates the sale for the services performed and deducts stock at that branch.
- Clinical records stay minimal in v1 (visit notes). A full dental chart is a later phase.

### 3.6 Promotions and Loyalty
Promotion types:
- Percentage discount, fixed amount discount
- Buy X get Y free (for example 10 boxes, 1 free, mostly wholesale)
- Bundle price (service plus product)
- Spend threshold (spend over a set amount, get a discount or gift)

Each promotion has: name and description (in 3 languages), start and end date, **audience** (all, retail, wholesale, a wholesale subtype, a customer group, or named customers), **scope** (whole invoice, items, services, categories), **branches** (all or selected), rules (minimum quantity or amount, limits per customer and in total), and whether it notifies customers on WhatsApp. Default rule: the **best single promotion wins**, no stacking.

**Loyalty points (v1)**
- Customers earn points per USD spent (rate set by the owner), calculated on the paid amount excluding VAT.
- Points are redeemed at checkout as a discount (rate set by the owner), with a minimum balance to redeem.
- One points balance per customer, usable at any branch. Every change goes into `loyalty_transactions` (earn, redeem, reverse, adjust). Optional expiry.
- Returns reverse the points earned on that sale.

Every sale line records which promotion or points redemption was applied, for audit and reports.

### 3.7 WhatsApp Notifications
Provider: **WhatsApp Cloud API** (official, Meta).

**Number setup (important).** A number registered on the Cloud API cannot also be used in the normal WhatsApp or WhatsApp Business app. Choose one:
1. Get a **new dedicated number** for DentaFlow messages (recommended; the clinic keeps its current WhatsApp), or
2. Migrate the current clinic number to the API and stop using it in the app.

Create the Meta Business account and start business verification now, since it can take days.

**Messages**
| Message | Audience | Trigger |
|---|---|---|
| Appointment confirmation | Patients | On booking |
| Appointment reminder | Patients | 24h and 2h before (configurable) |
| Reschedule / cancel notice | Patients | On change |
| Receipt / invoice (PDF) | Customer | On sale (optional) |
| Promotion announcement | Chosen audience | On publish or scheduled |
| Promotion ending soon | Same audience | 1-2 days before end |
| Points balance / reward | Customers | After a sale or on request |
| Payment due reminder | Wholesale | Before and after due date |
| Low-stock / near-expiry digest | Branch manager | Daily |

**Rules of the platform**
- Business-initiated messages need **pre-approved templates**. Each template is approved **per language**, so every message exists in up to 3 versions (English, Somali, Arabic). Start with Somali and English, and add Arabic when those are live.
- The system sends each customer the template in their **preferred language**.
- Reminders and receipts are "utility" templates. Promotions are "marketing" templates, which cost more per message. Check current Meta pricing before budgeting.
- Store **opt-in consent** per customer, honor opt-out replies, and limit promotion frequency to protect the number's quality rating.
- New numbers start with low daily limits that grow with good quality.

**Technical design**
- `notification_queue` holds pending messages (template, language, parameters, recipient, scheduled time, status).
- A scheduled **Supabase Edge Function** (pg_cron) sends due messages and records the result.
- A **webhook Edge Function** receives delivery status and customer replies ("1 = confirm, 2 = cancel", opt-out).
- Retries with backoff. Everything logged in `notification_log`.

### 3.8 Languages and RTL
- UI in English, Somali and Arabic with `react-i18next`. Language switcher in the header; the choice is saved per user.
- Arabic switches the page to **right-to-left**. Build with logical CSS (`margin-inline-start`, `ps-`/`pe-` utilities) from day one so layouts mirror correctly.
- Item, service and promotion names store translations (`name`, `name_so`, `name_ar`); the app shows the user's language and falls back to English.
- PDFs and thermal receipts in Arabic need a font with Arabic shaping and a layout that supports RTL. Test this early, since it is the most common source of bugs.

### 3.9 Data Import
- CSV/Excel import for **items with prices**, **customers/patients**, and **opening stock counts**.
- Flow: download template → upload → validation screen (errors by row) → dry run → confirm. Imports go through a staging table.
- Checks: required fields, duplicate SKUs and phone numbers, phone numbers normalised to international format (for example +252…), unknown categories, expiry dates in the past, stock without a branch.
- Opening stock needs a **batch and expiry date** for each line. Items without one can be loaded as a single "legacy" batch, flagged for review.
- Imports are logged and can be reverted while no sales reference the imported rows.

## 4. Data Model (Postgres, `dental` schema)

**Organization**
- `branches` (name, address, phone, active)
- `profiles` (user_id, role, name, language)
- `user_branches` (user_id, branch_id)

**Customers**
- `customers` (type: retail|wholesale, subtype, name, phone, language, whatsapp_opt_in, credit_limit, notes)
- `customer_groups`, `customer_group_members`
- `consents` (customer_id, channel, granted_at, revoked_at)

**Catalog (shared)**
- `categories`, `tax_rates`
- `items` (sku, barcode, names, category_id, unit, cost, reorder_level, tax_rate_id)
- `item_prices` (item_id, price_list, min_qty, price)
- `services`, `service_prices`, `service_recipes`

**Inventory (per branch)**
- `suppliers`, `purchase_orders`, `purchase_order_lines` (branch_id)
- `stock_batches` (branch_id, item_id, batch_no, expiry_date, qty_remaining, unit_cost)
- `stock_movements` (branch_id, item_id, batch_id, type, qty, ref_type, ref_id, created_by, created_at)
- `stock_transfers` (from_branch, to_branch, status, sent_at, received_at), `stock_transfer_lines`

**Sales (per branch)**
- `sales` (branch_id, customer_id, status, subtotal, discount_total, tax_total, total, paid_total, due_date)
- `sale_lines` (sale_id, line_type, ref_id, qty, unit_price, discount_amount, tax_rate, tax_amount, promotion_id)
- `payments`, `returns`, `return_lines`

**Appointments (per branch)**
- `appointments` (branch_id, customer_id, dentist_id, start_at, end_at, status, notes, sale_id)

**Promotions and loyalty**
- `promotions` (names/descriptions per language, type, value, audience, start_at, end_at, rules JSON, notify, status)
- `promotion_branches`, `promotion_targets`, `promotion_redemptions`
- `loyalty_settings` (earn rate, redeem value, minimum, expiry)
- `loyalty_accounts` (customer_id, balance), `loyalty_transactions`

**Messaging and imports**
- `message_templates` (name, language, category, whatsapp_template_id, status)
- `notification_queue`, `notification_log`
- `import_batches`, `import_rows` (staging and error log)

**Design notes**
- Stock is changed only through database functions that write `stock_movements`.
- Checkout (sale, VAT, promotion, points, stock deduction) runs in **one transaction** so numbers never drift.
- Prices, tax and promotion effects are stored on the sale line at the time of sale.

## 5. Key Flows

**A. Retail sale**
Pick branch (from login) → select customer or walk-in → add items/services → best promotion or points redemption applied → VAT calculated → payment → stock deducted (FEFO) at the branch → thermal receipt printed or PDF sent on WhatsApp → points earned.

**B. Wholesale order (staff-entered)**
Customer calls or messages → staff creates the order for the customer → wholesale prices, tiers and promotions → VAT → A4 invoice with due date → partial payments → statement and due reminders on WhatsApp.

**C. Appointment**
Book → confirmation in the patient's language → reminders (24h / 2h) → reply "1 / 2" updates status → visit completed → services recorded → sale created → stock deducted.

**D. Promotion launch**
Create promotion (3 languages) → audience, scope, branches → preview recipients → publish → engine active from start date → WhatsApp campaign queued to opted-in customers in their language → track redemptions and revenue.

**E. Stock transfer between branches**
Branch A creates transfer → marks sent (stock leaves A, shows as in transit) → Branch B receives and confirms quantities → differences recorded as adjustments.

**F. Replenishment**
Stock reaches reorder level at a branch → alert and daily digest → purchase order → goods received with batch and expiry → stock updated.

## 6. Screens (React)

1. Dashboard (today's appointments, sales, low stock, near expiry, debts) with a **branch switcher** (owners can pick "All branches")
2. Point of Sale / Checkout
3. Items and Stock (items, batches, movements, adjustments, counts)
4. Stock Transfers
5. Purchases and Suppliers
6. Services catalog and recipes
7. Customers (retail and wholesale) with statements, points and consent status
8. Appointments calendar
9. Promotions and Loyalty (create, preview, schedule, results, points settings)
10. WhatsApp center (templates per language, campaign queue, delivery log, replies)
11. Reports (sales, profit, stock valuation, expiry, debts, VAT, promotion results; by branch or combined)
12. Import (templates, upload, validation, history)
13. Settings (users and roles, branches, price lists, tax rates, clinic details for invoices, reminder timing, languages)

## 7. Architecture

```
React (Vite + TypeScript, TanStack Query, shadcn/ui, react-i18next)
        │
Supabase: Auth · Postgres (dental schema, RLS by branch) · Storage (PDFs)
        │
Edge Functions:
  ├─ checkout (RPC: sale + VAT + promo + points + stock, one transaction)
  ├─ generate-document (A4 invoice / receipt PDF)
  ├─ send-whatsapp (queue worker on pg_cron)
  ├─ whatsapp-webhook (delivery status + replies)
  ├─ campaign-builder (resolve audience → enqueue messages)
  └─ import-processor (validate and load CSV batches)
        │
WhatsApp Cloud API (Meta)
```

- Keep this project in its own **`dental` schema** in your existing Supabase project.
- Store WhatsApp tokens in Edge Function secrets, never in the frontend.

## 8. Phased Delivery

| Phase | Deliverable | Time (1 developer) |
|---|---|---|
| **0. Setup** | Schema with branches, auth, roles, branch RLS, i18n and RTL foundation, theme tokens, project skeleton. **Start Meta verification and get the dedicated WhatsApp number.** | 4-5 days |
| **1. Inventory + import** | Items, categories, suppliers, purchases, batches, movements, alerts, stock transfers, CSV import for items, customers and opening stock | 2-3 weeks |
| **2. Sales + VAT** | Services, price lists, tax rates, POS, payments, thermal receipt, A4 invoice, wholesale credit and statements | 2-3 weeks |
| **3. Appointments + WhatsApp** | Patients, calendar, message queue, reminders, receipts on WhatsApp, webhook replies (Somali and English templates first) | 2 weeks |
| **4. Promotions + Loyalty** | Promotion engine, audience targeting, campaigns, points earn/redeem, redemption tracking, Arabic templates | 2 weeks |
| **5. Reports + polish** | Dashboards by branch, VAT report, exports, Arabic PDF check, backups, training, go-live | 1-2 weeks |

Roughly **10-13 weeks** for one developer. Multi-branch, three languages and loyalty points each add time compared with the first plan.

## 9. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| WhatsApp number cannot be used in both the app and the API | Decide now: new dedicated number (recommended) or migrate the clinic's number |
| Templates rejected or slow, now x3 languages | Submit simple templates early; launch Somali and English first; keep a manual fallback |
| Number blocked for spam | Opt-in only, easy opt-out, limit promotion frequency, watch the quality rating |
| Branch data leaks between branches | RLS on every branch-owned table, tested per role |
| Stock mismatch across branches | Ledger-only changes, transactional checkout, in-transit transfers, regular counts |
| Arabic PDFs and receipts render wrongly | Pick a font with Arabic shaping, test thermal and A4 output in Phase 2, not at the end |
| Wrong VAT on invoices | Rates managed by the owner, tax stored per line, accountant confirms the setup |
| Messy import data | Staging table, validation report, dry run, ability to revert |
| Points abuse or errors | Points on paid net amount only, reversal on returns, full ledger |
| Internet outages at a branch | Consider an offline-tolerant POS later (PWA); out of scope for v1 |

## 10. Remaining Questions (small)

1. **VAT**: what rate, and do shelf prices include VAT or exclude it?
2. **Branches**: how many to start with, and where?
3. **Customers**: are patients and wholesale clients shared across all branches? (This plan assumes yes.)
4. **Loyalty**: how many points per USD, and what is a point worth when redeemed?
5. **Thermal printer**: which model and paper width (58 mm or 80 mm)?
6. **WhatsApp number**: new dedicated number, or migrate the current one?
7. **Promotions**: can each branch run its own promotions, or are they set only by the owner? (This plan allows both, by branch selection.)

## 11. Next Step

Answer the remaining questions, then build in this order: SQL schema and RLS for phases 0-1 (with branches), then build-ready prompts for each phase. The UI design prompt for Google AI is in a separate file.
