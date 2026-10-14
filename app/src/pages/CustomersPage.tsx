import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Printer, RotateCcw, Search, Users, X } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import { ReturnDrawer } from '../components/ReturnDrawer.tsx'
import { SaleDocumentsModal } from '../components/SaleDocumentsModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import {
  CLINIC_ADDRESS,
  CLINIC_EDAHAB,
  CLINIC_LEGAL_NAME,
  CLINIC_LOGO_SRC,
  CLINIC_MARK_NAME,
  CLINIC_MYCASH,
  CLINIC_PHONE,
  CLINIC_TAX_ID,
  CLINIC_ZAAD,
} from '../lib/clinic.ts'
import { fetchCustomers, saveCustomer } from '../lib/customers/api.ts'
import {
  WHOLESALE_SUBTYPES,
  type Customer,
  type CustomerInput,
  type CustomerType,
  type WholesaleSubtype,
} from '../lib/customers/types.ts'
import { formatMoney } from '../lib/money.ts'
import {
  applyCustomerPayment,
  fetchCustomerSales,
  fetchCustomerStatement,
} from '../lib/sales/api.ts'
import {
  TENDER_LABELS,
  type PaymentTender,
  type Sale,
  type StatementLine,
} from '../lib/sales/types.ts'

type TenderDraft = Record<PaymentTender, string>

function emptyTenders(): TenderDraft {
  return { cash: '', zaad: '', edahab: '', mycash: '' }
}

