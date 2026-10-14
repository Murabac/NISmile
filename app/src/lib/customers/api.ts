import { supabase } from '../supabase.ts'
import type { Customer, CustomerInput } from './types.ts'

export async function fetchCustomers(branchId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      'id, branch_id, name, phone, customer_type, subtype, language, whatsapp_opt_in, credit_limit, loyalty_points, notes, created_at',
    )
    .eq('branch_id', branchId)
    .order('name')
  if (error) throw error

  const rows = (data ?? []) as Customer[]
  const withBalances = await Promise.all(
    rows.map(async (row) => {
      const base = { ...row, loyalty_points: Number(row.loyalty_points ?? 0) }
      if (row.customer_type !== 'wholesale') return { ...base, ar_balance: 0 }
      const { data: bal, error: balErr } = await supabase.rpc('customer_ar_balance', {
        p_customer_id: row.id,
      })
      if (balErr) throw balErr
      return { ...base, ar_balance: Number(bal ?? 0) }
    }),
  )
  return withBalances
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      'id, branch_id, name, phone, customer_type, subtype, language, whatsapp_opt_in, credit_limit, loyalty_points, notes, created_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: bal } = await supabase.rpc('customer_ar_balance', { p_customer_id: id })
  return {
    ...(data as Customer),
    loyalty_points: Number((data as Customer).loyalty_points ?? 0),
    ar_balance: Number(bal ?? 0),
  }
}

export async function saveCustomer(
  branchId: string,
  input: CustomerInput,
  customerId?: string,
): Promise<string> {
  const payload = {
    branch_id: branchId,
    name: input.name.trim(),
    phone: input.phone?.trim() ? input.phone.trim() : null,
    customer_type: input.customer_type,
    subtype:
      input.customer_type === 'wholesale' && input.subtype ? input.subtype.trim() : null,
    language: input.language,
    whatsapp_opt_in: input.whatsapp_opt_in,
    credit_limit:
      input.customer_type === 'wholesale' && input.credit_limit != null
        ? Number(input.credit_limit)
        : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  }

  if (customerId) {
    const { error } = await supabase.from('customers').update(payload).eq('id', customerId)
    if (error) throw error
    return customerId
  }

  const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function customerArBalance(customerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('customer_ar_balance', {
    p_customer_id: customerId,
  })
  if (error) throw error
  return Number(data ?? 0)
}
