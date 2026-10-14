import type { PriceList } from '../database.types.ts'

export type Category = {
  id: string
  name: string
  active: boolean
  created_at: string
}

export type TaxRate = {
  id: string
  name: string
  rate: number
  active: boolean
  created_at: string
}

export type ItemPrice = {
  id: string
  item_id: string
  price_list: PriceList
  min_qty: number
  price: number
}

export type CatalogItem = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category_id: string
  unit: string
  cost: number
  reorder_level: number
  tax_rate_id: string | null
  active: boolean
  created_at: string
  categories: Pick<Category, 'id' | 'name'> | null
  tax_rates: Pick<TaxRate, 'id' | 'name' | 'rate'> | null
  item_prices: ItemPrice[]
}

export type PriceTierInput = {
  price_list: PriceList
  min_qty: number
  price: number
}

export type ItemInput = {
  sku: string
  barcode: string | null
  name: string
  category_id: string
  unit: string
  cost: number
  reorder_level: number
  tax_rate_id: string | null
  active: boolean
  prices: PriceTierInput[]
}

export type CatalogService = {
  id: string
  code: string
  name: string
  category_id: string
  description: string | null
  duration_minutes: number | null
  tax_rate_id: string | null
  active: boolean
  created_at: string
  categories: Pick<Category, 'id' | 'name'> | null
  tax_rates: Pick<TaxRate, 'id' | 'name' | 'rate'> | null
  service_prices: {
    id: string
    service_id: string
    price_list: PriceList
    min_qty: number
    price: number
  }[]
}

export type ServiceInput = {
  code: string
  name: string
  category_id: string
  description: string | null
  duration_minutes: number | null
  tax_rate_id: string | null
  active: boolean
  prices: PriceTierInput[]
}
