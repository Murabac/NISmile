import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  FileText,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ReturnDrawer } from '../components/ReturnDrawer.tsx'
import { SaleDocumentsModal } from '../components/SaleDocumentsModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { linkAppointmentSale } from '../lib/appointments/api.ts'
import { fetchItems, fetchServices, basePrice } from '../lib/catalog/api.ts'
import type { CatalogItem, CatalogService } from '../lib/catalog/types.ts'
import {
  foreignCurrencyForRegion,
  formatForeign,
  formatMoney,
  formatMoneyForRegion,
  rateForRegion,
} from '../lib/money.ts'
import { fetchClinicSettings, previewLoyaltyRedeem } from '../lib/loyalty/api.ts'
import { evaluateCartPromotion } from '../lib/promotions/api.ts'
import {
  checkoutSale,
  fetchBranchCustomers,
  fetchSale,
  resolveDisplayPrice,
} from '../lib/sales/api.ts'
import {
  TENDER_LABELS,
  type PaymentTender,
  type Sale,
  type SaleLineType,
} from '../lib/sales/types.ts'
import { fetchBranchStockSummaries } from '../lib/stock/api.ts'

type CartLine = {
  key: string
  line_type: SaleLineType
  item_id: string | null
  service_id: string | null
  sku_or_code: string
  name: string
  qty: number
  unit_price: number
  tax_rate: number
}

type TenderDraft = Record<PaymentTender, string>

const emptyTenders = (): TenderDraft => ({
  cash: '',
  zaad: '',
  edahab: '',
  mycash: '',
})

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Match a stored phone even if the cashier types spaces, +252, or only the local number. */
function phoneMatches(phone: string | null, query: string): boolean {
  const queryDigits = phoneDigits(query)
  if (queryDigits.length < 3 || !phone) return false
  const stored = phoneDigits(phone)
  if (!stored) return false
  if (stored.includes(queryDigits)) return true
  const local = stored.replace(/^252/, '').replace(/^0+/, '')
  const typed = queryDigits.replace(/^252/, '').replace(/^0+/, '')
  return typed.length >= 3 && local.includes(typed)
}

