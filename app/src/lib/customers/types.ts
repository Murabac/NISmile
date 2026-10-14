import type { WhatsAppLanguage } from '../database.types.ts'

export type CustomerType = 'retail' | 'wholesale'

export type WholesaleSubtype = 'clinic' | 'pharmacy' | 'lab' | 'dentist'

export const WHOLESALE_SUBTYPES: { value: WholesaleSubtype; label: string }[] = [
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy / shop' },
  { value: 'lab', label: 'Lab' },
  { value: 'dentist', label: 'Individual dentist' },
]

export type Customer = {
  id: string
  branch_id: string
  name: string
  phone: string | null
  customer_type: CustomerType
  subtype: string | null
  language: WhatsAppLanguage
  whatsapp_opt_in: boolean
  credit_limit: number | null
  notes: string | null
  created_at: string
  ar_balance?: number
}

export type CustomerInput = {
  name: string
  phone: string | null
  customer_type: CustomerType
  subtype: string | null
  language: WhatsAppLanguage
  whatsapp_opt_in: boolean
  credit_limit: number | null
  notes: string | null
}
