import { supabase } from '../supabase.ts'
import type {
  AudienceMember,
  Campaign,
  CampaignKind,
  CampaignStats,
} from './types.ts'

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      'id, name, promotion_id, kind, status, scheduled_at, started_at, completed_at, target_count, enqueued_count, skipped_count, created_at, promotions ( code, name )',
    )
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<
    Campaign & { promotions?: { code: string; name: string } | null }
  >

  return Promise.all(
    rows.map(async (row) => {
      let stats: CampaignStats | undefined
      const { data: raw } = await supabase.rpc('campaign_stats', {
        p_campaign_id: row.id,
      })
      if (raw) stats = raw as CampaignStats
      return {
        id: row.id,
        name: row.name,
        promotion_id: row.promotion_id,
        kind: row.kind,
        status: row.status,
        scheduled_at: row.scheduled_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        target_count: row.target_count,
        enqueued_count: row.enqueued_count,
        skipped_count: row.skipped_count,
        created_at: row.created_at,
        promo_code: row.promotions?.code ?? null,
        promo_name: row.promotions?.name ?? null,
        stats,
      }
    }),
  )
}

export async function listPromotionAudience(promotionId: string): Promise<AudienceMember[]> {
  const { data, error } = await supabase.rpc('list_promotion_audience', {
    p_promotion_id: promotionId,
  })
  if (error) throw error
  return (data ?? []) as AudienceMember[]
}

export async function enqueuePromotionCampaign(input: {
  promotionId: string
  kind?: CampaignKind
  scheduledAt?: string | null
  name?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('enqueue_promotion_campaign', {
    p_promotion_id: input.promotionId,
    p_kind: input.kind ?? 'promotion_announcement',
    p_scheduled_at: input.scheduledAt ?? null,
    p_name: input.name ?? null,
  })
  if (error) throw error
  return data as string
}

export async function cancelCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_campaign', {
    p_campaign_id: campaignId,
  })
  if (error) throw error
}
