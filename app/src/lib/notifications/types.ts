export type MessageCategory = 'utility' | 'marketing'
export type TemplateApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
export type LogDirection = 'outbound' | 'inbound'
export type LogStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied'
export type WhatsAppLanguage = 'so' | 'ar' | 'en'

export type MessageTemplate = {
  id: string
  kind: string
  language: WhatsAppLanguage
  name: string
  category: MessageCategory
  body_text: string
  variables: string[]
  whatsapp_template_id: string | null
  status: TemplateApprovalStatus
  updated_at: string
}

export type NotificationQueueItem = {
  id: string
  branch_id: string
  customer_id: string | null
  phone: string
  language: WhatsAppLanguage
  template_id: string
  kind: string
  params: Record<string, unknown>
  scheduled_at: string
  status: QueueStatus
  attempts: number
  last_error: string | null
  related_type: string | null
  related_id: string | null
  created_at: string
  sent_at: string | null
  customer_name?: string | null
  template_name?: string | null
}

export type NotificationLogItem = {
  id: string
  queue_id: string | null
  branch_id: string | null
  direction: LogDirection
  phone: string
  language: WhatsAppLanguage | null
  kind: string | null
  status: LogStatus
  body_preview: string | null
  provider_message_id: string | null
  error_message: string | null
  created_at: string
}

export const KIND_LABELS: Record<string, string> = {
  appointment_confirmation: 'Appointment confirmation',
  appointment_reminder_24h: 'Reminder (24h)',
  appointment_reminder_2h: 'Reminder (2h)',
  appointment_reschedule: 'Reschedule notice',
  appointment_cancel: 'Cancel notice',
  receipt_notice: 'Receipt notice',
  invoice_notice: 'Invoice notice',
  promotion_announcement: 'Promotion announcement',
  promotion_ending_soon: 'Promotion ending soon',
}

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Cancelled',
}
