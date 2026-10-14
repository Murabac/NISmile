export type StaffRole =
  | 'owner'
  | 'branch_manager'
  | 'receptionist'
  | 'dentist'
  | 'storekeeper'

export type WhatsAppLanguage = 'so' | 'ar'

export type PriceList = 'retail' | 'wholesale'

export type PurchaseStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

export type StockMovementType =
  | 'purchase_in'
  | 'sale_out'
  | 'service_usage'
  | 'adjustment'
  | 'write_off'
  | 'transfer_out'
  | 'transfer_in'

export type Database = {
  dental: {
    Tables: {
      branches: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          tax_id: string | null
          zaad: string | null
          edahab: string | null
          mycash: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          tax_id?: string | null
          zaad?: string | null
          edahab?: string | null
          mycash?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          address?: string | null
          phone?: string | null
          tax_id?: string | null
          zaad?: string | null
          edahab?: string | null
          mycash?: string | null
          active?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          role: StaffRole
          name: string
          created_at: string
        }
        Insert: {
          user_id: string
          role: StaffRole
          name: string
          created_at?: string
        }
        Update: {
          role?: StaffRole
          name?: string
        }
        Relationships: []
      }
      user_branches: {
        Row: {
          user_id: string
          branch_id: string
        }
        Insert: {
          user_id: string
          branch_id: string
        }
        Update: {
          branch_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          branch_id: string
          name: string
          phone: string | null
          customer_type: 'retail' | 'wholesale'
          subtype: string | null
          language: WhatsAppLanguage
          whatsapp_opt_in: boolean
          credit_limit: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          name: string
          phone?: string | null
          customer_type?: 'retail' | 'wholesale'
          subtype?: string | null
          language?: WhatsAppLanguage
          whatsapp_opt_in?: boolean
          credit_limit?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          branch_id?: string
          name?: string
          phone?: string | null
          customer_type?: 'retail' | 'wholesale'
          subtype?: string | null
          language?: WhatsAppLanguage
          whatsapp_opt_in?: boolean
          credit_limit?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          active?: boolean
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          id: string
          name: string
          rate: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          rate: number
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          rate?: number
          active?: boolean
        }
        Relationships: []
      }
      items: {
        Row: {
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
        }
        Insert: {
          id?: string
          sku: string
          barcode?: string | null
          name: string
          category_id: string
          unit: string
          cost?: number
          reorder_level?: number
          tax_rate_id?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          sku?: string
          barcode?: string | null
          name?: string
          category_id?: string
          unit?: string
          cost?: number
          reorder_level?: number
          tax_rate_id?: string | null
          active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_tax_rate_id_fkey'
            columns: ['tax_rate_id']
            isOneToOne: false
            referencedRelation: 'tax_rates'
            referencedColumns: ['id']
          },
        ]
      }
      item_prices: {
        Row: {
          id: string
          item_id: string
          price_list: PriceList
          min_qty: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          price_list: PriceList
          min_qty?: number
          price: number
          created_at?: string
        }
        Update: {
          price_list?: PriceList
          min_qty?: number
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'item_prices_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      services: {
        Row: {
          id: string
          code: string
          name: string
          category_id: string
          description: string | null
          duration_minutes: number | null
          tax_rate_id: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          category_id: string
          description?: string | null
          duration_minutes?: number | null
          tax_rate_id?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          category_id?: string
          description?: string | null
          duration_minutes?: number | null
          tax_rate_id?: string | null
          active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'services_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'services_tax_rate_id_fkey'
            columns: ['tax_rate_id']
            isOneToOne: false
            referencedRelation: 'tax_rates'
            referencedColumns: ['id']
          },
        ]
      }
      service_prices: {
        Row: {
          id: string
          service_id: string
          price_list: PriceList
          min_qty: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          service_id: string
          price_list: PriceList
          min_qty?: number
          price: number
          created_at?: string
        }
        Update: {
          price_list?: PriceList
          min_qty?: number
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'service_prices_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
      }
      suppliers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          notes: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          phone?: string | null
          email?: string | null
          notes?: string | null
          active?: boolean
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          id: string
          branch_id: string
          supplier_id: string
          po_number: string
          status: PurchaseStatus
          order_date: string
          expected_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          supplier_id: string
          po_number: string
          status?: PurchaseStatus
          order_date?: string
          expected_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          supplier_id?: string
          status?: PurchaseStatus
          order_date?: string
          expected_date?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_orders_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_orders_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: string
          purchase_order_id: string
          item_id: string
          qty_ordered: number
          unit_cost: number
          qty_received: number
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          item_id: string
          qty_ordered: number
          unit_cost: number
          qty_received?: number
          created_at?: string
        }
        Update: {
          qty_ordered?: number
          unit_cost?: number
          qty_received?: number
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_order_lines_purchase_order_id_fkey'
            columns: ['purchase_order_id']
            isOneToOne: false
            referencedRelation: 'purchase_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_order_lines_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      goods_receipts: {
        Row: {
          id: string
          purchase_order_id: string
          branch_id: string
          received_at: string
          received_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          branch_id: string
          received_at?: string
          received_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          notes?: string | null
        }
        Relationships: []
      }
      goods_receipt_lines: {
        Row: {
          id: string
          goods_receipt_id: string
          purchase_order_line_id: string
          item_id: string
          qty: number
          batch_no: string
          expiry_date: string
          unit_cost: number
          created_at: string
        }
        Insert: {
          id?: string
          goods_receipt_id: string
          purchase_order_line_id: string
          item_id: string
          qty: number
          batch_no: string
          expiry_date: string
          unit_cost: number
          created_at?: string
        }
        Update: {
          qty?: number
          batch_no?: string
          expiry_date?: string
          unit_cost?: number
        }
        Relationships: []
      }
      stock_batches: {
        Row: {
          id: string
          branch_id: string
          item_id: string
          batch_no: string
          expiry_date: string
          qty_remaining: number
          unit_cost: number
          goods_receipt_line_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          item_id: string
          batch_no: string
          expiry_date: string
          qty_remaining: number
          unit_cost: number
          goods_receipt_line_id?: string | null
          created_at?: string
        }
        Update: {
          qty_remaining?: number
          unit_cost?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          id: string
          branch_id: string
          item_id: string
          batch_id: string | null
          movement_type: StockMovementType
          qty: number
          ref_type: string | null
          ref_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          item_id: string
          batch_id?: string | null
          movement_type: StockMovementType
          qty: number
          ref_type?: string | null
          ref_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_owner: { Args: Record<string, never>; Returns: boolean }
      current_role: { Args: Record<string, never>; Returns: StaffRole }
      user_branch_ids: { Args: Record<string, never>; Returns: string[] }
      can_manage_catalog: { Args: Record<string, never>; Returns: boolean }
      can_manage_services: { Args: Record<string, never>; Returns: boolean }
      can_manage_purchases: { Args: Record<string, never>; Returns: boolean }
      next_po_number: { Args: Record<string, never>; Returns: string }
      receive_purchase_order: {
        Args: {
          p_purchase_order_id: string
          p_lines: unknown
          p_notes?: string | null
        }
        Returns: string
      }
      can_manage_stock: { Args: Record<string, never>; Returns: boolean }
      deduct_stock_fefo: {
        Args: {
          p_branch_id: string
          p_item_id: string
          p_qty: number
          p_movement_type: StockMovementType
          p_ref_type?: string | null
          p_ref_id?: string | null
          p_notes?: string | null
        }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          p_branch_id: string
          p_item_id: string
          p_qty_delta: number
          p_reason: string
          p_notes?: string | null
          p_batch_id?: string | null
        }
        Returns: undefined
      }
    }
    Enums: {
      staff_role: StaffRole
      whatsapp_language: WhatsAppLanguage
      price_list: PriceList
      purchase_status: PurchaseStatus
      stock_movement_type: StockMovementType
    }
    CompositeTypes: Record<string, never>
  }
}
