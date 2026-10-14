import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import {
  basePrice,
  fetchCategories,
  fetchServices,
  fetchTaxRates,
  saveService,
} from '../lib/catalog/api.ts'
import type { CatalogService, PriceTierInput, ServiceInput } from '../lib/catalog/types.ts'
import { formatMoney } from '../lib/money.ts'

type TierDraft = PriceTierInput & { key: string }

function emptyTiers(): TierDraft[] {
  return [
    { key: 'retail-1', price_list: 'retail', min_qty: 1, price: 0 },
    { key: 'wholesale-1', price_list: 'wholesale', min_qty: 1, price: 0 },
  ]
}

function tiersFromService(service: CatalogService): TierDraft[] {
  if (!service.service_prices?.length) return emptyTiers()
  return service.service_prices.map((tier, index) => ({
    key: `${tier.price_list}-${tier.min_qty}-${index}`,
    price_list: tier.price_list,
    min_qty: Number(tier.min_qty),
    price: Number(tier.price),
  }))
}

export function ServicesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogService | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [taxRateId, setTaxRateId] = useState('')
  const [active, setActive] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>(emptyTiers())

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories(true) })
  const taxRatesQuery = useQuery({ queryKey: ['tax_rates'], queryFn: () => fetchTaxRates(true) })
  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: fetchServices })

  const saveMutation = useMutation({
    mutationFn: (input: { values: ServiceInput; id?: string }) => saveService(input.values, input.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['services'] })
      closeDrawer()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const categories = categoriesQuery.data ?? []
  const taxRates = taxRatesQuery.data ?? []
  const services = (servicesQuery.data ?? []) as CatalogService[]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services.filter((service) => {
      if (categoryFilter !== 'all' && service.category_id !== categoryFilter) return false
      if (!q) return true
      return (
        service.name.toLowerCase().includes(q) ||
        service.code.toLowerCase().includes(q) ||
        (service.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [services, search, categoryFilter])

  function openCreate() {
    setEditing(null)
    setCode('')
    setName('')
    setCategoryId(categories.find((row) => row.name.includes('Whitening') || row.active)?.id ?? '')
    setDescription('')
    setDuration('')
    setTaxRateId(taxRates.find((row) => Number(row.rate) === 0)?.id ?? '')
    setActive(true)
    setTiers(emptyTiers())
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(service: CatalogService) {
    setEditing(service)
    setCode(service.code)
    setName(service.name)
    setCategoryId(service.category_id)
    setDescription(service.description ?? '')
    setDuration(service.duration_minutes == null ? '' : String(service.duration_minutes))
    setTaxRateId(service.tax_rate_id ?? '')
    setActive(service.active)
    setTiers(tiersFromService(service))
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
    setFormError(null)
    if (!categoryId || !name.trim() || !code.trim()) {
      setFormError('Code, name, and category are required.')
      return
    }
    const prices = tiers
      .filter((tier) => Number(tier.price) >= 0 && Number(tier.min_qty) > 0)
      .map(({ price_list, min_qty, price }) => ({
        price_list,
        min_qty: Number(min_qty),
        price: Number(price),
      }))
    if (!prices.some((tier) => tier.price_list === 'retail' && tier.min_qty === 1)) {
      setFormError('Add a retail price for quantity 1.')
      return
    }
    saveMutation.mutate({
      id: editing?.id,
      values: {
        code,
        name,
        category_id: categoryId,
        description: description || null,
        duration_minutes: duration ? Number(duration) : null,
        tax_rate_id: taxRateId || null,
        active,
        prices,
      },
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Services</h1>
          <p className="mt-1 text-sm text-muted">
            Shared clinical services and whitening sessions. Recipes come later.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          New service
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-dentaflow border border-line bg-surface p-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, code, or description"
            className="h-10 w-full rounded-dentaflow border border-line bg-canvas pe-3 ps-9 text-sm"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-10 rounded-dentaflow border border-line bg-canvas px-3 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Service</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Retail</th>
              <th className="px-4 py-3 font-semibold">Wholesale</th>
              <th className="px-4 py-3 font-semibold">Tax</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {servicesQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  Loading services…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  No services yet.
                </td>
              </tr>
            ) : (
              filtered.map((service) => {
                const retail = basePrice(service.service_prices ?? [], 'retail')
                const wholesale = basePrice(service.service_prices ?? [], 'wholesale')
                return (
                  <tr
                    key={service.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-subtle/60"
                    onClick={() => openEdit(service)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{service.code}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{service.name}</span>
                      {service.description ? (
                        <span className="mt-0.5 block text-xs text-muted">{service.description}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{service.categories?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {retail == null ? '—' : formatMoney(retail)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {wholesale == null ? '—' : formatMoney(wholesale)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {service.tax_rates
                        ? `${(Number(service.tax_rates.rate) * 100).toFixed(0)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          service.active
                            ? 'bg-status-green/15 text-status-green'
                            : 'bg-subtle text-muted'
                        }`}
                      >
                        {service.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? 'Edit service' : 'New service'}
        subtitle="Shared across branches. Prices exclude VAT."
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
              form="service-form"
              disabled={saveMutation.isPending}
              className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save service'}
            </button>
          </div>
        }
      >
        <form id="service-form" onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-semibold">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Code
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Duration (minutes)
              <input
                type="number"
                min="1"
                step="1"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="Optional"
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Category
            <select
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="">Select…</option>
              {categories
                .filter((row) => row.active || row.id === categoryId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Tax rate
            <select
              value={taxRateId}
              onChange={(event) => setTaxRateId(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="">None yet</option>
              {taxRates
                .filter((row) => row.active || row.id === taxRateId)
                .map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.name} ({(Number(rate.rate) * 100).toFixed(2).replace(/\.?0+$/, '')}%)
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="rounded border-line"
            />
            Active
          </label>
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Price tiers</p>
              <button
                type="button"
                onClick={() =>
                  setTiers((current) => [
                    ...current,
                    {
                      key: `tier-${Date.now()}`,
                      price_list: 'retail',
                      min_qty: 10,
                      price: 0,
                    },
                  ])
                }
                className="text-xs font-semibold text-flow-teal"
              >
                Add tier
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {tiers.map((tier, index) => (
                <div key={tier.key} className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2">
                  <select
                    value={tier.price_list}
                    onChange={(event) =>
                      setTiers((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                price_list: event.target.value as PriceTierInput['price_list'],
                              }
                            : row,
                        ),
                      )
                    }
                    className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={tier.min_qty}
                    onChange={(event) =>
                      setTiers((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, min_qty: Number(event.target.value) } : row,
                        ),
                      )
                    }
                    className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                    aria-label="Minimum quantity"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.price}
                    onChange={(event) =>
                      setTiers((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, price: Number(event.target.value) } : row,
                        ),
                      )
                    }
                    className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                    aria-label="Price"
                  />
                  <button
                    type="button"
                    disabled={tiers.length <= 1}
                    onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
                    className="text-xs font-semibold text-muted disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          {formError ? <p className="text-sm text-status-red">{formError}</p> : null}
        </form>
      </Drawer>
    </section>
  )
}
