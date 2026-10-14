import { supabase } from '../supabase.ts'
import type {
  DashboardSummary,
  GoLiveStatus,
  ReportPeriod,
  ReportResult,
  ReportType,
} from './types.ts'

export async function runReport(input: {
  type: ReportType
  branchId: string | 'all'
  period: ReportPeriod
}): Promise<ReportResult> {
  const { data, error } = await supabase.rpc('run_report', {
    p_report_type: input.type,
    p_branch_id: input.branchId === 'all' ? null : input.branchId,
    p_period: input.period,
  })
  if (error) throw error
  return data as ReportResult
}

export async function fetchDashboardSummary(
  branchId: string | 'all',
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('dashboard_summary', {
    p_branch_id: branchId === 'all' ? null : branchId,
  })
  if (error) throw error
  const row = data as DashboardSummary
  return {
    sales_today: {
      count: Number(row.sales_today?.count ?? 0),
      total: Number(row.sales_today?.total ?? 0),
      paid: Number(row.sales_today?.paid ?? 0),
    },
    appointments_today: {
      count: Number(row.appointments_today?.count ?? 0),
      scheduled: Number(row.appointments_today?.scheduled ?? 0),
      confirmed: Number(row.appointments_today?.confirmed ?? 0),
      completed: Number(row.appointments_today?.completed ?? 0),
      cancelled: Number(row.appointments_today?.cancelled ?? 0),
    },
    appointments_list: row.appointments_list ?? [],
    debts: {
      open_invoices: Number(row.debts?.open_invoices ?? 0),
      ar_balance: Number(row.debts?.ar_balance ?? 0),
      overdue: Number(row.debts?.overdue ?? 0),
    },
    debt_rows: (row.debt_rows ?? []).map((d) => ({
      ...d,
      balance: Number(d.balance),
    })),
  }
}

export async function fetchGoLiveStatus(): Promise<GoLiveStatus> {
  const { data, error } = await supabase.rpc('go_live_status')
  if (error) throw error
  return data as GoLiveStatus
}

export async function updateGoLiveChecklist(
  checklist: GoLiveStatus['checklist'],
): Promise<void> {
  const { error } = await supabase.rpc('update_go_live_checklist', {
    p_checklist: checklist,
  })
  if (error) throw error
}
