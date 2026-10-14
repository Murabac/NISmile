export type StaffRole =
  | 'owner'
  | 'branch_manager'
  | 'receptionist'
  | 'dentist'
  | 'storekeeper'

export type WhatsAppLanguage = 'so' | 'ar' | 'en'

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

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type MessageCategory = 'utility' | 'marketing'

export type TemplateApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'

export type LogDirection = 'outbound' | 'inbound'

export type LogStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied'

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
          loyalty_points: number
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
          loyalty_points?: number
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
          loyalty_points?: number
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
        Relationships: [
          {
            foreignKeyName: 'stock_counts_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'stock_count_lines_stock_count_id_fkey'
            columns: ['stock_count_id']
            isOneToOne: false
            referencedRelation: 'stock_counts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_count_lines_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'import_batches_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'import_rows_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'import_batches'
            referencedColumns: ['id']
          },
        ]
      }
      promotions: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          promo_type:
            | 'percentage'
            | 'fixed_amount'
            | 'buy_x_get_y'
            | 'bundle'
            | 'spend_threshold'
          audience:
            | 'all'
            | 'retail'
            | 'wholesale'
            | 'wholesale_subtype'
            | 'named_customers'
          wholesale_subtype: string | null
          scope: 'invoice' | 'items' | 'services' | 'categories'
          percent_off: number | null
          amount_off: number | null
          buy_qty: number | null
          get_qty: number | null
          bundle_price: number | null
          spend_min: number | null
          min_qty: number | null
          max_redemptions_total: number | null
          max_redemptions_per_customer: number | null
          starts_at: string
          ends_at: string
          status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended'
          notify_whatsapp: boolean
          whatsapp_message_en: string | null
          whatsapp_message_so: string | null
          whatsapp_message_ar: string | null
          created_by: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          promo_type:
            | 'percentage'
            | 'fixed_amount'
            | 'buy_x_get_y'
            | 'bundle'
            | 'spend_threshold'
          audience?:
            | 'all'
            | 'retail'
            | 'wholesale'
            | 'wholesale_subtype'
            | 'named_customers'
          wholesale_subtype?: string | null
          scope?: 'invoice' | 'items' | 'services' | 'categories'
          percent_off?: number | null
          amount_off?: number | null
          buy_qty?: number | null
          get_qty?: number | null
          bundle_price?: number | null
          spend_min?: number | null
          min_qty?: number | null
          max_redemptions_total?: number | null
          max_redemptions_per_customer?: number | null
          starts_at: string
          ends_at: string
          status?: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended'
          notify_whatsapp?: boolean
          whatsapp_message_en?: string | null
          whatsapp_message_so?: string | null
          whatsapp_message_ar?: string | null
          created_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          status?: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended'
          notify_whatsapp?: boolean
          whatsapp_message_en?: string | null
          whatsapp_message_so?: string | null
          whatsapp_message_ar?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotion_branches: {
        Row: {
          promotion_id: string
          branch_id: string
        }
        Insert: {
          promotion_id: string
          branch_id: string
        }
        Update: {
          promotion_id?: string
          branch_id?: string
        }
        Relationships: []
      }
      promotion_targets: {
        Row: {
          id: string
          promotion_id: string
          target_kind: 'item' | 'service' | 'category' | 'customer'
          item_id: string | null
          service_id: string | null
          category_id: string | null
          customer_id: string | null
        }
        Insert: {
          id?: string
          promotion_id: string
          target_kind: 'item' | 'service' | 'category' | 'customer'
          item_id?: string | null
          service_id?: string | null
          category_id?: string | null
          customer_id?: string | null
        }
        Update: {
          target_kind?: 'item' | 'service' | 'category' | 'customer'
          item_id?: string | null
          service_id?: string | null
          category_id?: string | null
          customer_id?: string | null
        }
        Relationships: []
      }
      promotion_redemptions: {
        Row: {
          id: string
          promotion_id: string
          sale_id: string
          branch_id: string
          customer_id: string | null
          discount_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          sale_id: string
          branch_id: string
          customer_id?: string | null
          discount_amount: number
          created_at?: string
        }
        Update: {
          discount_amount?: number
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          id: string
          vat_percent: number | null
          loyalty_earn_per_usd: number | null
          loyalty_usd_per_point: number | null
          loyalty_min_redeem_points: number | null
          loyalty_expire_days: number | null
          go_live: Record<string, unknown>
          updated_by: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          vat_percent?: number | null
          loyalty_earn_per_usd?: number | null
          loyalty_usd_per_point?: number | null
          loyalty_min_redeem_points?: number | null
          loyalty_expire_days?: number | null
          go_live?: Record<string, unknown>
          updated_by?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          vat_percent?: number | null
          loyalty_earn_per_usd?: number | null
          loyalty_usd_per_point?: number | null
          loyalty_min_redeem_points?: number | null
          loyalty_expire_days?: number | null
          go_live?: Record<string, unknown>
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          id: string
          customer_id: string
          tx_type: 'earn' | 'redeem' | 'reverse' | 'adjust'
          points: number
          balance_after: number
          sale_id: string | null
          return_id: string | null
          notes: string | null
          expires_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tx_type: 'earn' | 'redeem' | 'reverse' | 'adjust'
          points: number
          balance_after: number
          sale_id?: string | null
          return_id?: string | null
          notes?: string | null
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          notes?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          name: string
          promotion_id: string | null
          kind: string
          status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
          scheduled_at: string
          started_at: string | null
          completed_at: string | null
          target_count: number
          enqueued_count: number
          skipped_count: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          promotion_id?: string | null
          kind: string
          status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          target_count?: number
          enqueued_count?: number
          skipped_count?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          target_count?: number
          enqueued_count?: number
          skipped_count?: number
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          branch_id: string
          customer_id: string
          dentist_id: string
          service_id: string | null
          start_at: string
          end_at: string
          status: AppointmentStatus
          notes: string | null
          sale_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          customer_id: string
          dentist_id: string
          service_id?: string | null
          start_at: string
          end_at: string
          status?: AppointmentStatus
          notes?: string | null
          sale_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          service_id?: string | null
          start_at?: string
          end_at?: string
          status?: AppointmentStatus
          notes?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
      }
      returns: {
        Row: {
          id: string
          branch_id: string
          sale_id: string
          return_number: string
          restock: boolean
          subtotal: number
          tax_total: number
          total: number
          refund_total: number
          reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          sale_id: string
          return_number: string
          restock?: boolean
          subtotal: number
          tax_total: number
          total: number
          refund_total?: number
          reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          restock?: boolean
          reason?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'returns_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'returns_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
      }
      return_lines: {
        Row: {
          id: string
          return_id: string
          sale_line_id: string
          qty: number
          unit_price: number
          tax_rate: number
          tax_amount: number
          line_net: number
          line_gross: number
          restocked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          sale_line_id: string
          qty: number
          unit_price: number
          tax_rate: number
          tax_amount: number
          line_net: number
          line_gross: number
          restocked?: boolean
          created_at?: string
        }
        Update: {
          qty?: number
          restocked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'return_lines_return_id_fkey'
            columns: ['return_id']
            isOneToOne: false
            referencedRelation: 'returns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'return_lines_sale_line_id_fkey'
            columns: ['sale_line_id']
            isOneToOne: false
            referencedRelation: 'sale_lines'
            referencedColumns: ['id']
          },
        ]
      }
      return_refunds: {
        Row: {
          id: string
          return_id: string
          tender: PaymentTender
          amount: number
          reference: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
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
        Relationships: [
          {
            foreignKeyName: 'return_refunds_return_id_fkey'
            columns: ['return_id']
            isOneToOne: false
            referencedRelation: 'returns'
            referencedColumns: ['id']
          },
        ]
      }
      message_templates: {
        Row: {
          id: string
          kind: string
          language: WhatsAppLanguage
          name: string
          category: MessageCategory
          body_text: string
          variables: unknown
          whatsapp_template_id: string | null
          status: TemplateApprovalStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: string
          language: WhatsAppLanguage
          name: string
          category?: MessageCategory
          body_text: string
          variables?: unknown
          whatsapp_template_id?: string | null
          status?: TemplateApprovalStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          category?: MessageCategory
          body_text?: string
          variables?: unknown
          whatsapp_template_id?: string | null
          status?: TemplateApprovalStatus
          updated_at?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          id: string
          branch_id: string
          customer_id: string | null
          phone: string
          language: WhatsAppLanguage
          template_id: string
          kind: string
          params: Record<string, unknown>
          scheduled_at: string
          status: QueueStatus
          attempts: number
          last_error: string | null
          related_type: string | null
          related_id: string | null
          created_by: string | null
          created_at: string
          sent_at: string | null
        }
        Insert: {
          id?: string
          branch_id: string
          customer_id?: string | null
          phone: string
          language: WhatsAppLanguage
          template_id: string
          kind: string
          params?: Record<string, unknown>
          scheduled_at?: string
          status?: QueueStatus
          attempts?: number
          last_error?: string | null
          related_type?: string | null
          related_id?: string | null
          created_by?: string | null
          created_at?: string
          sent_at?: string | null
        }
        Update: {
          status?: QueueStatus
          attempts?: number
          last_error?: string | null
          sent_at?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_queue_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_queue_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_queue_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'message_templates'
            referencedColumns: ['id']
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          queue_id: string | null
          branch_id: string | null
          direction: LogDirection
          phone: string
          language: WhatsAppLanguage | null
          kind: string | null
          status: LogStatus
          body_preview: string | null
          payload: Record<string, unknown>
          provider_message_id: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          queue_id?: string | null
          branch_id?: string | null
          direction?: LogDirection
          phone: string
          language?: WhatsAppLanguage | null
          kind?: string | null
          status: LogStatus
          body_preview?: string | null
          payload?: Record<string, unknown>
          provider_message_id?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          status?: LogStatus
          body_preview?: string | null
          provider_message_id?: string | null
          error_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notification_log_queue_id_fkey'
            columns: ['queue_id']
            isOneToOne: false
            referencedRelation: 'notification_queue'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_log_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
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
          p_redeem_points?: number
        }
        Returns: string
      }
      next_promotion_code: { Args: Record<string, never>; Returns: string }
      publish_promotion: {
        Args: { p_promotion_id: string }
        Returns: unknown
      }
      set_promotion_status: {
        Args: {
          p_promotion_id: string
          p_status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended'
        }
        Returns: unknown
      }
      count_promotion_audience: {
        Args: { p_promotion_id: string }
        Returns: number
      }
      evaluate_best_promotion: {
        Args: {
          p_branch_id: string
          p_customer_id: string | null
          p_lines: unknown
        }
        Returns: unknown
      }
      get_clinic_settings: { Args: Record<string, never>; Returns: unknown }
      update_clinic_settings: {
        Args: {
          p_vat_percent?: number | null
          p_loyalty_earn_per_usd?: number | null
          p_loyalty_usd_per_point?: number | null
          p_loyalty_min_redeem_points?: number | null
          p_loyalty_expire_days?: number | null
          p_clear_vat?: boolean
          p_clear_loyalty_earn?: boolean
          p_clear_loyalty_redeem?: boolean
          p_clear_loyalty_min?: boolean
          p_clear_loyalty_expire?: boolean
        }
        Returns: unknown
      }
      preview_loyalty_redeem: {
        Args: {
          p_customer_id: string
          p_redeem_points: number
          p_remaining_net: number
        }
        Returns: unknown
      }
      adjust_loyalty_points: {
        Args: {
          p_customer_id: string
          p_points: number
          p_notes?: string | null
        }
        Returns: unknown
      }
      list_promotion_audience: {
        Args: { p_promotion_id: string }
        Returns: unknown
      }
      enqueue_promotion_campaign: {
        Args: {
          p_promotion_id: string
          p_kind?: string
          p_scheduled_at?: string | null
          p_name?: string | null
        }
        Returns: string
      }
      cancel_campaign: {
        Args: { p_campaign_id: string }
        Returns: unknown
      }
      campaign_stats: {
        Args: { p_campaign_id: string }
        Returns: unknown
      }
      run_report: {
        Args: {
          p_report_type: string
          p_branch_id?: string | null
          p_period?: string
        }
        Returns: unknown
      }
      dashboard_summary: {
        Args: { p_branch_id?: string | null }
        Returns: unknown
      }
      go_live_status: { Args: Record<string, never>; Returns: unknown }
      update_go_live_checklist: {
        Args: { p_checklist: unknown }
        Returns: unknown
      }
      delete_branch: {
        Args: { p_branch_id: string }
        Returns: unknown
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
      create_branch_dentist: {
        Args: {
          p_branch_id: string
          p_name: string
          p_email: string
          p_password?: string | null
        }
        Returns: string
      }
      create_appointment: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_dentist_id: string
          p_start_at: string
          p_end_at?: string | null
          p_service_id?: string | null
          p_notes?: string | null
        }
        Returns: string
      }
      set_appointment_status: {
        Args: {
          p_appointment_id: string
          p_status: AppointmentStatus
        }
        Returns: undefined
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_start_at: string
          p_end_at?: string | null
        }
        Returns: undefined
      }
      complete_appointment: {
        Args: {
          p_appointment_id: string
          p_lines?: unknown
          p_payments?: unknown
          p_notes?: string | null
        }
        Returns: string
      }
      enqueue_notification: {
        Args: {
          p_branch_id: string
          p_kind: string
          p_phone?: string | null
          p_language?: WhatsAppLanguage | null
          p_customer_id?: string | null
          p_params?: unknown
          p_scheduled_at?: string | null
          p_related_type?: string | null
          p_related_id?: string | null
        }
        Returns: string
      }
      cancel_queued_notification: {
        Args: { p_queue_id: string }
        Returns: undefined
      }
      simulate_whatsapp_delivery: {
        Args: { p_queue_id: string; p_status?: string }
        Returns: string
      }
      simulate_whatsapp_inbound: {
        Args: { p_phone: string; p_body: string }
        Returns: unknown
      }
      notify_sale_document: {
        Args: { p_sale_id: string }
        Returns: string | null
      }
      process_return: {
        Args: {
          p_branch_id: string
          p_sale_id: string
          p_lines: unknown
          p_refunds?: unknown
          p_restock?: boolean
          p_reason?: string | null
          p_notes?: string | null
        }
        Returns: string
      }
      can_manage_notifications: { Args: Record<string, never>; Returns: boolean }
      can_manage_appointments: { Args: Record<string, never>; Returns: boolean }
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
      appointment_status: AppointmentStatus
      message_category: MessageCategory
      template_approval_status: TemplateApprovalStatus
      queue_status: QueueStatus
      log_direction: LogDirection
      log_status: LogStatus
    }
    CompositeTypes: Record<string, never>
  }
}
