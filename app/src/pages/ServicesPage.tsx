import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Package, Plus, Search, Trash2 } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import { useAuth } from '../lib/auth.tsx'
import {
  applyServiceRecipe,
  basePrice,
  fetchCategories,
  fetchItems,
  fetchServices,
  fetchTaxRates,
  saveService,
} from '../lib/catalog/api.ts'
import type {
  CatalogService,
  PriceTierInput,
  RecipeLineInput,
  ServiceInput,
} from '../lib/catalog/types.ts'
import { formatMoney } from '../lib/money.ts'

type TierDraft = PriceTierInput & { key: string }
type RecipeDraft = RecipeLineInput & { key: string }

function emptyTiers(): TierDraft[] {
  return [{ key: 'retail-1', price_list: 'retail', min_qty: 1, price: 0 }]
}

function tiersFromService(service: CatalogService): TierDraft[] {
  const retail = (service.service_prices ?? []).filter((tier) => tier.price_list === 'retail')
  if (!retail.length) return emptyTiers()
  return retail.map((tier, index) => ({
    key: `retail-${tier.min_qty}-${index}`,
    price_list: 'retail' as const,
    min_qty: Number(tier.min_qty),
    price: Number(tier.price),
  }))
}

function recipesFromService(service: CatalogService): RecipeDraft[] {
  return (service.service_recipes ?? []).map((line, index) => ({
    key: `${line.item_id}-${index}`,
    item_id: line.item_id,
    qty: Number(line.qty),
  }))
}

