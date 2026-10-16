import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, X } from 'lucide-react'
import { useAuth } from '../lib/auth.tsx'
import { cancelCampaign, fetchCampaigns } from '../lib/campaigns/api.ts'
import {
  CAMPAIGN_KIND_LABELS,
  CAMPAIGN_STATUS_LABELS,
  type CampaignKind,
  type CampaignStatus,
} from '../lib/campaigns/types.ts'
import {
  cancelQueuedNotification,
  fetchMessageTemplates,
  fetchNotificationLog,
  fetchNotificationQueue,
  processWhatsAppQueue,
  renderTemplatePreview,
  simulateWhatsAppDelivery,
  simulateWhatsAppInbound,
} from '../lib/notifications/api.ts'
import {
  KIND_LABELS,
  QUEUE_STATUS_LABELS,
  type MessageTemplate,
  type QueueStatus,
} from '../lib/notifications/types.ts'

type Tab = 'templates' | 'campaigns' | 'queue' | 'log'

function statusClass(status: string) {
  if (status === 'approved' || status === 'sent' || status === 'delivered' || status === 'read') {
    return 'bg-status-green/15 text-status-green'
  }
  if (status === 'pending' || status === 'queued' || status === 'draft' || status === 'processing') {
    return 'bg-status-amber/15 text-status-amber'
  }
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') {
    return 'bg-status-red/15 text-status-red'
  }
  if (status === 'replied') return 'bg-flow-teal/15 text-flow-teal'
  return 'bg-muted/20 text-muted'
}

