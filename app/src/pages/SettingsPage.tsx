import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  createTaxRate,
  fetchCategories,
  fetchTaxRates,
  updateCategory,
  updateTaxRate,
} from '../lib/catalog/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { fetchClinicSettings, updateClinicSettings } from '../lib/loyalty/api.ts'
import { formatTaxPercent } from '../lib/money.ts'

type Tab = 'tax' | 'categories' | 'loyalty'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('tax')
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Shared catalog settings. VAT and loyalty rates stay blank until the owner fills them in.
        </p>
      </div>
      <div className="flex gap-2 border-b border-line">
        <TabButton active={tab === 'tax'} onClick={() => setTab('tax')}>
          Tax rates
        </TabButton>
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')}>
          Categories
        </TabButton>
        {isOwner ? (
          <TabButton active={tab === 'loyalty'} onClick={() => setTab('loyalty')}>
            Loyalty
          </TabButton>
        ) : null}
      </div>
      {tab === 'tax' ? <TaxRatesPanel queryClient={queryClient} /> : null}
      {tab === 'categories' ? <CategoriesPanel queryClient={queryClient} /> : null}
      {tab === 'loyalty' && isOwner ? <LoyaltySettingsPanel queryClient={queryClient} /> : null}
    </section>
  )
}

function LoyaltySettingsPanel({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const settingsQuery = useQuery({ queryKey: ['clinic_settings'], queryFn: fetchClinicSettings })
  const [earn, setEarn] = useState('')
  const [usdPerPoint, setUsdPerPoint] = useState('')
  const [minRedeem, setMinRedeem] = useState('')
  const [expireDays, setExpireDays] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const s = settingsQuery.data
    if (!s) return
    setEarn(s.loyalty_earn_per_usd == null ? '' : String(s.loyalty_earn_per_usd))
    setUsdPerPoint(s.loyalty_usd_per_point == null ? '' : String(s.loyalty_usd_per_point))
    setMinRedeem(
      s.loyalty_min_redeem_points == null ? '' : String(s.loyalty_min_redeem_points),
    )
    setExpireDays(s.loyalty_expire_days == null ? '' : String(s.loyalty_expire_days))
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateClinicSettings,
    onSuccess: async () => {
      setError(null)
      setInfo('Loyalty settings saved.')
      await queryClient.invalidateQueries({ queryKey: ['clinic_settings'] })
    },
    onError: (err: Error) => {
      setInfo(null)
      setError(err.message)
    },
  })

  function onSave(event: FormEvent) {
    event.preventDefault()
    const earnN = earn.trim() === '' ? null : Number(earn)
    const usdN = usdPerPoint.trim() === '' ? null : Number(usdPerPoint)
    const minN = minRedeem.trim() === '' ? null : Number(minRedeem)
    const expN = expireDays.trim() === '' ? null : Number(expireDays)
    if (earnN != null && (Number.isNaN(earnN) || earnN < 0)) {
      setError('Earn rate must be a number at or above 0, or blank.')
      return
    }
    if (usdN != null && (Number.isNaN(usdN) || usdN < 0)) {
      setError('USD per point must be a number at or above 0, or blank.')
      return
    }
    if (minN != null && (Number.isNaN(minN) || minN < 0)) {
      setError('Minimum redeem points must be a number at or above 0, or blank.')
      return
    }
    if (expN != null && (Number.isNaN(expN) || expN <= 0 || !Number.isInteger(expN))) {
      setError('Expiry days must be a positive whole number, or blank.')
      return
    }
    saveMutation.mutate({
      loyalty_earn_per_usd: earnN,
      loyalty_usd_per_point: usdN,
      loyalty_min_redeem_points: minN,
      loyalty_expire_days: expN,
      clear_loyalty_earn: earnN == null,
      clear_loyalty_redeem: usdN == null,
      clear_loyalty_min: minN == null,
      clear_loyalty_expire: expN == null,
    })
  }

  return (
    <form
      onSubmit={onSave}
      className="max-w-xl space-y-4 rounded-dentaflow border border-line bg-surface p-5 text-sm"
    >
      <div>
        <h2 className="font-display text-base font-bold">Loyalty points</h2>
        <p className="mt-1 text-xs text-muted">
          Leave fields blank until the clinic confirms rates. Earn uses paid amount excluding VAT.
        </p>
      </div>
      {error ? <p className="text-xs text-status-red">{error}</p> : null}
      {info ? <p className="text-xs text-status-green">{info}</p> : null}
      <label className="block space-y-1">
        <span className="text-xs font-bold">Points earned per $1 USD spent (ex-VAT)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={earn}
          onChange={(e) => setEarn(e.target.value)}
          placeholder="Blank until confirmed"
          className="h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold">USD value per point (redeem)</span>
        <input
          type="number"
          min="0"
          step="0.0001"
          value={usdPerPoint}
          onChange={(e) => setUsdPerPoint(e.target.value)}
          placeholder="Blank until confirmed"
          className="h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold">Minimum points to redeem</span>
        <input
          type="number"
          min="0"
          step="1"
          value={minRedeem}
          onChange={(e) => setMinRedeem(e.target.value)}
          placeholder="Blank = no minimum"
          className="h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold">Optional expiry (days after earn)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={expireDays}
          onChange={(e) => setExpireDays(e.target.value)}
          placeholder="Blank = no expiry"
          className="h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-dentaflow bg-marine px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          Save loyalty parameters
        </button>
      </div>
    </form>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-semibold ${
        active
          ? 'border-flow-teal text-action'
          : 'border-transparent text-muted hover:text-main'
      }`}
    >
      {children}
    </button>
  )
}

function TaxRatesPanel({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [name, setName] = useState('')
  const [percent, setPercent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ratesQuery = useQuery({ queryKey: ['tax_rates'], queryFn: () => fetchTaxRates(true) })

  const createMutation = useMutation({
    mutationFn: createTaxRate,
    onSuccess: async () => {
      setName('')
      setPercent('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['tax_rates'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; rate?: number; active?: boolean } }) =>
      updateTaxRate(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tax_rates'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function onCreate(event: FormEvent) {
    event.preventDefault()
    const rate = Number(percent) / 100
    if (!name.trim() || Number.isNaN(rate) || rate < 0) {
      setError('Enter a name and a percentage at or above 0.')
      return
    }
    createMutation.mutate({ name, rate })
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-dentaflow border border-line bg-surface p-4 md:grid-cols-[1fr_8rem_auto]"
      >
        <label className="block text-sm font-semibold">
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Standard VAT"
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Rate %
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            placeholder="0"
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="h-10 w-full rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60 md:w-auto"
          >
            Add rate
          </button>
        </div>
      </form>
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
      <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Rate</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(ratesQuery.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-muted">
                  No tax rates yet. Add the clinic rate when it is confirmed.
                </td>
              </tr>
            ) : (
              (ratesQuery.data ?? []).map((rate) => (
                <tr key={rate.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{rate.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatTaxPercent(Number(rate.rate))}</td>
                  <td className="px-4 py-3">{rate.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({ id: rate.id, patch: { active: !rate.active } })
                      }
                      className="text-sm font-semibold text-flow-teal"
                    >
                      {rate.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoriesPanel({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchCategories(true),
  })

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setName('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; active?: boolean } }) =>
      updateCategory(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Enter a category name.')
      return
    }
    createMutation.mutate(name)
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-3 rounded-dentaflow border border-line bg-surface p-4"
      >
        <label className="block min-w-[220px] flex-1 text-sm font-semibold">
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category"
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          Add category
        </button>
      </form>
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
      <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(categoriesQuery.data ?? []).map((category) => (
              <tr key={category.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">{category.name}</td>
                <td className="px-4 py-3">{category.active ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: category.id,
                        patch: { active: !category.active },
                      })
                    }
                    className="text-sm font-semibold text-flow-teal"
                  >
                    {category.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