function customerMatchesQuery(
  customer: { name: string; phone: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (customer.name.toLowerCase().includes(q)) return true
  return phoneMatches(customer.phone, q)
}

export function PosPage() {
  const { branchId, branches } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [tab, setTab] = useState<'items' | 'services'>('items')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [customerId, setCustomerIdState] = useState<string>('walk-in')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerHighlight, setCustomerHighlight] = useState(0)
  const customerBoxRef = useRef<HTMLDivElement>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [tenders, setTenders] = useState<TenderDraft>(emptyTenders)
  const [foreignPay, setForeignPay] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [lastCustomerName, setLastCustomerName] = useState('Walk-in')
  const [docsOpen, setDocsOpen] = useState(false)
  const [docsMode, setDocsMode] = useState<'receipt' | 'invoice'>('receipt')
  const [returnOpen, setReturnOpen] = useState(false)
  const [redeemLoyalty, setRedeemLoyalty] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const prefillsApplied = useRef<string | null>(null)

  const activeBranch = branches.find((b) => b.id === branchId)
  const branchRegion = activeBranch?.region ?? 'somaliland'

  function setCustomerId(id: string) {
    setCustomerIdState(id)
    setRedeemLoyalty(false)
  }

  function chooseCustomer(id: string) {
    if (id !== customerId) {
      setCustomerId(id)
      // Keep cart; items stay on retail list. Service prices stay as entered.
      setLastSale(null)
    }
    setCustomerQuery('')
    setCustomerOpen(false)
  }

  const isClinic = activeBranch?.kind !== 'warehouse'
  const branchReady = branchId !== 'all' && isClinic

  const itemsQuery = useQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
    enabled: branchReady,
  })
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    enabled: branchReady,
  })
  const customersQuery = useQuery({
    queryKey: ['pos_customers', branchId],
    queryFn: () => fetchBranchCustomers(branchId),
    enabled: branchReady,
  })
  const stockQuery = useQuery({
    queryKey: ['stock_summaries', branchId],
    queryFn: () => fetchBranchStockSummaries(branchId),
    enabled: branchReady,
  })
  const settingsQuery = useQuery({
    queryKey: ['clinic_settings'],
    queryFn: fetchClinicSettings,
    enabled: branchReady,
  })

  const items = (itemsQuery.data ?? []).filter((row) => row.active) as CatalogItem[]
  const services = (servicesQuery.data ?? []).filter((row) => row.active) as CatalogService[]
  // Clinic POS is retail patients only — wholesale buyers use Wholesale Orders.
  const customers = useMemo(
    () => (customersQuery.data ?? []).filter((c) => c.customer_type !== 'wholesale'),
    [customersQuery.data],
  )
  const customerChoices = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    const showWalkIn = !q || 'walk-in'.startsWith(q) || 'walk in'.startsWith(q)
    const matched = customers
      .filter((customer) => customerMatchesQuery(customer, customerQuery))
      .slice(0, 12)
    return {
      showWalkIn,
      matched,
      count: (showWalkIn ? 1 : 0) + matched.length,
    }
  }, [customers, customerQuery])

  useEffect(() => {
    setCustomerHighlight(0)
  }, [customerQuery])
  const stockByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of stockQuery.data ?? []) map.set(row.item_id, row.qty_on_hand)
    return map
  }, [stockQuery.data])

  useEffect(() => {
    if (!branchReady) return
    if (customersQuery.isLoading || servicesQuery.isLoading) return

    const apt = searchParams.get('appointment')
    const customer = searchParams.get('customer')
    const service = searchParams.get('service')
    if (!apt || !customer) {
      setAppointmentId(null)
      return
    }

    const applyKey = `${apt}:${customer}:${service ?? ''}`
    if (prefillsApplied.current === applyKey) return
    prefillsApplied.current = applyKey

    setAppointmentId(apt)
    setCustomerId(customer)

    if (service) {
      const catalogService = services.find((row) => row.id === service)
      if (catalogService) {
        const taxRate =
          catalogService.tax_rates && Number(catalogService.tax_rates.rate) >= 0
            ? Number(catalogService.tax_rates.rate)
            : 0
        const unit =
          resolveDisplayPrice(catalogService.service_prices ?? [], 'retail', 1, {
            retailOnly: true,
          }) ??
          basePrice(catalogService.service_prices ?? [], 'retail') ??
          0
        setTab('services')
        setCart((current) => {
          if (current.some((line) => line.service_id === catalogService.id)) return current
          return [
            ...current,
            {
              key: `service-${catalogService.id}`,
              line_type: 'service',
              item_id: null,
              service_id: catalogService.id,
              sku_or_code: catalogService.code,
              name: catalogService.name,
              qty: 1,
              unit_price: unit,
              tax_rate: taxRate,
            },
          ]
        })
      }
    }
  }, [
    branchReady,
    customersQuery.isLoading,
    servicesQuery.isLoading,
    searchParams,
    services,
  ])

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null
  const priceList = 'retail' as const

  const itemCategories = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      if (item.categories) map.set(item.categories.id, item.categories.name)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const serviceCategories = useMemo(() => {
    const map = new Map<string, string>()
    for (const service of services) {
      if (service.categories) map.set(service.categories.id, service.categories.name)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [services])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryId !== 'all' && item.category_id !== categoryId) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, search, categoryId])

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services.filter((service) => {
      if (categoryId !== 'all' && service.category_id !== categoryId) return false
      if (!q) return true
      return (
        service.name.toLowerCase().includes(q) ||
        service.code.toLowerCase().includes(q) ||
        (service.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [services, search, categoryId])

  const cartLinesPayload = useMemo(
    () =>
      cart.map((line) => ({
        line_type: line.line_type,
        item_id: line.item_id,
        service_id: line.service_id,
        qty: line.qty,
        ...(line.line_type === 'service' ? { unit_price: line.unit_price } : {}),
      })),
    [cart],
  )

  const promoQuery = useQuery({
    queryKey: ['cart_promo', branchId, customerId, cartLinesPayload],
    queryFn: () =>
      evaluateCartPromotion({
        branchId,
        customerId: customerId === 'walk-in' ? null : customerId,
        lines: cartLinesPayload,
      }),
    enabled: branchReady && cart.length > 0,
  })

  const promoName = promoQuery.data?.name ?? promoQuery.data?.code ?? null
  const settings = settingsQuery.data
  const fxRate = rateForRegion(branchRegion, settings)
  const foreignCode = foreignCurrencyForRegion(branchRegion)
  const loyaltyBalance = selectedCustomer?.loyalty_points ?? 0
  const minRedeemOk =
    settings?.loyalty_min_redeem_points == null ||
    loyaltyBalance >= settings.loyalty_min_redeem_points
  const loyaltyRatesReady =
    settings?.loyalty_usd_per_point != null &&
    settings.loyalty_usd_per_point > 0 &&
    loyaltyBalance > 0 &&
    minRedeemOk

  const netAfterPromo = useMemo(() => {
    if (promoQuery.data && cart.length > 0) {
      return round2(promoQuery.data.subtotal - promoQuery.data.discount_total)
    }
    return round2(cart.reduce((sum, line) => sum + line.unit_price * line.qty, 0))
  }, [cart, promoQuery.data])

  const loyaltyQuery = useQuery({
    queryKey: ['loyalty_preview', customerId, loyaltyBalance, netAfterPromo, redeemLoyalty],
    queryFn: () =>
      previewLoyaltyRedeem({
        customerId,
        redeemPoints: loyaltyBalance,
        remainingNet: netAfterPromo,
      }),
    enabled:
      redeemLoyalty &&
      customerId !== 'walk-in' &&
      cart.length > 0 &&
      Boolean(settings?.loyalty_usd_per_point),
  })

  const loyaltyDiscount = redeemLoyalty && loyaltyQuery.data?.ok ? loyaltyQuery.data.discount : 0
  const loyaltyPointsUsed =
    redeemLoyalty && loyaltyQuery.data?.ok ? loyaltyQuery.data.points : 0

  const cartTotals = useMemo(() => {
    if (promoQuery.data && cart.length > 0) {
      const promoDisc = promoQuery.data.discount_total
      const subtotal = promoQuery.data.subtotal
      const taxable = Math.max(0, round2(subtotal - promoDisc - loyaltyDiscount))
      // Recalculate tax proportionally from promo-priced lines after loyalty.
      const preTaxable = Math.max(0, round2(subtotal - promoDisc))
      const taxTotal =
        preTaxable > 0
          ? round2(promoQuery.data.tax_total * (taxable / preTaxable))
          : 0
      return {
        subtotal,
        discount: round2(promoDisc + loyaltyDiscount),
        promoDiscount: promoDisc,
        loyaltyDiscount,
        taxTotal,
        total: round2(taxable + taxTotal),
      }
    }
    let subtotal = 0
    let taxTotal = 0
    for (const line of cart) {
      const net = line.unit_price * line.qty
      subtotal += net
      taxTotal += net * line.tax_rate
    }
    const taxable = Math.max(0, round2(subtotal - loyaltyDiscount))
    const taxAdj = subtotal > 0 ? round2(taxTotal * (taxable / subtotal)) : 0
    return {
      subtotal: round2(subtotal),
      discount: round2(loyaltyDiscount),
      promoDiscount: 0,
      loyaltyDiscount,
      taxTotal: taxAdj,
      total: round2(taxable + taxAdj),
    }
  }, [cart, promoQuery.data, loyaltyDiscount])

  const paidTotal = useMemo(() => {
    return round2(
      (Object.keys(tenders) as PaymentTender[]).reduce((sum, tender) => {
        const n = Number(tenders[tender])
        return sum + (Number.isFinite(n) && n > 0 ? n : 0)
      }, 0),
    )
  }, [tenders])

  const remaining = round2(Math.max(0, cartTotals.total - paidTotal))
  const overpaid = paidTotal > cartTotals.total + 0.009

  // If cart total drops (qty/loyalty/promo), shrink tender amounts so paid never exceeds total.
  useEffect(() => {
    setTenders((current) => {
      let budget = cartTotals.total
      let changed = false
      const next: TenderDraft = { ...current }
      for (const tender of Object.keys(TENDER_LABELS) as PaymentTender[]) {
        const raw = next[tender]
        if (!raw.trim()) continue
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) {
          if (raw !== '') {
            next[tender] = ''
            changed = true
          }
          continue
        }
        if (n > budget + 0.0001) {
          next[tender] = budget > 0.0001 ? String(round2(budget)) : ''
          changed = true
          budget = 0
        } else {
          budget = round2(budget - n)
        }
      }
      return changed ? next : current
    })
  }, [cartTotals.total])

  function tenderOthersPaid(current: TenderDraft, tender: PaymentTender) {
    return round2(
      (Object.keys(current) as PaymentTender[]).reduce((sum, key) => {
        if (key === tender) return sum
        const n = Number(current[key])
        return sum + (Number.isFinite(n) && n > 0 ? n : 0)
      }, 0),
    )
  }

  function maxForTender(tender: PaymentTender) {
    return round2(Math.max(0, cartTotals.total - tenderOthersPaid(tenders, tender)))
  }

  function setTenderAmount(tender: PaymentTender, raw: string) {
    if (raw.trim() === '') {
      setTenders((current) => ({ ...current, [tender]: '' }))
      return
    }
    // Allow in-progress decimals like "12." while typing.
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return

    setTenders((current) => {
      const max = round2(Math.max(0, cartTotals.total - tenderOthersPaid(current, tender)))
      if (n > max + 0.0001) {
        return { ...current, [tender]: max > 0.0001 ? String(max) : '' }
      }
      return { ...current, [tender]: raw }
    })
  }

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const payments = (Object.keys(tenders) as PaymentTender[])
        .map((tender) => ({
          tender,
          amount: Number(tenders[tender]),
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
      if (cart.length === 0) throw new Error('Cart is empty.')
      if (cartTotals.total <= 0) throw new Error('Sale total must be greater than zero.')
      if (payments.some((row) => row.amount <= 0)) {
        throw new Error('Payment amounts must be positive.')
      }
      if (paidTotal > cartTotals.total + 0.009) {
        throw new Error(
          `Paid total (${paidTotal.toFixed(2)}) cannot exceed sale total (${cartTotals.total.toFixed(2)}).`,
        )
      }

      const unpaid = round2(cartTotals.total - paidTotal)
      if (unpaid > 0.009) {
        if (payments.length === 0) throw new Error('Enter at least one payment amount.')
      } else if (payments.length === 0) {
        throw new Error('Enter at least one payment amount.')
      }

      if (appointmentId && (customerId === 'walk-in' || !customerId)) {
        throw new Error('Select the appointment patient before checkout.')
      }

      const saleId = await checkoutSale({
        branchId,
        customerId: customerId === 'walk-in' ? null : customerId,
        lines: cart.map((line) => ({
          line_type: line.line_type,
          item_id: line.item_id,
          service_id: line.service_id,
          qty: line.qty,
          ...(line.line_type === 'service' ? { unit_price: line.unit_price } : {}),
        })),
        payments,
        dueDate: null,
        redeemPoints: redeemLoyalty ? loyaltyPointsUsed : 0,
      })

      if (appointmentId) {
        await linkAppointmentSale(appointmentId, saleId)
      }

      return fetchSale(saleId)
    },
    onSuccess: async (sale) => {
      setError(null)
      setCart([])
      setTenders(emptyTenders())
      setRedeemLoyalty(false)
      setLastSale(sale)
      setLastCustomerName(
        customerId === 'walk-in'
          ? 'Walk-in'
          : (customers.find((c) => c.id === customerId)?.name ?? 'Customer'),
      )
      setDocsMode('receipt')
      setDocsOpen(true)
      if (appointmentId) {
        setAppointmentId(null)
        prefillsApplied.current = null
        navigate('/pos', { replace: true })
        await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      }
      await queryClient.invalidateQueries({ queryKey: ['stock_summaries'] })
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['pos_customers'] })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function addItem(item: CatalogItem) {
    const taxRate = Number(item.tax_rates?.rate ?? 0)
    const existing = cart.find((line) => line.line_type === 'item' && line.item_id === item.id)
    const nextQty = (existing?.qty ?? 0) + 1
    const unit =
      resolveDisplayPrice(item.item_prices ?? [], priceList, nextQty) ??
      basePrice(item.item_prices ?? [], 'retail') ??
      0
    setLastSale(null)
    setError(null)
    if (existing) {
      setCart((current) =>
        current.map((line) =>
          line.key === existing.key
            ? {
                ...line,
                qty: nextQty,
                unit_price: unit,
                tax_rate: taxRate,
              }
            : line,
        ),
      )
      return
    }
    setCart((current) => [
      ...current,
      {
        key: `item-${item.id}`,
        line_type: 'item',
        item_id: item.id,
        service_id: null,
        sku_or_code: item.sku,
        name: item.name,
        qty: 1,
        unit_price: unit,
        tax_rate: taxRate,
      },
    ])
  }

  function addService(service: CatalogService) {
    const taxRate =
      service.tax_rates && Number(service.tax_rates.rate) >= 0
        ? Number(service.tax_rates.rate)
        : 0
    const existing = cart.find(
      (line) => line.line_type === 'service' && line.service_id === service.id,
    )
    const nextQty = (existing?.qty ?? 0) + 1
    const unit =
      resolveDisplayPrice(service.service_prices ?? [], 'retail', nextQty, { retailOnly: true }) ??
      basePrice(service.service_prices ?? [], 'retail') ??
      0
    setLastSale(null)
    setError(null)
    if (existing) {
      setCart((current) =>
        current.map((line) =>
          line.key === existing.key
            ? { ...line, qty: nextQty, unit_price: unit, tax_rate: taxRate }
            : line,
        ),
      )
      return
    }
    setCart((current) => [
      ...current,
      {
        key: `service-${service.id}`,
        line_type: 'service',
        item_id: null,
        service_id: service.id,
        sku_or_code: service.code,
        name: service.name,
        qty: 1,
        unit_price: unit,
        tax_rate: taxRate,
      },
    ])
  }

  function updateQty(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.key !== key) return line
          const qty = line.qty + delta
          if (qty <= 0) return null
          if (line.line_type === 'service' && qty !== Math.trunc(qty)) return line
          // Services keep the checkout-entered price; items follow catalog tiers.
          if (line.line_type === 'service') {
            return { ...line, qty }
          }
          const item = items.find((row) => row.id === line.item_id)
          const unit = item
            ? (resolveDisplayPrice(item.item_prices ?? [], priceList, qty) ?? line.unit_price)
            : line.unit_price
          return { ...line, qty, unit_price: unit }
        })
        .filter(Boolean) as CartLine[],
    )
  }

  function updateServicePrice(key: string, raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, '')
    const parsed = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned)
    if (!Number.isFinite(parsed) || parsed < 0) return
    setCart((current) =>
      current.map((line) =>
        line.key === key && line.line_type === 'service'
          ? { ...line, unit_price: round2(parsed) }
          : line,
      ),
    )
  }

  function fillRemaining(tender: PaymentTender) {
    const need = maxForTender(tender)
    setTenders((current) => ({ ...current, [tender]: need > 0 ? String(need) : '' }))
  }

  if (!branchReady) {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Point of Sale</h1>
        <p className="mt-3 max-w-xl text-muted">
          {branchId !== 'all' && !isClinic
            ? 'Point of Sale is for clinic branches only. Switch to a clinic, or use Wholesale Orders on the warehouse.'
            : 'Choose one clinic branch in the header before ringing up a sale.'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Point of Sale</h1>
        <p className="mt-1 text-sm text-muted">
          Items and services, VAT from each line tax rate, Cash / Zaad / eDahab / MyCash. Partial
          payment allowed.
        </p>
      </div>

      {appointmentId ? (
        <div className="rounded-dentaflow border border-flow-teal/40 bg-flow-teal/10 px-4 py-3 text-sm text-main">
          Checking out appointment · add products then pay. Completing checkout marks the visit
          completed and links this sale.
        </div>
      ) : null}

      {lastSale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-dentaflow border border-status-green/40 bg-surface px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-status-green">
            <CheckCircle2 className="h-4 w-4" />
            Sale {lastSale.receipt_number} · {formatMoney(lastSale.total)} ·{' '}
            {lastSale.status === 'partial' ? 'Partial' : 'Paid'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDocsMode('receipt')
                setDocsOpen(true)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              Receipt
            </button>
            <button
              type="button"
              onClick={() => {
                setDocsMode('invoice')
                setDocsOpen(true)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-xs font-semibold"
            >
              <FileText className="h-3.5 w-3.5" />
              A4 invoice
            </button>
            {lastSale.status !== 'void' ? (
              <button
                type="button"
                onClick={() => setReturnOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Return
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLastSale(null)}
              className="text-xs font-semibold text-flow-teal"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {docsOpen && lastSale ? (
        <SaleDocumentsModal
          key={`${lastSale.id}-${docsMode}`}
          sale={lastSale}
          customerName={lastCustomerName}
          defaultMode={docsMode}
          onClose={() => setDocsOpen(false)}
        />
      ) : null}

      {branchId !== 'all' ? (
        <ReturnDrawer
          open={returnOpen}
          sale={lastSale}
          branchId={branchId}
          onClose={() => setReturnOpen(false)}
          onDone={async () => {
            if (!lastSale) return
            const refreshed = await fetchSale(lastSale.id)
            if (refreshed) setLastSale(refreshed)
          }}
        />
      ) : null}

      {error ? <p className="text-sm text-status-red">{error}</p> : null}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="space-y-4 rounded-dentaflow border border-line bg-surface p-4 lg:col-span-7">
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, SKU, code, or barcode"
              className="h-11 w-full rounded-dentaflow border border-line bg-canvas pe-3 ps-9 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <button
              type="button"
              onClick={() => {
                setTab('items')
                setCategoryId('all')
              }}
              className={`h-10 rounded-dentaflow px-4 text-xs font-bold ${
                tab === 'items' ? 'bg-marine text-white' : 'bg-canvas text-muted'
              }`}
            >
              Items ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('services')
                setCategoryId('all')
              }}
              className={`h-10 rounded-dentaflow px-4 text-xs font-bold ${
                tab === 'services' ? 'bg-marine text-white' : 'bg-canvas text-muted'
              }`}
            >
              Services ({services.length})
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                categoryId === 'all'
                  ? 'border border-flow-teal/40 bg-flow-teal/15 font-bold'
                  : 'bg-canvas text-muted'
              }`}
            >
              All
            </button>
            {(tab === 'items' ? itemCategories : serviceCategories).map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryId(id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                  categoryId === id
                    ? 'border border-flow-teal/40 bg-flow-teal/15 font-bold'
                    : 'bg-canvas text-muted'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid max-h-[580px] grid-cols-1 gap-3 overflow-y-auto pe-1 sm:grid-cols-2">
            {tab === 'items'
              ? filteredItems.map((item) => {
                  const qty = stockByItem.get(item.id) ?? 0
                  const price =
                    resolveDisplayPrice(item.item_prices ?? [], priceList, 1) ??
                    basePrice(item.item_prices ?? [], priceList) ??
                    0
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="flex min-h-[110px] flex-col justify-between rounded-dentaflow border border-line bg-canvas p-3.5 text-start hover:border-flow-teal"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span className="font-mono">{item.sku}</span>
                          <span
                            className={`font-mono text-[10px] font-semibold ${
                              qty === 0
                                ? 'text-status-red'
                                : qty <= Number(item.reorder_level)
                                  ? 'text-status-amber'
                                  : 'text-status-green'
                            }`}
                          >
                            {qty} in stock
                          </span>
                        </div>
                        <h3 className="mt-1 line-clamp-2 text-xs font-bold">{item.name}</h3>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                        <span className="text-[11px] text-muted">{item.unit}</span>
                        <span className="inline-flex items-center gap-2 font-mono text-sm font-bold">
                          {formatMoney(price)}
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-flow-teal/15 text-flow-teal">
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </span>
                      </div>
                    </button>
                  )
                })
              : filteredServices.map((service) => {
                  const price =
                    resolveDisplayPrice(service.service_prices ?? [], 'retail', 1, {
                      retailOnly: true,
                    }) ??
                    basePrice(service.service_prices ?? [], 'retail') ??
                    0
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => addService(service)}
                      className="flex min-h-[110px] flex-col justify-between rounded-dentaflow border border-line bg-canvas p-3.5 text-start hover:border-flow-teal"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span className="font-mono">{service.code}</span>
                          {service.duration_minutes ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {service.duration_minutes} min
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-1 line-clamp-2 text-xs font-bold">{service.name}</h3>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {service.categories?.name ?? 'Service'}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                        <span className="text-[11px] text-muted">Patient fee</span>
                        <span className="inline-flex items-center gap-2 font-mono text-sm font-bold">
                          {formatMoney(price)}
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-flow-teal/15 text-flow-teal">
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </span>
                      </div>
                    </button>
                  )
                })}
          </div>
        </div>

        <div className="sticky top-20 space-y-4 rounded-dentaflow border border-line bg-surface p-4 lg:col-span-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
              <User className="h-3.5 w-3.5 text-flow-teal" />
              Customer
            </label>
            <div ref={customerBoxRef} className="relative">
              <input
                role="combobox"
                aria-expanded={customerOpen}
                aria-controls="pos-customer-list"
                aria-autocomplete="list"
                value={
                  customerOpen
                    ? customerQuery
                    : customerId === 'walk-in'
                      ? ''
                      : [
                          selectedCustomer?.name,
                          selectedCustomer?.phone,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                }
                placeholder={
                  customerId === 'walk-in'
                    ? 'Walk-in, or search name / phone'
                    : 'Search name or phone'
                }
                onChange={(event) => {
                  setCustomerQuery(event.target.value)
                  setCustomerOpen(true)
                }}
                onFocus={() => {
                  setCustomerQuery('')
                  setCustomerOpen(true)
                }}
                onBlur={() => {
                  window.setTimeout(() => setCustomerOpen(false), 120)
                }}
                onKeyDown={(event) => {
                  if (!customerOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
                    setCustomerOpen(true)
                    return
                  }
                  if (event.key === 'Escape') {
                    setCustomerOpen(false)
                    return
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setCustomerHighlight((index) =>
                      Math.min(index + 1, Math.max(customerChoices.count - 1, 0)),
                    )
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setCustomerHighlight((index) => Math.max(index - 1, 0))
                  } else if (event.key === 'Enter' && customerOpen) {
                    event.preventDefault()
                    const index = customerChoices.showWalkIn
                      ? customerHighlight - 1
                      : customerHighlight
                    if (customerChoices.showWalkIn && customerHighlight === 0) {
                      chooseCustomer('walk-in')
                    } else if (customerChoices.matched[index]) {
                      chooseCustomer(customerChoices.matched[index].id)
                    }
                  }
                }}
                className="h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 text-sm"
              />
              {customerOpen ? (
                <ul
                  id="pos-customer-list"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-dentaflow border border-line bg-surface py-1 shadow-lg"
                >
                  {customerChoices.showWalkIn ? (
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected={customerId === 'walk-in'}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseCustomer('walk-in')}
                        className={`flex w-full px-3 py-2 text-start text-sm ${
                          customerHighlight === 0 ? 'bg-canvas' : ''
                        }`}
                      >
                        Walk-in (retail)
                      </button>
                    </li>
                  ) : null}
                  {customerChoices.matched.map((customer, index) => {
                    const optionIndex = index + (customerChoices.showWalkIn ? 1 : 0)
                    const queryHasDigits = phoneDigits(customerQuery).length >= 3
                    return (
                      <li key={customer.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={customer.id === customerId}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseCustomer(customer.id)}
                          className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-start ${
                            customerHighlight === optionIndex ? 'bg-canvas' : ''
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {queryHasDigits && customer.phone ? customer.phone : customer.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {queryHasDigits && customer.phone
                                ? customer.name
                                : customer.phone || 'No phone'}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {customerChoices.count === 0 ? (
                    <li className="px-3 py-2 text-xs text-muted">
                      No customer with that name or phone.
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            <p className="text-[11px] text-muted">Price list: Retail</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Cart</h2>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-muted"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {cart.length === 0 ? (
              <p className="rounded-dentaflow border border-dashed border-line bg-canvas px-3 py-6 text-center text-xs text-muted">
                Tap catalog cards to add lines.
              </p>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-dentaflow border border-line">
                {cart.map((line) => (
                  <div key={line.key} className="flex items-start gap-2 px-3 py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{line.name}</p>
                      <p className="font-mono text-[10px] text-muted">{line.sku_or_code}</p>
                      {line.line_type === 'service' ? (
                        <label className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-muted">Price</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={String(line.unit_price)}
                            onChange={(event) => updateServicePrice(line.key, event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            className="h-7 w-24 rounded-md border border-line bg-canvas px-2 font-mono text-xs"
                            aria-label={`Price for ${line.name}`}
                          />
                          <span className="text-[10px] text-muted">ex-VAT</span>
                        </label>
                      ) : (
                        <p className="mt-1 font-mono text-[10px] text-muted">
                          {formatMoney(line.unit_price)} ex-VAT
                        </p>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(line.key, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-8 text-center font-mono font-bold">{line.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(line.key, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-mono font-bold">
                        {formatMoney(line.unit_price * line.qty)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCart((current) => current.filter((row) => row.key !== line.key))}
                        className="mt-2 inline-flex text-muted"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {customerId !== 'walk-in' ? (
            <div className="rounded-dentaflow border border-line bg-canvas p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold">Loyalty points</p>
                  <p className="text-muted">
                    Balance:{' '}
                    <span className="font-mono font-bold text-main">{loyaltyBalance}</span>
                    {!settings?.loyalty_usd_per_point ? (
                      <span className="ms-1">(rates blank in Settings)</span>
                    ) : null}
                  </p>
                </div>
                <label className="flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={redeemLoyalty}
                    disabled={!loyaltyRatesReady}
                    onChange={(e) => setRedeemLoyalty(e.target.checked)}
                  />
                  Redeem
                </label>
              </div>
              {redeemLoyalty && loyaltyQuery.data && !loyaltyQuery.data.ok ? (
                <p className="mt-2 text-status-amber">
                  {loyaltyQuery.data.reason === 'rates_blank'
                    ? 'Owner must set redeem value in Settings first.'
                    : loyaltyQuery.data.reason === 'below_min'
                      ? 'Below minimum redeem balance.'
                      : 'Cannot redeem on this cart.'}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5 rounded-dentaflow bg-canvas p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal (ex-VAT)</span>
              <span className="font-mono font-bold">{formatMoney(cartTotals.subtotal)}</span>
            </div>
            {cartTotals.promoDiscount > 0.009 ? (
              <div className="flex justify-between text-[#FF6B57]">
                <span className="font-semibold">
                  Promo{promoName ? `: ${promoName}` : ''}
                </span>
                <span className="font-mono font-bold">-{formatMoney(cartTotals.promoDiscount)}</span>
              </div>
            ) : null}
            {cartTotals.loyaltyDiscount > 0.009 ? (
              <div className="flex justify-between text-flow-teal">
                <span className="font-semibold">
                  Points ({loyaltyPointsUsed} pts)
                </span>
                <span className="font-mono font-bold">
                  -{formatMoney(cartTotals.loyaltyDiscount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">VAT</span>
              <span className="font-mono font-bold">{formatMoney(cartTotals.taxTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-sm">
              <span className="font-bold">Total</span>
              <span className="text-end font-mono font-extrabold">
                {formatMoneyForRegion(cartTotals.total, branchRegion, settings)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-bold">Payments</h2>
            {fxRate != null ? (
              <div className="rounded-dentaflow border border-line bg-canvas p-2 text-[11px]">
                <label className="flex flex-wrap items-end gap-2 font-semibold">
                  <span className="min-w-[7rem]">Pay in {foreignCode}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={foreignPay}
                    onChange={(e) => setForeignPay(e.target.value)}
                    placeholder={`Amount in ${foreignCode}`}
                    className="h-8 min-w-[7rem] flex-1 rounded-md border border-line bg-surface px-2 font-mono"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-marine px-2 py-1.5 text-[10px] font-bold text-white"
                    onClick={() => {
                      const n = Number(foreignPay)
                      if (!Number.isFinite(n) || n <= 0 || fxRate <= 0) return
                      const usd = round2(n / fxRate)
                      const capped = Math.min(usd, maxForTender('cash'))
                      setTenderAmount('cash', capped > 0 ? String(capped) : '')
                      setForeignPay('')
                    }}
                  >
                    → Cash USD
                  </button>
                </label>
                <p className="mt-1 text-muted">
                  Converts at clinic rate (
                  {formatForeign(1, foreignCode, fxRate)} per $1) into Cash tender.
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TENDER_LABELS) as PaymentTender[]).map((tender) => (
                <label key={tender} className="rounded-dentaflow border border-line bg-canvas p-2">
                  <span className="flex items-center justify-between text-[11px] font-semibold">
                    {TENDER_LABELS[tender]}
                    <button
                      type="button"
                      onClick={() => fillRemaining(tender)}
                      className="text-[10px] font-bold text-flow-teal"
                    >
                      Fill
                    </button>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={maxForTender(tender)}
                    step="0.01"
                    inputMode="decimal"
                    value={tenders[tender]}
                    onChange={(event) => setTenderAmount(tender, event.target.value)}
                    placeholder="0.00"
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Paid</span>
              <span
                className={`font-mono font-bold ${overpaid ? 'text-status-red' : ''}`}
              >
                {formatMoney(paidTotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Remaining</span>
              <span
                className={`font-mono font-bold ${remaining > 0 ? 'text-status-amber' : 'text-status-green'}`}
              >
                {formatMoney(remaining)}
              </span>
            </div>
            {overpaid ? (
              <p className="text-[11px] font-semibold text-status-red">
                Paid cannot exceed sale total ({formatMoney(cartTotals.total)}).
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={checkoutMutation.isPending || cart.length === 0 || overpaid}
            onClick={() => checkoutMutation.mutate()}
            className="h-11 w-full rounded-dentaflow bg-marine text-sm font-bold text-white disabled:opacity-60"
          >
            {checkoutMutation.isPending
              ? 'Processing…'
              : remaining > 0 && paidTotal > 0
                ? 'Complete partial checkout'
                : 'Complete checkout'}
          </button>
        </div>
      </div>
    </section>
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
