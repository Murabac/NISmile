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
import {
  createBranch,
  deleteBranch,
  fetchBranches,
  setBranchActive,
  updateBranch,
} from '../lib/branches/api.ts'
import type { Branch } from '../lib/branches/types.ts'
import { fetchClinicSettings, updateClinicSettings } from '../lib/loyalty/api.ts'
import { formatTaxPercent } from '../lib/money.ts'
import { fetchGoLiveStatus, updateGoLiveChecklist } from '../lib/reports/api.ts'
import type { GoLiveStatus } from '../lib/reports/types.ts'

type Tab = 'branches' | 'tax' | 'categories' | 'loyalty' | 'golive'

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
      <div className="flex flex-wrap gap-2 border-b border-line">
        {isOwner ? (
          <TabButton active={tab === 'branches'} onClick={() => setTab('branches')}>
            Branches
          </TabButton>
        ) : null}
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
        {isOwner ? (
          <TabButton active={tab === 'golive'} onClick={() => setTab('golive')}>
            Go-live
          </TabButton>
        ) : null}
      </div>
      {tab === 'branches' && isOwner ? <BranchesPanel queryClient={queryClient} /> : null}
      {tab === 'tax' ? <TaxRatesPanel queryClient={queryClient} /> : null}
      {tab === 'categories' ? <CategoriesPanel queryClient={queryClient} /> : null}
      {tab === 'loyalty' && isOwner ? <LoyaltySettingsPanel queryClient={queryClient} /> : null}
      {tab === 'golive' && isOwner ? <GoLivePanel queryClient={queryClient} /> : null}
    </section>
  )
}