export function ServicesPage() {
  const { branchId } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogService | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [usageOk, setUsageOk] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [taxRateId, setTaxRateId] = useState('')
  const [active, setActive] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>(emptyTiers())
  const [recipes, setRecipes] = useState<RecipeDraft[]>([])

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories(true) })
  const taxRatesQuery = useQuery({ queryKey: ['tax_rates'], queryFn: () => fetchTaxRates(true) })
  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: fetchServices })
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: fetchItems })

  const saveMutation = useMutation({
    mutationFn: (input: { values: ServiceInput; id?: string }) => saveService(input.values, input.id),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['services'] })
      setSelectedId(id)
      closeDrawer()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const usageMutation = useMutation({
    mutationFn: (serviceId: string) => applyServiceRecipe(branchId as string, serviceId),
    onSuccess: async () => {
      setUsageError(null)
      setUsageOk('Recipe deducted from branch stock (service_usage).')
      await queryClient.invalidateQueries({ queryKey: ['stock_summaries'] })
      await queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
    },
    onError: (error: Error) => {
      setUsageOk(null)
      setUsageError(error.message)
    },
  })

  const categories = categoriesQuery.data ?? []
  const taxRates = taxRatesQuery.data ?? []
  const services = (servicesQuery.data ?? []) as CatalogService[]
  const items = (itemsQuery.data ?? []).filter((item) => item.active)

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

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filtered.some((service) => service.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((service) => service.id === selectedId) ?? null

  function openCreate() {
    setEditing(null)
    setCode('')
    setName('')
    setCategoryId(categories.find((row) => row.name.includes('Whitening') || row.active)?.id ?? '')
    setDescription('')
    setDuration('30')
    setTaxRateId(taxRates.find((row) => Number(row.rate) === 0)?.id ?? '')
    setActive(true)
    setTiers(emptyTiers())
    setRecipes([])
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
    setRecipes(recipesFromService(service))
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
      .map(({ min_qty, price }) => ({
        price_list: 'retail' as const,
        min_qty: Number(min_qty),
        price: Number(price),
      }))
    if (!prices.some((tier) => tier.min_qty === 1)) {
      setFormError('Add a patient price for quantity 1.')
      return
    }
    const recipeLines = recipes
      .filter((line) => line.item_id && Number(line.qty) > 0)
      .map(({ item_id, qty }) => ({ item_id, qty: Number(qty) }))
    const seen = new Set<string>()
    for (const line of recipeLines) {
      if (seen.has(line.item_id)) {
        setFormError('Each item can appear once in the recipe.')
        return
      }
      seen.add(line.item_id)
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
        recipes: recipeLines,
      },
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-3xl font-semibold">Services & Treatment Recipes</h1>
          <p className="mt-1 text-sm text-muted">
            Clinical procedures, patient pricing, duration, and inventory recipes. No wholesale.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          New clinical service
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

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {servicesQuery.isLoading ? (
            <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
              Loading services…
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
              No services yet.
            </p>
          ) : (
            filtered.map((service) => {
              const retail = basePrice(service.service_prices ?? [], 'retail')
              const recipeCount = service.service_recipes?.length ?? 0
              const isSelected = selected?.id === service.id
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(service.id)
                    setUsageError(null)
                    setUsageOk(null)
                  }}
                  className={`w-full rounded-dentaflow border p-4 text-start transition ${
                    isSelected
                      ? 'border-flow-teal bg-surface ring-2 ring-flow-teal/20'
                      : 'border-line bg-surface hover:border-flow-teal/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-flow-teal">
                          {service.code}
                        </span>
                        <span className="rounded bg-subtle px-2 py-0.5 text-[10px] font-semibold text-muted">
                          {service.categories?.name ?? '—'}
                        </span>
                        {!service.active ? (
                          <span className="rounded bg-subtle px-2 py-0.5 text-[10px] font-semibold text-muted">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-1 text-sm font-bold">{service.name}</h2>
                      {service.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{service.description}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-mono text-base font-extrabold tabular-nums">
                        {retail == null ? '—' : formatMoney(retail)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-flow-teal" />
                      {service.duration_minutes
                        ? `${service.duration_minutes} mins chair time`
                        : 'Duration not set'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                      <Package className="h-3.5 w-3.5" />
                      {recipeCount} material{recipeCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="sticky top-20 space-y-4 rounded-dentaflow border border-line bg-surface p-5 lg:col-span-5">
          {!selected ? (
            <p className="text-sm text-muted">Select a service to view its recipe.</p>
          ) : (
            <>
              <div className="border-b border-line pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-flow-teal">
                    {selected.code} RECIPE
                  </span>
                  <span className="rounded bg-flow-teal/15 px-2 py-0.5 text-xs font-semibold">
                    {selected.duration_minutes
                      ? `${selected.duration_minutes} min procedure`
                      : 'No duration'}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold">{selected.name}</h3>
                <p className="mt-1 text-xs text-muted">
                  Automatic stock deduction on POS sale or appointment completion. Use Record usage
                  to test FEFO now.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold tracking-wider uppercase">
                  Consumed clinical inventory
                </h4>
                {(selected.service_recipes ?? []).length === 0 ? (
                  <p className="rounded-dentaflow border border-dashed border-line bg-canvas px-3 py-4 text-xs text-muted">
                    No recipe yet. Edit the service to add materials.
                  </p>
                ) : (
                  <div className="divide-y divide-line overflow-hidden rounded-dentaflow border border-line">
                    {selected.service_recipes.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-3 px-3 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold">{line.items?.name ?? line.item_id}</p>
                          <p className="text-[10px] text-muted">
                            {line.items?.sku ?? '—'} · deducted per procedure
                          </p>
                        </div>
                        <div className="shrink-0 rounded bg-canvas px-2 py-1 font-mono font-bold">
                          {line.qty} {line.items?.unit ?? ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-dentaflow bg-canvas p-3.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Patient fee</span>
                  <span className="font-mono font-bold">
                    {formatMoney(basePrice(selected.service_prices ?? [], 'retail') ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Tax rate</span>
                  <span className="font-mono">
                    {selected.tax_rates
                      ? `${selected.tax_rates.name} (${(Number(selected.tax_rates.rate) * 100)
                          .toFixed(2)
                          .replace(/\.?0+$/, '')}%)`
                      : 'None'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(selected)}
                  className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
                >
                  Edit service
                </button>
                {branchId !== 'all' && (selected.service_recipes?.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    disabled={usageMutation.isPending || !selected.active}
                    onClick={() => {
                      setUsageError(null)
                      setUsageOk(null)
                      usageMutation.mutate(selected.id)
                    }}
                    className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {usageMutation.isPending ? 'Deducting…' : 'Record usage'}
                  </button>
                ) : null}
              </div>
              {branchId === 'all' ? (
                <p className="text-xs text-muted">
                  Choose one branch in the header to record recipe usage against stock.
                </p>
              ) : null}
              {usageError ? <p className="text-sm text-status-red">{usageError}</p> : null}
              {usageOk ? <p className="text-sm text-status-green">{usageOk}</p> : null}
            </>
          )}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? 'Edit service' : 'New clinical service'}
        subtitle="Shared across branches. Prices exclude VAT. Recipe is optional."
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
              <p className="text-sm font-semibold">Patient price (USD)</p>
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
                Add qty tier
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Services are patient-priced only. Wholesale lists are for products.
            </p>
            <div className="mt-2 space-y-2">
              {tiers.map((tier, index) => (
                <div key={tier.key} className="grid grid-cols-[5rem_1fr_auto] gap-2">
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
                    title="Min qty"
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

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Recipe materials</p>
              <button
                type="button"
                onClick={() =>
                  setRecipes((current) => [
                    ...current,
                    { key: `recipe-${Date.now()}`, item_id: '', qty: 1 },
                  ])
                }
                className="text-xs font-semibold text-flow-teal"
              >
                Add material
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Optional. Completing the service deducts these quantities with FEFO.
            </p>
            <div className="mt-2 space-y-2">
              {recipes.length === 0 ? (
                <p className="rounded-dentaflow border border-dashed border-line bg-canvas px-3 py-3 text-xs text-muted">
                  No materials. Service can still be sold without stock deduction.
                </p>
              ) : (
                recipes.map((line, index) => (
                  <div key={line.key} className="grid grid-cols-[1fr_5rem_auto] gap-2">
                    <select
                      value={line.item_id}
                      onChange={(event) =>
                        setRecipes((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, item_id: event.target.value } : row,
                          ),
                        )
                      }
                      className="h-10 min-w-0 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                    >
                      <option value="">Select item…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} — {item.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.qty}
                      onChange={(event) =>
                        setRecipes((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, qty: Number(event.target.value) } : row,
                          ),
                        )
                      }
                      className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                      aria-label="Quantity"
                    />
                    <button
                      type="button"
                      onClick={() => setRecipes((current) => current.filter((_, i) => i !== index))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-dentaflow border border-line text-muted"
                      aria-label="Remove material"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {formError ? <p className="text-sm text-status-red">{formError}</p> : null}
        </form>
      </Drawer>
    </section>
  )
}
