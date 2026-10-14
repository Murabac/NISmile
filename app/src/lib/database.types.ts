export type StaffRole =
  | 'owner'
  | 'branch_manager'
  | 'receptionist'
  | 'dentist'
  | 'storekeeper'

export type WhatsAppLanguage = 'so' | 'ar'

export type PriceList = 'retail' | 'wholesale'

export type PurchaseStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled'

export type StockCountStatus = 'draft' | 'completed' | 'cancelled'

export type ImportType = 'items' | 'customers' | 'opening_stock'

export type ImportBatchStatus =
  | 'uploaded'
  | 'validated'
  | 'dry_run'
  | 'confirmed'
  | 'reverted'
  | 'failed'

export type ImportRowStatus = 'pending' | 'ok' | 'error' | 'applied' | 'reverted'

export type PaymentTender = 'cash' | 'zaad' | 'edahab' | 'mycash'

export type SaleStatus = 'partial' | 'paid' | 'void'

export type SaleLineType = 'item' | 'service'

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
      service_recipes: {
        Row: {
          id: string
          service_id: string
          item_id: string
          qty: number
          created_at: string
        }
        Insert: {
          id?: string
          service_id: string
          item_id: string
          qty: number
          created_at?: string
        }
        Update: {
          service_id?: string
          item_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: 'service_recipes_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_recipes_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          id: string
          branch_id: string
          customer_id: string | null
          status: SaleStatus
          price_list: PriceList
          subtotal: number
          discount_total: number
          tax_total: number
          total: number
          paid_total: number
          receipt_number: string
          notes: string | null
          due_date: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          customer_id?: string | null
          status: SaleStatus
          price_list: PriceList
          subtotal: number
          discount_total?: number
          tax_total: number
          total: number
          paid_total: number
          receipt_number: string
          notes?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          status?: SaleStatus
          paid_total?: number
          notes?: string | null
          due_date?: string | null
        }
        Relationships: []
      }
      sale_lines: {
        Row: {
          id: string
          sale_id: string
          line_type: SaleLineType
          item_id: string | null
          service_id: string | null
          sku_or_code: string
          name: string
          qty: number
          unit_price: number
          discount_amount: number
          tax_rate: number
          tax_amount: number
          line_net: number
          line_gross: number
          promotion_id: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          line_type: SaleLineType
          item_id?: string | null
          service_id?: string | null
          sku_or_code: string
          name: string
          qty: number
          unit_price: number
          discount_amount?: number
          tax_rate: number
          tax_amount: number
          line_net: number
          line_gross: number
          promotion_id?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          qty?: number
          unit_price?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          sale_id: string
          tender: PaymentTender
          amount: number
          reference: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          tender: PaymentTender
          amount: number
          reference?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          reference?: string | null
        }
        Relationships: []
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
      stock_transfers: {
        Row: {
          id: string
          transfer_number: string
          from_branch_id: string
          to_branch_id: string
          status: TransferStatus
          notes: string | null
          created_by: string | null
          created_at: string
          sent_at: string | null
          received_at: string | null
          received_by: string | null
        }
        Insert: {
          id?: string
          transfer_number: string
          from_branch_id: string
          to_branch_id: string
          status?: TransferStatus
          notes?: string | null
          created_by?: string | null
          created_at?: string
          sent_at?: string | null
          received_at?: string | null
          received_by?: string | null
        }
        Update: {
          status?: TransferStatus
          notes?: string | null
          sent_at?: string | null
          received_at?: string | null
          received_by?: string | null
        }
        Relationships: []
      }
      stock_transfer_lines: {
        Row: {
          id: string
          transfer_id: string
          item_id: string
          qty_requested: number
          qty_received: number | null
          created_at: string
        }
        Insert: {
          id?: string
          transfer_id: string
          item_id: string
          qty_requested: number
          qty_received?: number | null
          created_at?: string
        }
        Update: {
          qty_requested?: number
          qty_received?: number | null
        }
        Relationships: []
      }
      stock_transfer_allocations: {
        Row: {
          id: string
          transfer_line_id: string
          from_batch_id: string | null
          batch_no: string
          expiry_date: string
          unit_cost: number
          qty: number
          created_at: string
        }
        Insert: {
          id?: string
          transfer_line_id: string
          from_batch_id?: string | null
          batch_no: string
          expiry_date: string
          unit_cost: number
          qty: number
          created_at?: string
        }
        Update: {
          qty?: number
        }
        Relationships: []
      }
      stock_counts: {
        Row: {
          id: string
          branch_id: string
          status: StockCountStatus
          notes: string | null
          created_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          status?: StockCountStatus
          notes?: string | null
          created_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          status?: StockCountStatus
          notes?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      stock_count_lines: {
        Row: {
          id: string
          stock_count_id: string
          item_id: string
          system_qty: number
          counted_qty: number | null
          created_at: string
        }
        Insert: {
          id?: string
          stock_count_id: string
          item_id: string
          system_qty: number
          counted_qty?: number | null
          created_at?: string
        }
        Update: {
          system_qty?: number
          counted_qty?: number | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          id: string
          branch_id: string | null
          import_type: ImportType
          status: ImportBatchStatus
          file_name: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          confirmed_at: string | null
          reverted_at: string | null
        }
        Insert: {
          id?: string
          branch_id?: string | null
          import_type: ImportType
          status?: ImportBatchStatus
          file_name?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          confirmed_at?: string | null
          reverted_at?: string | null
        }
        Update: {
          status?: ImportBatchStatus
          confirmed_at?: string | null
          reverted_at?: string | null
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          id: string
          batch_id: string
          row_number: number
          raw: Record<string, unknown>
          status: ImportRowStatus
          errors: string[]
          created_entity_type: string | null
          created_entity_id: string | null
          created_action: string | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          row_number: number
          raw?: Record<string, unknown>
          status?: ImportRowStatus
          errors?: string[]
          created_entity_type?: string | null
          created_entity_id?: string | null
          created_action?: string | null
          created_at?: string
        }
        Update: {
          status?: ImportRowStatus
          errors?: string[]
          raw?: Record<string, unknown>
          created_entity_type?: string | null
          created_entity_id?: string | null
          created_action?: string | null
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
      can_checkout: { Args: Record<string, never>; Returns: boolean }
      next_receipt_number: { Args: Record<string, never>; Returns: string }
      resolve_unit_price: {
        Args: {
          p_price_list: PriceList
          p_qty: number
          p_item_id?: string | null
          p_service_id?: string | null
        }
        Returns: number
      }
      checkout_sale: {
        Args: {
          p_branch_id: string
          p_customer_id: string | null
          p_lines: unknown
          p_payments: unknown
          p_notes?: string | null
          p_due_date?: string | null
        }
        Returns: string
      }
      customer_ar_balance: {
        Args: { p_customer_id: string }
        Returns: number
      }
      apply_customer_payment: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_payments: unknown
          p_sale_id?: string | null
        }
        Returns: string
      }
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
      apply_service_recipe: {
        Args: {
          p_branch_id: string
          p_service_id: string
          p_ref_type?: string | null
          p_ref_id?: string | null
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
      can_manage_transfers: { Args: Record<string, never>; Returns: boolean }
      next_transfer_number: { Args: Record<string, never>; Returns: string }
      create_stock_transfer: {
        Args: {
          p_from_branch_id: string
          p_to_branch_id: string
          p_lines: unknown
          p_notes?: string | null
        }
        Returns: string
      }
      send_stock_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      receive_stock_transfer: {
        Args: { p_transfer_id: string; p_lines: unknown }
        Returns: undefined
      }
      cancel_stock_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      create_stock_count: {
        Args: { p_branch_id: string; p_notes?: string | null }
        Returns: string
      }
      save_stock_count_lines: {
        Args: { p_stock_count_id: string; p_lines: unknown }
        Returns: undefined
      }
      complete_stock_count: {
        Args: { p_stock_count_id: string }
        Returns: undefined
      }
      cancel_stock_count: {
        Args: { p_stock_count_id: string }
        Returns: undefined
      }
      create_import_batch: {
        Args: {
          p_import_type: ImportType
          p_branch_id: string | null
          p_file_name: string
          p_rows: unknown
          p_notes?: string | null
        }
        Returns: string
      }
      validate_import_batch: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      dry_run_import: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      confirm_import: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      revert_import: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      normalize_import_phone: {
        Args: { p_phone: string }
        Returns: string
      }
    }
    Enums: {
      staff_role: StaffRole
      whatsapp_language: WhatsAppLanguage
      transfer_status: TransferStatus
      stock_count_status: StockCountStatus
      import_type: ImportType
      import_batch_status: ImportBatchStatus
      import_row_status: ImportRowStatus
      price_list: PriceList
      purchase_status: PurchaseStatus
      stock_movement_type: StockMovementType
    }
    CompositeTypes: Record<string, never>
  }
}