function BranchesPanel({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { refreshBranches } = useAuth()
  const branchesQuery = useQuery({
    queryKey: ['branches_admin'],
    queryFn: () => fetchBranches(true),
  })
  const [editing, setEditing] = useState<Branch | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [zaad, setZaad] = useState('')
  const [edahab, setEdahab] = useState('')
  const [mycash, setMycash] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setAddress('')
    setPhone('')
    setTaxId('')
    setZaad('')
    setEdahab('')
    setMycash('')
    setEditing(null)
    setCreating(false)
  }

  function openCreate() {
    resetForm()
    setError(null)
    setInfo(null)
    setCreating(true)
  }

  function openEdit(branch: Branch) {
    setCreating(false)
    setEditing(branch)
    setName(branch.name)
    setAddress(branch.address ?? '')
    setPhone(branch.phone ?? '')
    setTaxId(branch.tax_id ?? '')
    setZaad(branch.zaad ?? '')
    setEdahab(branch.edahab ?? '')
    setMycash(branch.mycash ?? '')
    setError(null)
    setInfo(null)
  }

  async function afterChange(message?: string) {
    await queryClient.invalidateQueries({ queryKey: ['branches_admin'] })
    await refreshBranches()
    if (message) setInfo(message)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Branch name is required.')
      const payload = {
        name,
        address,
        phone,
        tax_id: taxId,
        zaad,
        edahab,
        mycash,
      }
      if (editing) return updateBranch(editing.id, payload)
      return createBranch(payload)
    },
    onSuccess: async () => {
      setError(null)
      resetForm()
      await afterChange(editing ? 'Branch updated.' : 'Branch created.')
    },
    onError: (err: Error) => {
      setInfo(null)
      setError(err.message)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setBranchActive(id, active),
    onSuccess: async (_row, vars) => {
      setError(null)
      await afterChange(vars.active ? 'Branch reactivated.' : 'Branch deactivated.')
    },
    onError: (err: Error) => {
      setInfo(null)
      setError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: async (result) => {
      setError(null)
      if (editing?.id === result.id) resetForm()
      await afterChange(result.message)
    },
    onError: (err: Error) => {
      setInfo(null)
      setError(err.message)
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate()
  }

  const rows = branchesQuery.data ?? []
  const formOpen = creating || editing != null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">Branches</h2>
          <p className="mt-1 text-xs text-muted">
            Owner only. Delete removes unused branches; branches with data are deactivated instead.
          </p>
        </div>
        {!formOpen ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-dentaflow bg-marine px-4 py-2 text-xs font-bold text-white"
          >
            Add branch
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-status-red">{error}</p> : null}
      {info ? <p className="text-sm text-status-green">{info}</p> : null}

      {formOpen ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-dentaflow border border-line bg-surface p-4"
        >
          <h3 className="text-sm font-bold">{editing ? 'Edit branch' : 'New branch'}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold md:col-span-2">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold md:col-span-2">
              Address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+252…"
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Tax ID
              <input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Zaad
              <input
                value={zaad}
                onChange={(e) => setZaad(e.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              eDahab
              <input
                value={edahab}
                onChange={(e) => setEdahab(e.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
              />
            </label>
            <label className="block text-sm font-semibold md:col-span-2">
              MyCash
              <input
                value={mycash}
                onChange={(e) => setMycash(e.target.value)}
                placeholder="Leave blank until the clinic has an account"
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-dentaflow border border-line px-4 py-2 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-dentaflow bg-marine px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {editing ? 'Save changes' : 'Create branch'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Address</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {branchesQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-muted">
                  Loading branches…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-muted">
                  No branches yet.
                </td>
              </tr>
            ) : (
              rows.map((branch) => (
                <tr key={branch.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{branch.name}</td>
                  <td className="px-4 py-3 text-muted">{branch.address ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{branch.phone ?? '—'}</td>
                  <td className="px-4 py-3">{branch.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(branch)}
                        className="text-sm font-semibold text-flow-teal"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({ id: branch.id, active: !branch.active })
                        }
                        className="text-sm font-semibold text-flow-teal"
                      >
                        {branch.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove “${branch.name}”? Unused branches are deleted; branches with data are deactivated.`,
                            )
                          ) {
                            return
                          }
                          deleteMutation.mutate(branch.id)
                        }}
                        className="text-sm font-semibold text-status-red"
                      >
                        Delete
                      </button>
                    </div>
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

function GoLivePanel({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const statusQuery = useQuery({ queryKey: ['go_live_status'], queryFn: fetchGoLiveStatus })
  const [checklist, setChecklist] = useState<GoLiveStatus['checklist']>({})
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (statusQuery.data?.checklist) {
      setChecklist({ ...statusQuery.data.checklist })
    }
  }, [statusQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => updateGoLiveChecklist(checklist),
    onSuccess: async () => {
      setError(null)
      setInfo('Go-live checklist saved.')
      await queryClient.invalidateQueries({ queryKey: ['go_live_status'] })
    },
    onError: (err: Error) => {
      setInfo(null)
      setError(err.message)
    },
  })

  const gaps = statusQuery.data?.gaps
  const templates = statusQuery.data?.templates

  function toggle(key: keyof GoLiveStatus['checklist']) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-dentaflow border border-line bg-surface p-5 text-sm">
        <h2 className="font-display text-base font-bold">Go-live checklist</h2>
        <p className="mt-1 text-xs text-muted">
          Owner-only. Track Meta template approval, backup, role training, and quality rating. Does
          not invent VAT, loyalty, or MyCash values.
        </p>
        {error ? <p className="mt-2 text-xs text-status-red">{error}</p> : null}
        {info ? <p className="mt-2 text-xs text-status-green">{info}</p> : null}

        {statusQuery.isLoading ? (
          <p className="mt-4 text-xs text-muted">Loading…</p>
        ) : statusQuery.isError ? (
          <p className="mt-4 text-xs text-status-red">{(statusQuery.error as Error).message}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            <CheckRow
              label="Database backup confirmed"
              checked={Boolean(checklist.backup_confirmed)}
              onChange={() => toggle('backup_confirmed')}
            />
            <CheckRow
              label="Role training complete"
              checked={Boolean(checklist.roles_trained)}
              onChange={() => toggle('roles_trained')}
            />
            <CheckRow
              label="English WhatsApp templates reviewed"
              checked={Boolean(checklist.templates_reviewed)}
              onChange={() => toggle('templates_reviewed')}
            />
            <CheckRow
              label="WhatsApp quality rating watched"
              checked={Boolean(checklist.quality_rating_watched)}
              onChange={() => toggle('quality_rating_watched')}
            />
          </ul>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saveMutation.isPending || statusQuery.isLoading}
            onClick={() => saveMutation.mutate()}
            className="rounded-dentaflow bg-marine px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            Save checklist
          </button>
        </div>
      </div>

      {gaps ? (
        <div className="rounded-dentaflow border border-line bg-surface p-5 text-sm">
          <h3 className="font-bold">Open configuration gaps</h3>
          <p className="mt-1 text-xs text-muted">Fill these in Settings or documents when ready.</p>
          <ul className="mt-3 space-y-1 text-xs">
            <GapLine ok={!gaps.vat_percent_blank} label="VAT percentage" />
            <GapLine ok={!gaps.loyalty_earn_blank} label="Loyalty earn rate" />
            <GapLine ok={!gaps.loyalty_redeem_blank} label="Loyalty redeem value" />
            <GapLine ok={!gaps.mycash_pending} label="MyCash account number" />
          </ul>
        </div>
      ) : null}

      {templates ? (
        <div className="rounded-dentaflow border border-line bg-surface p-5 text-sm">
          <h3 className="font-bold">Message templates</h3>
          <p className="mt-1 text-xs text-muted">
            Counts from message templates. Meta approval is a human step outside this app.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Utility draft" value={templates.utility_draft} />
            <Stat label="Utility approved" value={templates.utility_approved} />
            <Stat label="Marketing draft" value={templates.marketing_draft} />
            <Stat label="Marketing approved" value={templates.marketing_approved} />
          </dl>
          <p className="mt-3 font-mono text-[11px] text-muted">
            English templates · {templates.by_language.en}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-line accent-[#12A6A0]"
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}

function GapLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? 'text-status-green' : 'text-status-amber'}>
      {ok ? 'Set' : 'Still blank'} — {label}
    </li>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-canvas px-3 py-2">
      <dt className="text-[10px] uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-base font-extrabold">{value}</dd>
    </div>
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
