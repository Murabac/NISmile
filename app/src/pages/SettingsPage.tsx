import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  createTaxRate,
  fetchCategories,
  fetchTaxRates,
  updateCategory,
  updateTaxRate,
} from '../lib/catalog/api.ts'
import { formatTaxPercent } from '../lib/money.ts'

type Tab = 'tax' | 'categories'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('tax')
  const queryClient = useQueryClient()

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Shared catalog settings. Clinic VAT percentage stays blank until you add a tax rate here.
        </p>
      </div>
      <div className="flex gap-2 border-b border-line">
        <TabButton active={tab === 'tax'} onClick={() => setTab('tax')}>
          Tax rates
        </TabButton>
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')}>
          Categories
        </TabButton>
      </div>
      {tab === 'tax' ? <TaxRatesPanel queryClient={queryClient} /> : null}
      {tab === 'categories' ? <CategoriesPanel queryClient={queryClient} /> : null}
    </section>
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