export function CustomersPage() {
  const { branchId } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<CustomerType>('wholesale')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [tenders, setTenders] = useState<TenderDraft>(emptyTenders())
  const [paySaleId, setPaySaleId] = useState<string>('all')
  const [docSale, setDocSale] = useState<Sale | null>(null)
  const [returnSale, setReturnSale] = useState<Sale | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [customerType, setCustomerType] = useState<CustomerType>('retail')
  const [subtype, setSubtype] = useState<WholesaleSubtype>('clinic')
  const [language, setLanguage] = useState<'so' | 'ar' | 'en'>('so')
  const [whatsappOptIn, setWhatsappOptIn] = useState(true)
  const [creditLimit, setCreditLimit] = useState('1000')
  const [notes, setNotes] = useState('')

  if (branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Customers</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header. Customers belong to a single branch.
        </p>
      </section>
    )
  }

  const customersQuery = useQuery({
    queryKey: ['customers', branchId],
    queryFn: () => fetchCustomers(branchId),
  })

  const customers = customersQuery.data ?? []
  const selected = customers.find((c) => c.id === selectedId) ?? null

  const statementQuery = useQuery({
    queryKey: ['customer_statement', selected?.id],
    queryFn: () => fetchCustomerStatement(selected!.id),
    enabled: Boolean(selected?.id),
  })

  const salesQuery = useQuery({
    queryKey: ['customer_sales', selected?.id],
    queryFn: () => fetchCustomerSales(selected!.id),
    enabled: Boolean(selected?.id),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      if (c.customer_type !== tab) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.subtype ?? '').toLowerCase().includes(q)
      )
    })
  }, [customers, tab, search])

  const openInvoices = (statementQuery.data?.lines ?? []).filter(
    (line) => line.kind === 'invoice' && line.status === 'partial',
  )

  const saveMutation = useMutation({
    mutationFn: (input: CustomerInput) => saveCustomer(branchId, input, editing?.id),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      await queryClient.invalidateQueries({ queryKey: ['pos_customers'] })
      setSelectedId(id)
      closeDrawer()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No customer selected')
      const payments = (Object.keys(tenders) as PaymentTender[])
        .map((tender) => ({ tender, amount: Number(tenders[tender]) }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
      if (payments.length === 0) throw new Error('Enter at least one payment amount.')
      return applyCustomerPayment({
        branchId,
        customerId: selected.id,
        payments,
        saleId: paySaleId === 'all' ? null : paySaleId,
      })
    },
    onSuccess: async () => {
      setPayError(null)
      setTenders(emptyTenders())
      setPaySaleId('all')
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      await queryClient.invalidateQueries({ queryKey: ['customer_statement'] })
      await queryClient.invalidateQueries({ queryKey: ['customer_ar'] })
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (err: Error) => setPayError(err.message),
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setPhone('')
    setCustomerType(tab)
    setSubtype('clinic')
    setLanguage('so')
    setWhatsappOptIn(true)
    setCreditLimit(tab === 'wholesale' ? '1000' : '')
    setNotes('')
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditing(customer)
    setName(customer.name)
    setPhone(customer.phone ?? '')
    setCustomerType(customer.customer_type)
    setSubtype((customer.subtype as WholesaleSubtype) || 'clinic')
    setLanguage(customer.language)
    setWhatsappOptIn(customer.whatsapp_opt_in)
    setCreditLimit(customer.credit_limit == null ? '' : String(customer.credit_limit))
    setNotes(customer.notes ?? '')
    setFormError(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    saveMutation.mutate({
      name,
      phone: phone || null,
      customer_type: customerType,
      subtype: customerType === 'wholesale' ? subtype : null,
      language,
      whatsapp_opt_in: whatsappOptIn,
      credit_limit:
        customerType === 'wholesale' && creditLimit !== '' ? Number(creditLimit) : null,
      notes: notes || null,
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-3xl font-semibold">Customers & accounts</h1>
          <p className="mt-1 text-sm text-muted">
            Wholesale credit lines and retail patients. Statements print in the browser (PDF later).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          New customer
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-dentaflow border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-canvas p-1">
          <button
            type="button"
            onClick={() => setTab('wholesale')}
            className={`rounded-md px-4 py-1.5 text-xs font-bold ${
              tab === 'wholesale' ? 'bg-surface shadow-sm' : 'text-muted'
            }`}
          >
            Wholesale ({customers.filter((c) => c.customer_type === 'wholesale').length})
          </button>
          <button
            type="button"
            onClick={() => setTab('retail')}
            className={`rounded-md px-4 py-1.5 text-xs font-bold ${
              tab === 'retail' ? 'bg-surface shadow-sm' : 'text-muted'
            }`}
          >
            Retail ({customers.filter((c) => c.customer_type === 'retail').length})
          </button>
        </div>
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or phone"
            className="h-10 w-full rounded-dentaflow border border-line bg-canvas pe-3 ps-9 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {customersQuery.isLoading ? (
            <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
              No {tab} customers yet.
            </p>
          ) : (
            filtered.map((customer) => {
              const isSelected = selected?.id === customer.id
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(customer.id)
                    setPayError(null)
                    setStatementOpen(false)
                  }}
                  className={`w-full rounded-dentaflow border p-4 text-start ${
                    isSelected
                      ? 'border-flow-teal bg-surface ring-2 ring-flow-teal/20'
                      : 'border-line bg-surface hover:border-flow-teal/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="h-4 w-4 text-flow-teal" />
                        <h2 className="text-sm font-bold">{customer.name}</h2>
                        {customer.subtype ? (
                          <span className="rounded bg-subtle px-2 py-0.5 text-[10px] font-semibold text-muted">
                            {customer.subtype}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">{customer.phone ?? 'No phone'}</p>
                    </div>
                    {customer.customer_type === 'wholesale' ? (
                      <div className="text-end text-xs">
                        <p className="text-muted">Outstanding</p>
                        <p className="font-mono font-bold text-status-amber">
                          {formatMoney(customer.ar_balance ?? 0)}
                        </p>
                        <p className="mt-1 text-muted">
                          Limit{' '}
                          {customer.credit_limit == null || Number(customer.credit_limit) <= 0
                            ? '—'
                            : formatMoney(Number(customer.credit_limit))}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-semibold text-muted uppercase">
                        {customer.language}
                      </p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="sticky top-20 space-y-4 rounded-dentaflow border border-line bg-surface p-4 lg:col-span-5">
          {!selected ? (
            <p className="text-sm text-muted">Select a customer to view account details.</p>
          ) : (
            <>
              <div>
                <h2 className="text-base font-bold">{selected.name}</h2>
                <p className="text-xs text-muted">
                  {selected.customer_type}
                  {selected.subtype ? ` · ${selected.subtype}` : ''} ·{' '}
                  {selected.phone ?? 'No phone'} · WhatsApp{' '}
                  {selected.language.toUpperCase()} · Points{' '}
                  <span className="font-mono font-bold">{selected.loyalty_points ?? 0}</span>
                </p>
                <p className="mt-1 text-[11px] font-semibold">
                  {selected.whatsapp_opt_in ? (
                    <span className="text-status-green">WhatsApp opted in</span>
                  ) : (
                    <span className="text-status-red">WhatsApp opted out</span>
                  )}
                </p>
              </div>

              {selected.customer_type === 'wholesale' ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-dentaflow bg-canvas p-3">
                    <p className="text-muted">Outstanding AR</p>
                    <p className="mt-1 font-mono text-sm font-bold">
                      {formatMoney(selected.ar_balance ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-dentaflow bg-canvas p-3">
                    <p className="text-muted">Credit limit</p>
                    <p className="mt-1 font-mono text-sm font-bold">
                      {selected.credit_limit == null || Number(selected.credit_limit) <= 0
                        ? 'None'
                        : formatMoney(Number(selected.credit_limit))}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setStatementOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-dentaflow border border-line px-4 text-sm font-semibold"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Statement
                </button>
              </div>

              {(salesQuery.data?.length ?? 0) > 0 ? (
                <div className="space-y-2 border-t border-line pt-3">
                  <h3 className="text-sm font-bold">Recent sales</h3>
                  <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
                    {[...(salesQuery.data ?? [])].reverse().slice(0, 8).map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center gap-2 rounded-dentaflow border border-line bg-canvas px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => setDocSale(sale)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-start hover:text-flow-teal"
                        >
                          <span className="truncate font-mono font-semibold">
                            {sale.receipt_number}
                          </span>
                          <span className="shrink-0 font-mono">{formatMoney(sale.total)}</span>
                        </button>
                        {sale.status !== 'void' ? (
                          <button
                            type="button"
                            title="Return"
                            onClick={() => setReturnSale(sale)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line hover:border-flow-teal"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                            Void
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selected.customer_type === 'wholesale' && (selected.ar_balance ?? 0) > 0 ? (
                <div className="space-y-2 border-t border-line pt-3">
                  <h3 className="text-sm font-bold">Record payment</h3>
                  <label className="block text-xs font-semibold">
                    Apply to
                    <select
                      value={paySaleId}
                      onChange={(event) => setPaySaleId(event.target.value)}
                      className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
                    >
                      <option value="all">Oldest open invoices (FIFO)</option>
                      {openInvoices.map((inv) => (
                        <option key={inv.sale_id} value={inv.sale_id}>
                          {inv.receipt_number} · due {inv.due_date ?? '—'} ·{' '}
                          {formatMoney(inv.debit)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(TENDER_LABELS) as PaymentTender[]).map((tender) => (
                      <label key={tender} className="rounded-dentaflow border border-line bg-canvas p-2">
                        <span className="text-[11px] font-semibold">{TENDER_LABELS[tender]}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tenders[tender]}
                          onChange={(event) =>
                            setTenders((current) => ({
                              ...current,
                              [tender]: event.target.value,
                            }))
                          }
                          className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono text-sm"
                          placeholder="0.00"
                        />
                      </label>
                    ))}
                  </div>
                  {payError ? <p className="text-sm text-status-red">{payError}</p> : null}
                  <button
                    type="button"
                    disabled={payMutation.isPending}
                    onClick={() => payMutation.mutate()}
                    className="h-10 w-full rounded-dentaflow bg-marine text-sm font-bold text-white disabled:opacity-60"
                  >
                    {payMutation.isPending ? 'Applying…' : 'Apply payment'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {docSale && selected ? (
        <SaleDocumentsModal
          sale={docSale}
          customerName={selected.name}
          defaultMode={selected.customer_type === 'wholesale' ? 'invoice' : 'receipt'}
          onClose={() => setDocSale(null)}
        />
      ) : null}

      {returnSale ? (
        <ReturnDrawer
          open={Boolean(returnSale)}
          sale={returnSale}
          branchId={returnSale.branch_id}
          onClose={() => setReturnSale(null)}
        />
      ) : null}

      {statementOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:static print:bg-transparent print:p-0">
          <div className="w-full max-w-3xl rounded-dentaflow border border-line bg-surface p-4 print:max-w-none print:border-0 print:p-0 print:shadow-none">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
              <div>
                <h2 className="text-lg font-bold">Account statement</h2>
                <p className="text-xs text-muted">{selected.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-9 items-center gap-2 rounded-dentaflow bg-marine px-3 text-xs font-bold text-white"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setStatementOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-dentaflow border border-line"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="print-document print-a4 mx-auto bg-white text-[#10262D]">
              <AccountStatementDocument
                customer={selected}
                lines={statementQuery.data?.lines ?? []}
                outstanding={statementQuery.data?.outstanding ?? 0}
                loading={statementQuery.isLoading}
                error={
                  statementQuery.isError
                    ? (statementQuery.error as Error).message
                    : null
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? 'Edit customer' : 'New customer'}
        subtitle="Customers belong to the selected branch."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDrawer}
              className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="customer-form"
              disabled={saveMutation.isPending}
              className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="customer-form" onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-semibold">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+252…"
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Type
            <select
              value={customerType}
              onChange={(event) => setCustomerType(event.target.value as CustomerType)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </label>
          {customerType === 'wholesale' ? (
            <>
              <label className="block text-sm font-semibold">
                Subtype
                <select
                  value={subtype}
                  onChange={(event) => setSubtype(event.target.value as WholesaleSubtype)}
                  className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
                >
                  {WHOLESALE_SUBTYPES.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Credit limit (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditLimit}
                  onChange={(event) => setCreditLimit(event.target.value)}
                  className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
                />
              </label>
            </>
          ) : null}
          <label className="block text-sm font-semibold">
            WhatsApp language
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as 'so' | 'ar' | 'en')
              }
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="so">Somali</option>
              <option value="ar">Arabic</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(event) => setWhatsappOptIn(event.target.checked)}
              className="rounded border-line"
            />
            WhatsApp opt-in
          </label>
          <label className="block text-sm font-semibold">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
            />
          </label>
          {formError ? <p className="text-sm text-status-red">{formError}</p> : null}
        </form>
      </Drawer>
    </section>
  )
}

function AccountStatementDocument({
  customer,
  lines,
  outstanding,
  loading,
  error,
}: {
  customer: Customer
  lines: StatementLine[]
  outstanding: number
  loading: boolean
  error: string | null
}) {
  const issuedAt = new Date().toLocaleDateString()
  const periodEnd = lines.length
    ? new Date(lines[lines.length - 1]!.date).toLocaleDateString()
    : issuedAt
  const periodStart = lines.length
    ? new Date(lines[0]!.date).toLocaleDateString()
    : issuedAt

  return (
    <div className="mx-auto max-w-[190mm] space-y-5 border border-[#DDE7E5] bg-white p-7 text-sm shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#0C3B4A] pb-5">
        <div className="flex items-start gap-4">
          <img
            src={CLINIC_LOGO_SRC}
            alt={CLINIC_MARK_NAME}
            className="h-20 w-20 shrink-0 object-contain"
          />
          <div className="space-y-0.5 pt-1 text-xs text-[#536E75]">
            <p className="text-sm font-bold tracking-tight text-[#0C3B4A]">
              {CLINIC_LEGAL_NAME}
            </p>
            <p>{CLINIC_ADDRESS}</p>
            <p>Tel: {CLINIC_PHONE}</p>
            <p>
              Tax ID: <span className="font-mono">{CLINIC_TAX_ID}</span>
            </p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#12A6A0] uppercase">
            Customer account
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#0C3B4A]">
            STATEMENT
          </h2>
          <div className="mt-3 space-y-0.5 text-xs text-[#536E75]">
            <p>Issued: {issuedAt}</p>
            <p>
              Period: {periodStart} – {periodEnd}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[#F4FAF9] px-4 py-3 text-xs">
          <p className="text-[10px] font-bold tracking-wide text-[#12A6A0] uppercase">
            Account of
          </p>
          <p className="mt-1 text-sm font-bold text-[#10262D]">{customer.name}</p>
          <p className="mt-0.5 text-[#536E75]">{customer.phone ?? '—'}</p>
          <p className="mt-1 capitalize text-[#536E75]">
            {customer.customer_type}
            {customer.subtype ? ` · ${customer.subtype}` : ''}
          </p>
        </div>
        <div className="rounded-lg border border-[#DDE7E5] px-4 py-3 text-xs">
          <p className="text-[10px] font-bold tracking-wide text-[#536E75] uppercase">
            Amount due
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-[#0C3B4A] tabular-nums">
            {formatMoney(outstanding)}
          </p>
          <p className="mt-1 text-[#536E75]">Open AR balance in USD</p>
        </div>
      </div>

      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-[#0C3B4A] text-[10px] tracking-wide text-white uppercase">
            <th className="rounded-l-md px-3 py-2.5 font-semibold">Date</th>
            <th className="px-3 py-2.5 font-semibold">Description</th>
            <th className="px-3 py-2.5 text-end font-semibold">Debit</th>
            <th className="px-3 py-2.5 text-end font-semibold">Credit</th>
            <th className="rounded-r-md px-3 py-2.5 text-end font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr
              key={line.id}
              className={`border-b border-[#EEF4F3] ${
                index % 2 === 1 ? 'bg-[#F8FCFB]' : ''
              }`}
            >
              <td className="px-3 py-2.5 font-mono text-[#536E75]">
                {new Date(line.date).toLocaleDateString()}
              </td>
              <td className="px-3 py-2.5">
                <span className="font-medium text-[#10262D]">{line.label}</span>
                {line.kind === 'invoice' && line.due_date ? (
                  <span className="mt-0.5 block text-[10px] text-[#536E75]">
                    Due {line.due_date}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-end font-mono tabular-nums">
                {line.debit ? formatMoney(line.debit) : '—'}
              </td>
              <td className="px-3 py-2.5 text-end font-mono tabular-nums text-[#12A6A0]">
                {line.credit ? formatMoney(line.credit) : '—'}
              </td>
              <td className="px-3 py-2.5 text-end font-mono font-bold tabular-nums text-[#0C3B4A]">
                {formatMoney(line.balance_after ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {loading ? (
        <p className="text-sm text-[#536E75]">Loading statement…</p>
      ) : error ? (
        <p className="text-sm text-status-red">{error}</p>
      ) : lines.length === 0 ? (
        <p className="rounded-lg bg-[#F4FAF9] px-4 py-6 text-center text-sm text-[#536E75]">
          No sales yet for this customer.
        </p>
      ) : (
        <div className="flex justify-end">
          <div className="w-full max-w-xs rounded-lg bg-[#0C3B4A] px-4 py-3 text-white">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Closing balance</span>
              <span className="text-lg font-black tabular-nums">
                {formatMoney(outstanding)}
              </span>
            </div>
          </div>
        </div>
      )}

      <footer className="space-y-3 border-t border-[#DDE7E5] pt-4 text-[11px] text-[#536E75]">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="font-bold text-[#0C3B4A]">Zaad</p>
            <p className="font-mono">{CLINIC_ZAAD}</p>
          </div>
          <div>
            <p className="font-bold text-[#0C3B4A]">eDahab</p>
            <p className="font-mono">{CLINIC_EDAHAB}</p>
          </div>
          <div>
            <p className="font-bold text-[#0C3B4A]">MyCash</p>
            <p className="font-mono">{CLINIC_MYCASH}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2 border-t border-[#EEF4F3] pt-3">
          <div>
            <p className="font-semibold text-[#10262D]">{CLINIC_LEGAL_NAME}</p>
            <p>
              {CLINIC_ADDRESS} · {CLINIC_PHONE}
            </p>
          </div>
          <p className="text-[10px] text-[#8AA0A6]">
            Amounts in USD · Prices exclude VAT · Computer-generated statement
          </p>
        </div>
      </footer>
    </div>
  )
}
