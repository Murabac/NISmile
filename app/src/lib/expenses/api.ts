import { supabase } from '../supabase.ts'
import type { CreateExpenseInput, Expense, ExpenseCategory } from './types.ts'

export async function fetchExpenseCategories() {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, code, name, active, sort_order')
    .eq('active', true)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as ExpenseCategory[]
}

export async function fetchExpenses(branchId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      id, branch_id, category_id, expense_number, expense_date, amount, tender,
      payee, reference, notes, status, created_at,
      expense_categories ( code, name )
    `,
    )
    .eq('branch_id', branchId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error

  return (data ?? []).map((row) => {
    const cat = row.expense_categories as
      | { code: string; name: string }
      | { code: string; name: string }[]
      | null
    const one = Array.isArray(cat) ? cat[0] : cat
    return {
      id: row.id as string,
      branch_id: row.branch_id as string,
      category_id: row.category_id as string,
      expense_number: row.expense_number as string,
      expense_date: row.expense_date as string,
      amount: Number(row.amount),
      tender: row.tender as Expense['tender'],
      payee: (row.payee as string | null) ?? null,
      reference: (row.reference as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      status: row.status as Expense['status'],
      created_at: row.created_at as string,
      category_name: one?.name,
      category_code: one?.code,
    } satisfies Expense
  })
}

export async function createExpense(branchId: string, input: CreateExpenseInput) {
  const { data, error } = await supabase.rpc('create_expense', {
    p_branch_id: branchId,
    p_category_id: input.category_id,
    p_amount: input.amount,
    p_tender: input.tender,
    p_expense_date: input.expense_date,
    p_payee: input.payee?.trim() || null,
    p_reference: input.reference?.trim() || null,
    p_notes: input.notes?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function voidExpense(expenseId: string) {
  const { error } = await supabase.rpc('void_expense', {
    p_expense_id: expenseId,
  })
  if (error) throw error
}
