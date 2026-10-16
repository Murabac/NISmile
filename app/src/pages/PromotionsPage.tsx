import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Share2, Users } from 'lucide-react'
import { Modal } from '../components/Modal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { fetchItems, fetchServices } from '../lib/catalog/api.ts'
import {
  enqueuePromotionCampaign,
  listPromotionAudience,
} from '../lib/campaigns/api.ts'
import type { AudienceMember, CampaignKind } from '../lib/campaigns/types.ts'
import { fetchClinicSettings, updateClinicSettings } from '../lib/loyalty/api.ts'
import {
  createPromotion,
  fetchPromotions,
  publishPromotion,
  setPromotionStatus,
} from '../lib/promotions/api.ts'
import {
  AUDIENCE_LABELS,
  PROMO_TYPE_LABELS,
  type PromotionAudience,
  type PromotionScope,
  type PromotionType,
} from '../lib/promotions/types.ts'
import { formatMoney } from '../lib/money.ts'

type Tab = 'promos' | 'loyalty'

const defaultMsgEn =
  'Exclusive offer from N.I SMILE Oral care & Teeth whitening. Ask staff for details.'

function statusClass(status: string) {
  if (status === 'active') return 'bg-status-green/15 text-status-green'
  if (status === 'scheduled' || status === 'draft') return 'bg-status-amber/15 text-status-amber'
  if (status === 'paused' || status === 'ended') return 'bg-status-red/15 text-status-red'
  return 'bg-muted/20 text-muted'
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PromotionsPage() {
  const { profile, branches } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('promos')
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [audiencePromoId, setAudiencePromoId] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<AudienceMember[]>([])
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [enqueueKind, setEnqueueKind] = useState<CampaignKind>('promotion_announcement')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promoType, setPromoType] = useState<PromotionType>('buy_x_get_y')
  const [audience, setAudience] = useState<PromotionAudience>('wholesale')
  const [wholesaleSubtype, setWholesaleSubtype] = useState('pharmacy')
  const [scope, setScope] = useState<PromotionScope>('items')
  const [percentOff, setPercentOff] = useState('15')
  const [amountOff, setAmountOff] = useState('7')
  const [buyQty, setBuyQty] = useState('10')
  const [getQty, setGetQty] = useState('1')
  const [bundlePrice, setBundlePrice] = useState('50')
  const [spendMin, setSpendMin] = useState('100')
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date()))
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return toLocalInputValue(d)
  })
  const [allBranches, setAllBranches] = useState(true)
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [itemId, setItemId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true)
  const [msgEn, setMsgEn] = useState(defaultMsgEn)
  const [publishOnCreate, setPublishOnCreate] = useState(true)

  const isOwner = profile?.role === 'owner'

  const promosQuery = useQuery({
    queryKey: ['promotions'],
    queryFn: fetchPromotions,
    enabled: isOwner,
  })
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: fetchItems, enabled: createOpen })
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    enabled: createOpen,
  })

  const promos = promosQuery.data ?? []
  const items = (itemsQuery.data ?? []).filter((i) => i.active)
  const services = (servicesQuery.data ?? []).filter((s) => s.active)

  const createMutation = useMutation({
    mutationFn: createPromotion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promotions'] })
      setCreateOpen(false)
      setError(null)
      setName('')
    },
    onError: (err: Error) => setError(err.message),
  })

  const publishMutation = useMutation({
    mutationFn: publishPromotion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promotions'] })
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paused' | 'ended' | 'draft' }) =>
      setPromotionStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['promotions'] })
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const enqueueMutation = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: CampaignKind }) =>
      enqueuePromotionCampaign({ promotionId: id, kind }),
    onSuccess: async (campaignId) => {
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      setInfo(`Campaign queued (${campaignId.slice(0, 8)}…). Process due on WhatsApp to send.`)
      setError(null)
      setAudiencePromoId(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  async function openAudience(promoId: string) {
    setAudiencePromoId(promoId)
    setAudienceLoading(true)
    setError(null)
    try {
      const rows = await listPromotionAudience(promoId)
      setRecipients(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audience')
      setRecipients([])
    } finally {
      setAudienceLoading(false)
    }
  }

  if (!isOwner) {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold text-[#FF6B57]">Promotions</h1>
        <p className="mt-3 max-w-xl text-muted">Only the owner can create and publish promotions.</p>
      </section>
    )
  }

  function submitCreate() {
    if (!name.trim()) {
      setError('Promotion title is required.')
      return
    }
    const startIso = new Date(startsAt).toISOString()
    const endIso = new Date(endsAt).toISOString()
    if (!(new Date(endIso) > new Date(startIso))) {
      setError('End date must be after start date.')
      return
    }

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      promo_type: promoType,
      audience,
      wholesale_subtype: audience === 'wholesale_subtype' ? wholesaleSubtype : null,
      scope,
      percent_off:
        promoType === 'percentage' || promoType === 'spend_threshold'
          ? Number(percentOff) || null
          : null,
      amount_off:
        promoType === 'fixed_amount' || promoType === 'spend_threshold'
          ? Number(amountOff) || null
          : null,
      buy_qty: promoType === 'buy_x_get_y' ? Number(buyQty) || null : null,
      get_qty: promoType === 'buy_x_get_y' ? Number(getQty) || null : null,
      bundle_price: promoType === 'bundle' ? Number(bundlePrice) || null : null,
      spend_min: promoType === 'spend_threshold' ? Number(spendMin) || null : null,
      starts_at: startIso,
      ends_at: endIso,
      notify_whatsapp: notifyWhatsApp,
      whatsapp_message_en: notifyWhatsApp ? msgEn : null,
      whatsapp_message_so: null,
      whatsapp_message_ar: null,
      branch_ids: allBranches ? [] : branchIds,
      item_ids: scope === 'items' && itemId ? [itemId] : [],
      service_ids: scope === 'services' ? serviceIds : [],
      publish: publishOnCreate,
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-marine dark:text-[#E8F2F0]">
            Promotions
          </h1>
          <p className="text-xs text-muted">
            Automatic discounts at checkout. Best single promotion wins. Coral is for promotions only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-dentaflow bg-[#FF6B57] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#FF7A66]"
        >
          <Plus className="h-4 w-4" />
          Create Promotion
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('promos')}
          className={`rounded-[8px] px-4 py-2 text-xs font-bold transition-colors ${
            tab === 'promos'
              ? 'bg-marine text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'border border-line bg-surface text-muted'
          }`}
        >
          Active Promotions ({promos.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('loyalty')}
          className={`rounded-[8px] px-4 py-2 text-xs font-bold transition-colors ${
            tab === 'loyalty'
              ? 'bg-marine text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'border border-line bg-surface text-muted'
          }`}
        >
          Loyalty Program Rules
        </button>
      </div>

      {error ? (
        <p className="rounded-dentaflow border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-dentaflow border border-flow-teal/30 bg-flow-teal/10 px-3 py-2 text-xs text-flow-teal">
          {info}
        </p>
      ) : null}

      {tab === 'promos' ? (
        promosQuery.isLoading ? (
          <p className="text-sm text-muted">Loading promotions…</p>
        ) : promos.length === 0 ? (
          <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
            No promotions yet. Create one to apply automatic discounts at POS.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="relative flex flex-col justify-between space-y-4 overflow-hidden rounded-dentaflow border border-[#FF6B57]/30 bg-surface p-5 shadow-xs"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[#FF6B57]" />
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="rounded bg-[#FF6B57]/10 px-2 py-0.5 font-mono font-bold text-[#FF6B57]">
                      {promo.code}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(promo.status)}`}
                    >
                      {promo.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm leading-snug font-bold text-marine dark:text-[#E8F2F0]">
                    {promo.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted">{promo.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                    <Users className="h-3.5 w-3.5 text-flow-teal" />
                    <span>
                      {AUDIENCE_LABELS[promo.audience]}
                      {promo.wholesale_subtype ? ` · ${promo.wholesale_subtype}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {PROMO_TYPE_LABELS[promo.promo_type]}
                    {promo.promo_type === 'percentage' && promo.percent_off != null
                      ? ` · ${promo.percent_off}%`
                      : ''}
                    {promo.promo_type === 'fixed_amount' && promo.amount_off != null
                      ? ` · ${formatMoney(promo.amount_off)} off`
                      : ''}
                    {promo.promo_type === 'buy_x_get_y'
                      ? ` · Buy ${promo.buy_qty} get ${promo.get_qty}`
                      : ''}
                  </p>
                </div>

                <div className="space-y-2 border-t border-line pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Redemptions</span>
                    <span className="font-mono font-bold">{promo.redemptions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Discount given</span>
                    <span className="font-mono font-bold text-flow-teal">
                      {formatMoney(promo.revenue_generated)}
                    </span>
                  </div>
                  {promo.notify_whatsapp ? (
                    <div className="flex items-center justify-between rounded bg-flow-teal/10 p-2 text-[11px] text-marine dark:text-[#2CC7BF]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Share2 className="h-3 w-3 text-flow-teal" />
                        Opt-in audience
                      </span>
                      <span className="font-mono font-bold">{promo.estimated_recipients}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {promo.status === 'draft' || promo.status === 'paused' ? (
                      <button
                        type="button"
                        className="rounded-md bg-[#FF6B57] px-2.5 py-1 text-[10px] font-bold text-white"
                        onClick={() => publishMutation.mutate(promo.id)}
                      >
                        Publish
                      </button>
                    ) : null}
                    {promo.status === 'active' || promo.status === 'scheduled' ? (
                      <button
                        type="button"
                        className="rounded-md border border-line px-2.5 py-1 text-[10px] font-bold"
                        onClick={() => statusMutation.mutate({ id: promo.id, status: 'paused' })}
                      >
                        Pause
                      </button>
                    ) : null}
                    {promo.notify_whatsapp ? (
                      <button
                        type="button"
                        className="rounded-md border border-line px-2.5 py-1 text-[10px] font-bold text-flow-teal"
                        onClick={() => openAudience(promo.id)}
                      >
                        Preview & enqueue
                      </button>
                    ) : null}
                    {promo.status !== 'ended' ? (
                      <button
                        type="button"
                        className="rounded-md border border-line px-2.5 py-1 text-[10px] font-bold text-status-red"
                        onClick={() => statusMutation.mutate({ id: promo.id, status: 'ended' })}
                      >
                        End
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <LoyaltyTab />
      )}

      <Modal
        open={audiencePromoId != null}
        onClose={() => setAudiencePromoId(null)}
        title="Campaign audience preview"
        subtitle="Opt-in customers with a phone · English WhatsApp templates"
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <select
              value={enqueueKind}
              onChange={(e) => setEnqueueKind(e.target.value as CampaignKind)}
              className="h-9 rounded-[8px] border border-line bg-canvas px-2 text-xs"
            >
              <option value="promotion_announcement">Announcement</option>
              <option value="promotion_ending_soon">Ending soon</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAudiencePromoId(null)}
                className="px-3 py-2 text-xs font-semibold text-muted"
              >
                Close
              </button>
              <button
                type="button"
                disabled={
                  !audiencePromoId ||
                  recipients.length === 0 ||
                  enqueueMutation.isPending
                }
                onClick={() =>
                  audiencePromoId &&
                  enqueueMutation.mutate({ id: audiencePromoId, kind: enqueueKind })
                }
                className="rounded-[8px] bg-[#FF6B57] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {enqueueMutation.isPending ? 'Enqueueing…' : `Enqueue ${recipients.length}`}
              </button>
            </div>
          </div>
        }
      >
        {audienceLoading ? (
          <p className="text-xs text-muted">Loading opt-in audience…</p>
        ) : recipients.length === 0 ? (
          <p className="text-xs text-muted">
            No opted-in customers with a phone match this promotion audience.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-[8px] border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-canvas text-[10px] uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Lang</th>
                  <th className="px-3 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((row) => (
                  <tr key={row.customer_id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{row.name}</td>
                    <td className="px-3 py-2 font-mono">{row.phone}</td>
                    <td className="px-3 py-2 font-mono uppercase">{row.language}</td>
                    <td className="px-3 py-2 capitalize text-muted">
                      {row.customer_type}
                      {row.subtype ? ` · ${row.subtype}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Promotional Campaign"
        subtitle="Discount formula, audience, branches, and WhatsApp announcement text"
        maxWidth="lg"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={submitCreate}
              className="rounded-[8px] bg-[#FF6B57] px-4 py-2 text-xs font-bold text-white hover:bg-[#FF7A66] disabled:opacity-60"
            >
              {publishOnCreate ? 'Launch Promotion' : 'Save Draft'}
            </button>
          </div>
        }
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-xs">
          <div>
            <label className="mb-1 block font-bold">Promotion title *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wholesale: buy 10 boxes, get 1 free"
              className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-[8px] border border-line bg-canvas px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-bold">Discount mechanism</label>
              <select
                value={promoType}
                onChange={(e) => setPromoType(e.target.value as PromotionType)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              >
                {(Object.keys(PROMO_TYPE_LABELS) as PromotionType[]).map((t) => (
                  <option key={t} value={t}>
                    {PROMO_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as PromotionAudience)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              >
                {(Object.keys(AUDIENCE_LABELS) as PromotionAudience[]).map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {audience === 'wholesale_subtype' ? (
            <div>
              <label className="mb-1 block font-bold">Wholesale subtype</label>
              <select
                value={wholesaleSubtype}
                onChange={(e) => setWholesaleSubtype(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              >
                <option value="clinic">Clinic</option>
                <option value="pharmacy">Pharmacy / shop</option>
                <option value="lab">Lab</option>
                <option value="dentist">Individual dentist</option>
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-bold">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as PromotionScope)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              >
                <option value="invoice">Whole invoice</option>
                <option value="items">Items</option>
                <option value="services">Services</option>
                <option value="categories">Item categories</option>
              </select>
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={publishOnCreate}
                  onChange={(e) => setPublishOnCreate(e.target.checked)}
                />
                Publish now (owner)
              </label>
            </div>
          </div>

          {promoType === 'buy_x_get_y' ? (
            <div className="grid grid-cols-2 gap-4 rounded-[8px] bg-[#FF6B57]/10 p-3">
              <div>
                <label className="mb-1 block font-bold text-[#C93824]">Buy qty (X)</label>
                <input
                  type="number"
                  min="1"
                  value={buyQty}
                  onChange={(e) => setBuyQty(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-line bg-surface px-3 font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-[#C93824]">Get free (Y)</label>
                <input
                  type="number"
                  min="1"
                  value={getQty}
                  onChange={(e) => setGetQty(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-line bg-surface px-3 font-mono"
                />
              </div>
            </div>
          ) : null}

          {promoType === 'percentage' ? (
            <div>
              <label className="mb-1 block font-bold">Percent off</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3 font-mono"
              />
            </div>
          ) : null}

          {promoType === 'fixed_amount' ? (
            <div>
              <label className="mb-1 block font-bold">Amount off (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3 font-mono"
              />
            </div>
          ) : null}

          {promoType === 'bundle' ? (
            <div>
              <label className="mb-1 block font-bold">Bundle price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bundlePrice}
                onChange={(e) => setBundlePrice(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3 font-mono"
              />
            </div>
          ) : null}

          {promoType === 'spend_threshold' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block font-bold">Spend at least (USD)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={spendMin}
                  onChange={(e) => setSpendMin(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3 font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Reward amount off</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountOff}
                  onChange={(e) => setAmountOff(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3 font-mono"
                />
              </div>
            </div>
          ) : null}

          {scope === 'items' ? (
            <div>
              <label className="mb-1 block font-bold">Target item (optional)</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              >
                <option value="">All items in scope</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scope === 'services' ? (
            <div>
              <label className="mb-1 block font-bold">Target services</label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-[8px] border border-line bg-canvas p-2">
                {services.map((service) => {
                  const checked = serviceIds.includes(service.id)
                  return (
                    <label key={service.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setServiceIds((current) =>
                            e.target.checked
                              ? [...current, service.id]
                              : current.filter((id) => id !== service.id),
                          )
                        }
                      />
                      <span>
                        {service.code} — {service.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-bold">Starts</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">Ends</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-line bg-canvas px-3"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-[8px] border border-line bg-canvas p-3">
            <label className="flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={allBranches}
                onChange={(e) => setAllBranches(e.target.checked)}
              />
              All branches
            </label>
            {!allBranches ? (
              <div className="space-y-1">
                {branches.map((branch) => {
                  const checked = branchIds.includes(branch.id)
                  return (
                    <label key={branch.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setBranchIds((current) =>
                            e.target.checked
                              ? [...current, branch.id]
                              : current.filter((id) => id !== branch.id),
                          )
                        }
                      />
                      {branch.name}
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-[8px] bg-canvas p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold">Notify eligible customers on WhatsApp</span>
                <p className="text-[11px] text-muted">
                  English announcement text only. Campaign enqueue uses Meta English templates.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyWhatsApp}
                onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
            {notifyWhatsApp ? (
              <div className="space-y-2 border-t border-line pt-2">
                <span className="text-[10px] font-bold uppercase text-muted">
                  English message
                </span>
                <textarea
                  value={msgEn}
                  onChange={(e) => setMsgEn(e.target.value)}
                  rows={4}
                  className="w-full rounded-[8px] border border-line bg-surface p-3 font-mono text-[11px] leading-relaxed"
                />
              </div>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  )
}

function LoyaltyTab() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['clinic_settings'], queryFn: fetchClinicSettings })
  const [earn, setEarn] = useState('')
  const [usdPerPoint, setUsdPerPoint] = useState('')
  const [minRedeem, setMinRedeem] = useState('')
  const [expireDays, setExpireDays] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      await queryClient.invalidateQueries({ queryKey: ['clinic_settings'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSave(event: FormEvent) {
    event.preventDefault()
    const earnN = earn.trim() === '' ? null : Number(earn)
    const usdN = usdPerPoint.trim() === '' ? null : Number(usdPerPoint)
    const minN = minRedeem.trim() === '' ? null : Number(minRedeem)
    const expN = expireDays.trim() === '' ? null : Number(expireDays)
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
      className="max-w-2xl space-y-4 rounded-dentaflow border border-line bg-surface p-6 text-xs shadow-xs"
    >
      <div>
        <h3 className="font-display text-base font-bold text-marine dark:text-[#E8F2F0]">
          Patient Loyalty & Points
        </h3>
        <p className="mt-0.5 text-muted">
          Rates stay blank until confirmed. Same fields as Settings → Loyalty. Earn is on paid
          amount excluding VAT; redeem applies at POS after the best promotion.
        </p>
      </div>
      {error ? <p className="text-status-red">{error}</p> : null}
      <label className="block space-y-1">
        <span className="font-bold">Earning rate (points per $1 USD spent)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={earn}
          onChange={(e) => setEarn(e.target.value)}
          placeholder="Blank until confirmed"
          className="h-10 w-40 rounded-[8px] border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-bold">Point monetary value ($USD per point)</span>
        <input
          type="number"
          min="0"
          step="0.0001"
          value={usdPerPoint}
          onChange={(e) => setUsdPerPoint(e.target.value)}
          placeholder="Blank until confirmed"
          className="h-10 w-40 rounded-[8px] border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-bold">Minimum points required for redemption</span>
        <input
          type="number"
          min="0"
          step="1"
          value={minRedeem}
          onChange={(e) => setMinRedeem(e.target.value)}
          placeholder="Blank = no minimum"
          className="h-10 w-40 rounded-[8px] border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-bold">Optional expiry (days)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={expireDays}
          onChange={(e) => setExpireDays(e.target.value)}
          placeholder="Blank = no expiry"
          className="h-10 w-40 rounded-[8px] border border-line bg-canvas px-3 font-mono"
        />
      </label>
      <div className="flex justify-end border-t border-line pt-3">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-[8px] bg-marine px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          Save Loyalty Parameters
        </button>
      </div>
    </form>
  )
}
