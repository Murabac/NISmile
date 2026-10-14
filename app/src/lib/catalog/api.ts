import { supabase } from '../supabase.ts'
import type { ItemInput, ServiceInput } from './types.ts'

export async function fetchCategories(includeInactive = true) {
  let query = supabase.from('categories').select('id, name, active, created_at').order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createCategory(name: string) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), active: true })
    .select('id, name, active, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, patch: { name?: string; active?: boolean }) {
  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select('id, name, active, created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchTaxRates(includeInactive = true) {
  let query = supabase.from('tax_rates').select('id, name, rate, active, created_at').order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createTaxRate(input: { name: string; rate: number }) {
  const { data, error } = await supabase
    .from('tax_rates')
    .insert({ name: input.name.trim(), rate: input.rate, active: true })
    .select('id, name, rate, active, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateTaxRate(
  id: string,
  patch: { name?: string; rate?: number; active?: boolean },
) {
  const { data, error } = await supabase
    .from('tax_rates')
    .update(patch)
    .eq('id', id)
    .select('id, name, rate, active, created_at')
    .single()
  if (error) throw error
  return data
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchItems() {
  const { data, error } = await supabase
    .from('items')
    .select(
      `
      id, sku, barcode, name, category_id, unit, cost, reorder_level, tax_rate_id, active, created_at,
      categories ( id, name ),
      tax_rates ( id, name, rate ),
      item_prices ( id, item_id, price_list, min_qty, price )
    `,
    )
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    categories: asOne(row.categories as { id: string; name: string } | { id: string; name: string }[] | null),
    tax_rates: asOne(
      row.tax_rates as
        | { id: string; name: string; rate: number }
        | { id: string; name: string; rate: number }[]
        | null,
    ),
    item_prices: (row.item_prices ?? []) as {
      id: string
      item_id: string
      price_list: 'retail' | 'wholesale'
      min_qty: number
      price: number
    }[],
  }))
}

export async function saveItem(input: ItemInput, itemId?: string) {
  const payload = {
    sku: input.sku.trim(),
    barcode: input.barcode?.trim() ? input.barcode.trim() : null,
    name: input.name.trim(),
    category_id: input.category_id,
    unit: input.unit.trim(),
    cost: input.cost,
    reorder_level: input.reorder_level,
    tax_rate_id: input.tax_rate_id,
    active: input.active,
  }

  let id = itemId
  if (id) {
    const { error } = await supabase.from('items').update(payload).eq('id', id)
    if (error) throw error
    const { error: deleteError } = await supabase.from('item_prices').delete().eq('item_id', id)
    if (deleteError) throw deleteError
  } else {
    const { data, error } = await supabase.from('items').insert(payload).select('id').single()
    if (error) throw error
    id = data.id
  }

  if (input.prices.length > 0) {
    const { error: priceError } = await supabase.from('item_prices').insert(
      input.prices.map((tier) => ({
        item_id: id!,
        price_list: tier.price_list,
        min_qty: tier.min_qty,
        price: tier.price,
      })),
    )
    if (priceError) throw priceError
  }

  return id
}

export function basePrice(
  prices: { price_list: string; min_qty: number; price: number }[],
  list: 'retail' | 'wholesale',
) {
  const match = prices
    .filter((row) => row.price_list === list)
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty))[0]
  return match ? Number(match.price) : null
}

export async function fetchServices() {
  const { data, error } = await supabase
    .from('services')
    .select(
      `
      id, code, name, category_id, description, duration_minutes, tax_rate_id, active, created_at,
      categories ( id, name ),
      tax_rates ( id, name, rate ),
      service_prices ( id, service_id, price_list, min_qty, price ),
      service_recipes ( id, service_id, item_id, qty, items ( id, sku, name, unit ) )
    `,
    )
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    categories: asOne(row.categories as { id: string; name: string } | { id: string; name: string }[] | null),
    tax_rates: asOne(
      row.tax_rates as
        | { id: string; name: string; rate: number }
        | { id: string; name: string; rate: number }[]
        | null,
    ),
    service_prices: (row.service_prices ?? []) as {
      id: string
      service_id: string
      price_list: 'retail' | 'wholesale'
      min_qty: number
      price: number
    }[],
    service_recipes: ((row as { service_recipes?: unknown[] }).service_recipes ?? []).map((line) => {
      const recipe = line as {
        id: string
        service_id: string
        item_id: string
        qty: number
        items:
          | { id: string; sku: string; name: string; unit: string }
          | { id: string; sku: string; name: string; unit: string }[]
          | null
      }
      return {
        id: recipe.id,
        service_id: recipe.service_id,
        item_id: recipe.item_id,
        qty: Number(recipe.qty),
        items: asOne(recipe.items),
      }
    }),
  }))
}

export async function saveService(input: ServiceInput, serviceId?: string) {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    category_id: input.category_id,
    description: input.description?.trim() ? input.description.trim() : null,
    duration_minutes: input.duration_minutes,
    tax_rate_id: input.tax_rate_id,
    active: input.active,
  }

  let id = serviceId
  if (id) {
    const { error } = await supabase.from('services').update(payload).eq('id', id)
    if (error) throw error
    const { error: deleteError } = await supabase.from('service_prices').delete().eq('service_id', id)
    if (deleteError) throw deleteError
    const { error: recipeDeleteError } = await supabase
      .from('service_recipes')
      .delete()
      .eq('service_id', id)
    if (recipeDeleteError) throw recipeDeleteError
  } else {
    const { data, error } = await supabase.from('services').insert(payload).select('id').single()
    if (error) throw error
    id = data.id
  }

  if (input.prices.length > 0) {
    const { error: priceError } = await supabase.from('service_prices').insert(
      input.prices.map((tier) => ({
        service_id: id!,
        price_list: tier.price_list,
        min_qty: tier.min_qty,
        price: tier.price,
      })),
    )
    if (priceError) throw priceError
  }

  const recipes = input.recipes.filter((line) => line.item_id && Number(line.qty) > 0)
  if (recipes.length > 0) {
    const { error: recipeError } = await supabase.from('service_recipes').insert(
      recipes.map((line) => ({
        service_id: id!,
        item_id: line.item_id,
        qty: Number(line.qty),
      })),
    )
    if (recipeError) throw recipeError
  }

  return id
}

export async function applyServiceRecipe(
  branchId: string,
  serviceId: string,
  refType: string | null = 'manual',
  refId: string | null = null,
) {
  const { error } = await supabase.rpc('apply_service_recipe', {
    p_branch_id: branchId,
    p_service_id: serviceId,
    p_ref_type: refType,
    p_ref_id: refId,
  })
  if (error) throw error
}
