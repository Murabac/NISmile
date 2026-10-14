import { supabase } from '../supabase.ts'
import type {
  MessageTemplate,
  NotificationLogItem,
  NotificationQueueItem,
  WhatsAppLanguage,
} from './types.ts'

export type SendWhatsAppResult = {
  ok: boolean
  processed: number
  results: Array<{
    queue_id: string
    ok: boolean
    provider_message_id?: string
    mode?: string
    error?: string
  }>
  error?: string
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  return []
}

export async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  const { data, error } = await supabase
    .from('message_templates')
    .select(
      'id, kind, language, name, category, body_text, variables, whatsapp_template_id, status, updated_at',
    )
    .order('kind')
    .order('language')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    variables: asStringArray(row.variables),
  })) as MessageTemplate[]
}

export async function fetchNotificationQueue(
  branchId: string,
): Promise<NotificationQueueItem[]> {
  const { data, error } = await supabase
    .from('notification_queue')
    .select(
      `
      id, branch_id, customer_id, phone, language, template_id, kind,
      params, scheduled_at, status, attempts, last_error, related_type, related_id,
      created_at, sent_at,
      customers ( name ),
      message_templates ( name )
    `,
    )
    .eq('branch_id', branchId)
    .order('scheduled_at', { ascending: false })
    .limit(100)
  if (error) throw error

  return (data ?? []).map((row) => {
    const customer = row.customers as { name: string } | null
    const template = row.message_templates as { name: string } | null
    return {
      id: row.id as string,
      branch_id: row.branch_id as string,
      customer_id: (row.customer_id as string | null) ?? null,
      phone: row.phone as string,
      language: row.language as WhatsAppLanguage,
      template_id: row.template_id as string,
      kind: row.kind as string,
      params: (row.params as Record<string, unknown>) ?? {},
      scheduled_at: row.scheduled_at as string,
      status: row.status as NotificationQueueItem['status'],
      attempts: Number(row.attempts),
      last_error: (row.last_error as string | null) ?? null,
      related_type: (row.related_type as string | null) ?? null,
      related_id: (row.related_id as string | null) ?? null,
      created_at: row.created_at as string,
      sent_at: (row.sent_at as string | null) ?? null,
      customer_name: customer?.name ?? null,
      template_name: template?.name ?? null,
    }
  })
}

export async function fetchNotificationLog(
  branchId: string,
): Promise<NotificationLogItem[]> {
  const { data, error } = await supabase
    .from('notification_log')
    .select(
      `id, queue_id, branch_id, direction, phone, language, kind, status,
       body_preview, provider_message_id, error_message, created_at`,
    )
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as NotificationLogItem[]
}

export async function enqueueNotification(input: {
  branchId: string
  kind: string
  phone?: string | null
  language?: WhatsAppLanguage | null
  customerId?: string | null
  params?: Record<string, unknown>
  scheduledAt?: string | null
  relatedType?: string | null
  relatedId?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('enqueue_notification', {
    p_branch_id: input.branchId,
    p_kind: input.kind,
    p_phone: input.phone ?? null,
    p_language: input.language ?? null,
    p_customer_id: input.customerId ?? null,
    p_params: input.params ?? {},
    p_scheduled_at: input.scheduledAt ?? null,
    p_related_type: input.relatedType ?? null,
    p_related_id: input.relatedId ?? null,
  })
  if (error) throw error
  return data as string
}

export async function cancelQueuedNotification(queueId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_queued_notification', {
    p_queue_id: queueId,
  })
  if (error) throw error
}

export async function simulateWhatsAppDelivery(
  queueId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed' = 'delivered',
): Promise<string> {
  const { data, error } = await supabase.rpc('simulate_whatsapp_delivery', {
    p_queue_id: queueId,
    p_status: status,
  })
  if (error) throw error
  return data as string
}

export async function simulateWhatsAppInbound(
  phone: string,
  body: string,
): Promise<{ action?: string; appointment_id?: string | null }> {
  const { data, error } = await supabase.rpc('simulate_whatsapp_inbound', {
    p_phone: phone,
    p_body: body,
  })
  if (error) throw error
  return (data ?? {}) as { action?: string; appointment_id?: string | null }
}

/** Invoke Edge Function send-whatsapp (Meta Cloud API via test or production number). */
export async function processWhatsAppQueue(input?: {
  limit?: number
  queueId?: string
}): Promise<SendWhatsAppResult> {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: {
      limit: input?.limit ?? 10,
      queue_id: input?.queueId ?? null,
    },
  })
  if (error) throw error
  const result = (data ?? {}) as SendWhatsAppResult
  if (result.error && !result.ok) {
    throw new Error(result.error)
  }
  return result
}

/** Replace {{1}} … placeholders for preview. */
export function renderTemplatePreview(
  body: string,
  params: Record<string, unknown>,
): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, num: string) => {
    const key = num
    const named = params[key]
    if (named != null) return String(named)
    return `{{${num}}}`
  })
}