export function WhatsAppPage() {
  const { branchId, profile } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('templates')
  const [preview, setPreview] = useState<MessageTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['message_templates'],
    queryFn: fetchMessageTemplates,
  })

  const queueQuery = useQuery({
    queryKey: ['notification_queue', branchId],
    queryFn: () => fetchNotificationQueue(branchId),
    enabled: branchId !== 'all',
  })

  const logQuery = useQuery({
    queryKey: ['notification_log', branchId],
    queryFn: () => fetchNotificationLog(branchId),
    enabled: branchId !== 'all',
  })

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelQueuedNotification(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_log'] })
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const deliverMutation = useMutation({
    mutationFn: (id: string) => simulateWhatsAppDelivery(id, 'delivered'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_log'] })
      setInfo('Simulated delivery status written to the log.')
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const replyMutation = useMutation({
    mutationFn: ({ phone, body }: { phone: string; body: string }) =>
      simulateWhatsAppInbound(phone, body),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_log'] })
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      const action = result.action ?? 'ignored'
      setInfo(
        action === 'confirm'
          ? 'Reply 1 applied — appointment confirmed.'
          : action === 'cancel'
            ? 'Reply 2 applied — appointment cancelled.'
            : action === 'opt_out'
              ? 'Opt-out applied — WhatsApp consent cleared.'
              : `Inbound logged (action: ${action}).`,
      )
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const sendMutation = useMutation({
    mutationFn: (input?: { queueId?: string }) =>
      processWhatsAppQueue({ limit: 20, queueId: input?.queueId }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_log'] })
      const ok = result.results?.filter((r) => r.ok).length ?? 0
      const fail = result.results?.filter((r) => !r.ok).length ?? 0
      const firstErr = result.results?.find((r) => !r.ok)?.error
      setInfo(
        result.processed === 0
          ? 'No due queue items to send.'
          : `Cloud API: ${ok} sent, ${fail} failed.` +
              (firstErr ? ` First error: ${firstErr}` : ''),
      )
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const cancelCampaignMutation = useMutation({
    mutationFn: cancelCampaign,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      setInfo('Campaign cancelled; pending queue rows cancelled.')
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const templates = templatesQuery.data ?? []
  const kinds = useMemo(() => {
    const map = new Map<string, MessageTemplate[]>()
    for (const tpl of templates.filter((row) => row.language === 'en')) {
      const list = map.get(tpl.kind) ?? []
      list.push(tpl)
      map.set(tpl.kind, list)
    }
    return [...map.entries()]
  }, [templates])

  const queue = queueQuery.data ?? []
  const logs = logQuery.data ?? []
  const campaigns = campaignsQuery.data ?? []

  if (branchId === 'all' && tab !== 'templates' && tab !== 'campaigns') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">WhatsApp</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header to view the queue and delivery log. Templates and
          campaigns are shared — switch to those tabs or pick a branch.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('templates')}
            className="rounded-dentaflow border border-line px-3 py-2 text-xs font-bold"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className="rounded-dentaflow border border-line px-3 py-2 text-xs font-bold"
          >
            Campaigns
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-3xl font-semibold">WhatsApp</h1>
          <p className="mt-1 text-sm text-muted">
            Queue, Cloud API send (test number), and webhook delivery / reply 1·2 / opt-out. Swap
            Edge secrets to the production number later — app code stays the same.
          </p>
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <div className="rounded-dentaflow border border-line bg-canvas px-3 py-2 text-xs">
            <p className="flex items-center gap-2 font-semibold">
              <span className="h-2 w-2 shrink-0 rounded-full bg-status-green" />
              Send + webhook ready
            </p>
            <p className="mt-1 text-muted">
              Add the recipient on Meta Step 1 (test allowlist). Secrets:
              <span className="font-mono"> WHATSAPP_ACCESS_TOKEN </span>+
              <span className="font-mono"> WHATSAPP_PHONE_NUMBER_ID</span>.
            </p>
          </div>
          {tab === 'queue' ? (
            <button
              type="button"
              disabled={sendMutation.isPending}
              onClick={() => sendMutation.mutate(undefined)}
              className="rounded-dentaflow bg-marine px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {sendMutation.isPending ? 'Sending…' : 'Process due (Cloud API)'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['templates', `Templates (${templates.length})`],
            ['campaigns', `Campaigns (${campaigns.length})`],
            ['queue', `Queue (${branchId === 'all' ? '—' : queue.length})`],
            ['log', `Log (${branchId === 'all' ? '—' : logs.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            disabled={(id === 'queue' || id === 'log') && branchId === 'all'}
            className={`rounded-dentaflow px-4 py-2 text-xs font-bold disabled:opacity-40 ${
              tab === id
                ? 'bg-marine text-white'
                : 'border border-line bg-surface text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-status-red">{error}</p> : null}
      {info ? <p className="text-sm text-flow-teal">{info}</p> : null}

      {tab === 'campaigns' ? (
        campaignsQuery.isLoading ? (
          <p className="text-sm text-muted">Loading campaigns…</p>
        ) : campaignsQuery.isError ? (
          <p className="text-sm text-status-red">{(campaignsQuery.error as Error).message}</p>
        ) : campaigns.length === 0 ? (
          <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
            No campaigns yet. On Promotions, use Preview & enqueue for an opt-in English WhatsApp
            blast.
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((cmp) => {
              const stats = cmp.stats
              const sent = stats?.sent ?? cmp.enqueued_count
              const read = stats?.read ?? 0
              return (
                <div
                  key={cmp.id}
                  className="space-y-3 rounded-dentaflow border border-line bg-surface p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">{cmp.name}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {CAMPAIGN_KIND_LABELS[cmp.kind as CampaignKind] ?? cmp.kind}
                        {cmp.promo_code ? ` · ${cmp.promo_code}` : ''}
                        {cmp.promo_name ? ` — ${cmp.promo_name}` : ''}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(cmp.status)}`}
                    >
                      {CAMPAIGN_STATUS_LABELS[cmp.status as CampaignStatus] ?? cmp.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-[8px] bg-canvas p-3 text-center text-xs sm:grid-cols-4">
                    <div>
                      <span className="block text-[10px] text-muted">Target</span>
                      <span className="font-mono text-sm font-bold">{cmp.target_count}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted">Enqueued</span>
                      <span className="font-mono text-sm font-bold">{cmp.enqueued_count}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted">Delivered</span>
                      <span className="font-mono text-sm font-bold text-status-green">
                        {stats?.delivered ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted">Read rate</span>
                      <span className="font-mono text-sm font-bold text-flow-teal">
                        {sent > 0 ? `${Math.round((read / sent) * 100)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                  {(cmp.status === 'scheduled' || cmp.status === 'sending' || cmp.status === 'draft') &&
                  profile?.role === 'owner' ? (
                    <button
                      type="button"
                      className="text-[10px] font-bold text-status-red"
                      disabled={cancelCampaignMutation.isPending}
                      onClick={() => cancelCampaignMutation.mutate(cmp.id)}
                    >
                      Cancel pending
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      ) : null}

      {tab === 'templates' ? (
        templatesQuery.isLoading ? (
          <p className="text-sm text-muted">Loading templates…</p>
        ) : templatesQuery.isError ? (
          <p className="text-sm text-status-red">{(templatesQuery.error as Error).message}</p>
        ) : kinds.length === 0 ? (
          <p className="text-sm text-muted">No templates yet. Apply the notification seed.</p>
        ) : (
          <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-[10px] tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Meta status</th>
                  <th className="px-4 py-3 text-end font-semibold">Preview</th>
                </tr>
              </thead>
              <tbody>
                {kinds.map(([kind, rows]) => {
                  const en =
                    rows.find((r) => r.language === 'en') ?? rows[0] ?? null
                  return (
                    <tr key={kind} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{KIND_LABELS[kind] ?? kind}</p>
                        <p className="font-mono text-[11px] text-muted">{kind}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-xs text-muted">
                        {en?.category}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(en?.status ?? 'draft')}`}
                        >
                          {en?.status}
                        </span>
                        {!en?.whatsapp_template_id ? (
                          <p className="mt-1 text-[10px] text-muted">No Meta template id yet</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {en ? (
                          <button
                            type="button"
                            onClick={() => setPreview(en)}
                            className="rounded-md border border-line px-2 py-1 text-[10px] font-bold"
                          >
                            Preview
                          </button>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'queue' ? (
        queueQuery.isLoading ? (
          <p className="text-sm text-muted">Loading queue…</p>
        ) : queueQuery.isError ? (
          <p className="text-sm text-status-red">{(queueQuery.error as Error).message}</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted">Queue is empty for this branch.</p>
        ) : (
          <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-[10px] tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Scheduled</th>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-end font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      {new Date(item.scheduled_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{item.customer_name ?? '—'}</p>
                      <p className="font-mono text-[11px] text-muted">{item.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {KIND_LABELS[item.kind] ?? item.kind}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(item.status)}`}
                      >
                        {QUEUE_STATUS_LABELS[item.status as QueueStatus] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.status === 'pending' || item.status === 'failed' ? (
                          <>
                            <button
                              type="button"
                              disabled={sendMutation.isPending}
                              onClick={() => sendMutation.mutate({ queueId: item.id })}
                              className="text-xs font-semibold text-marine"
                            >
                              Send via Meta
                            </button>
                            <button
                              type="button"
                              disabled={deliverMutation.isPending}
                              onClick={() => deliverMutation.mutate(item.id)}
                              className="text-xs font-semibold text-flow-teal"
                            >
                              Simulate delivered
                            </button>
                            <button
                              type="button"
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(item.id)}
                              className="text-xs font-semibold text-status-red"
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                        {item.related_type === 'appointment' &&
                        (item.status === 'pending' || item.status === 'sent') ? (
                          <>
                            <button
                              type="button"
                              disabled={replyMutation.isPending}
                              onClick={() =>
                                replyMutation.mutate({ phone: item.phone, body: '1' })
                              }
                              className="text-xs font-semibold"
                            >
                              Reply 1
                            </button>
                            <button
                              type="button"
                              disabled={replyMutation.isPending}
                              onClick={() =>
                                replyMutation.mutate({ phone: item.phone, body: '2' })
                              }
                              className="text-xs font-semibold"
                            >
                              Reply 2
                            </button>
                            <button
                              type="button"
                              disabled={replyMutation.isPending}
                              onClick={() =>
                                replyMutation.mutate({ phone: item.phone, body: 'STOP' })
                              }
                              className="text-xs font-semibold text-muted"
                            >
                              Opt-out
                            </button>
                          </>
                        ) : null}
                        {item.status !== 'pending' &&
                        item.status !== 'failed' &&
                        item.related_type !== 'appointment' ? (
                          <span className="text-xs text-muted">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'log' ? (
        logQuery.isLoading ? (
          <p className="text-sm text-muted">Loading log…</p>
        ) : logQuery.isError ? (
          <p className="text-sm text-status-red">{(logQuery.error as Error).message}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted">No log entries yet.</p>
        ) : (
          <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-[10px] tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Preview</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">{row.direction}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.phone}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.kind ? KIND_LABELS[row.kind] ?? row.kind : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-muted">
                      {row.body_preview ?? row.error_message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-dentaflow border border-line bg-surface p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold">
                  <MessageSquare className="h-4 w-4 text-flow-teal" />
                  {preview.name}
                </p>
                <p className="text-[11px] text-muted">
                  English · draft body (Meta id not set)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-dentaflow border border-line bg-canvas p-3 text-xs leading-relaxed text-main">
              {renderTemplatePreview(preview.body_text, {
                '1': 'Ayaan Abdi',
                '2': 'N.I SMILE',
                '3': '2026-10-15',
                '4': '10:30',
                '5': 'Demo Dentist',
              })}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  )
}
