export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'

export type CampaignKind = 'promotion_announcement' | 'promotion_ending_soon'

export type Campaign = {
  id: string
  name: string
  promotion_id: string | null
  kind: CampaignKind
  status: CampaignStatus
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  target_count: number
  enqueued_count: number
  skipped_count: number
  created_at: string
  promo_code?: string | null
  promo_name?: string | null
  stats?: CampaignStats
}

export type CampaignStats = {
  target_count: number
  enqueued_count: number
  skipped_count: number
  pending: number
  sent: number
  failed: number
  delivered: number
  read: number
}

export type AudienceMember = {
  customer_id: string
  branch_id: string
  name: string
  phone: string
  language: 'en'
  customer_type: string
  subtype: string | null
}

export const CAMPAIGN_KIND_LABELS: Record<CampaignKind, string> = {
  promotion_announcement: 'Promotion announcement',
  promotion_ending_soon: 'Promotion ending soon',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
}
