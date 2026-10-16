import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import { useAuth } from '../lib/auth.tsx'
import {
  createExpense,
  fetchExpenseCategories,
  fetchExpenses,
  voidExpense,
} from '../lib/expenses/api.ts'
import { TENDER_LABELS, type Expense } from '../lib/expenses/types.ts'
import type { PaymentTender } from '../lib/database.types.ts'
import { formatMoney } from '../lib/money.ts'

const TENDERS = Object.keys(TENDER_LABELS) as PaymentTender[]

function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ExpensesPage() {
  const { branchId } = useAuth()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [tender, setTender] = useState<PaymentTender>('cash')
  const [expenseDate, setExpenseDate] = useState(todayIso)
  const [payee, setPayee] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const branchReady = branchId !== 'all'

  const categoriesQuery = useQuery({
    queryKey: ['expense_categories'],
    queryFn: fetchExpenseCategories,
    enabled: branchReady,
  })

  const expensesQuery = useQuery({
    queryKey: ['expenses', branchId],
    queryFn: () => fetchExpenses(branchId),
    enabled: branchReady,
  })

  const categories = categoriesQuery.data ?? []
  const expenses = expensesQuery.data ?? []

  const postedTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.status === 'posted')
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  )

  const createMutation = useMutation({
    mutationFn: () => {
      const value = Number(amount)
      if (!categoryId) throw new Error('Choose a category')
      if (!(value > 0)) throw new Error('Amount must be greater than zero')
      return createExpense(branchId, {
        category_id: categoryId,
        amount: value,
        tender,
        expense_date: expenseDate,
        payee: payee || null,
        reference: reference || null,
        notes: notes || null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses', branchId] })
      setCreateOpen(false)
      resetForm()
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const voidMutation = useMutation({
    mutationFn: (id: string) => voidExpense(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses', branchId] })
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  function resetForm() {
    setCategoryId(categories[0]?.id ?? '')
    setAmount('')
    setTender('cash')
    setExpenseDate(todayIso())
    setPayee('')
    setReference('')
    setNotes('')
  }

  function openCreate() {
    setError(null)
    resetForm()
    if (!categoryId && categories[0]) setCategoryId(categories[0].id)
    setCreateOpen(true)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    createMutation.mutate()
  }

  if (!branchReady) {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Expenses</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header to record operating expenses.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-muted">
            Branch operating costs paid by Cash, Zaad, eDahab, or MyCash.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Record expense
        </button>
      </div>

      {error ? <p className="text-sm text-status-red">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Posted total (list)" value={formatMoney(postedTotal)} />
        <Stat
          label="Posted count"
          value={String(expenses.filter((e) => e.status === 'posted').length)}
        />
        <Stat
          label="Voided"
          value={String(expenses.filter((e) => e.status === 'void').length)}
        />
      </div>

      <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
        {expensesQuery.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Loading expenses…</p>
        ) : expensesQuery.isError ? (
          <p className="px-4 py-6 text-sm text-status-red">
            {(expensesQuery.error as Error).message}
          </p>
        ) : expenses.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No expenses yet for this branch.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-[10px] tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Number</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Payee</th>
                <th className="px-4 py-3 font-semibold">Tender</th>
                <th className="px-4 py-3 text-end font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-end font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <ExpenseRow
                  key={row.id}
                  expense={row}
                  voiding={voidMutation.isPending}
                  onVoid={() => {
                    if (
                      window.confirm(
                        `Void ${row.expense_number}? This cannot be undone.`,
                      )
                    ) {
                      voidMutation.mutate(row.id)
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Record expense"
        subtitle="Operating cost for this branch · USD"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="expense-form"
              disabled={createMutation.isPending}
              className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {createMutation.isPending ? 'Saving…' : 'Save expense'}
            </button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold">
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Amount (USD)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Paid with
            <select
              value={tender}
              onChange={(e) => setTender(e.target.value as PaymentTender)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              {TENDERS.map((t) => (
                <option key={t} value={t}>
                  {TENDER_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Date
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Payee
            <input
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              placeholder="Vendor or person"
            />
          </label>
          <label className="block text-sm font-semibold">
            Reference
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
              placeholder="Receipt / transfer ref"
            />
          </label>
          <label className="block text-sm font-semibold">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
            />
          </label>
        </form>
      </Drawer>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-dentaflow border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg font-extrabold">{value}</p>
    </div>
  )
}

function ExpenseRow({
  expense,
  voiding,
  onVoid,
}: {
  expense: Expense
  voiding: boolean
  onVoid: () => void
}) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3 font-mono text-xs">{expense.expense_date}</td>
      <td className="px-4 py-3 font-mono text-xs font-bold">{expense.expense_number}</td>
      <td className="px-4 py-3 text-sm">{expense.category_name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-muted">{expense.payee ?? '—'}</td>
      <td className="px-4 py-3 text-xs">{TENDER_LABELS[expense.tender]}</td>
      <td className="px-4 py-3 text-end font-mono text-sm font-bold">
        {formatMoney(expense.amount)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            expense.status === 'posted'
              ? 'bg-status-green/15 text-status-green'
              : 'bg-muted/20 text-muted'
          }`}
        >
          {expense.status}
        </span>
      </td>
      <td className="px-4 py-3 text-end">
        {expense.status === 'posted' ? (
          <button
            type="button"
            disabled={voiding}
            onClick={onVoid}
            className="text-[10px] font-bold text-status-red disabled:opacity-50"
          >
            Void
          </button>
        ) : (
          <span className="text-[10px] text-muted">—</span>
        )}
      </td>
    </tr>
  )
}
