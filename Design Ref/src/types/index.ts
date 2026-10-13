export type BranchId = 'all' | 'main' | 'hargeisa-north' | 'burao';

export interface Branch {
  id: BranchId;
  name: string;
  location: string;
  phone: string;
  manager: string;
  activeStaff: number;
}

export type Role = 'Owner' | 'Branch Manager' | 'Receptionist' | 'Dentist' | 'Storekeeper';

export type Language = 'en' | 'so' | 'ar';

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'near-expiry' | 'expired';

export interface StockBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  receivedDate: string;
  supplier: string;
}

export interface StockMovement {
  id: string;
  date: string;
  type: 'sale' | 'purchase' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'recipe_consumption';
  quantity: number;
  previousQty: number;
  newQty: number;
  reference: string;
  user: string;
  notes?: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: 'Restorative' | 'Consumables' | 'Anesthetics' | 'Hygiene' | 'Cosmetic' | 'Prosthodontics' | 'Surgical';
  unit: string;
  retailPrice: number;
  wholesalePrice: number;
  branchQuantities: Record<Exclude<BranchId, 'all'>, number>;
  reorderLevel: number;
  costPrice: number;
  batches: StockBatch[];
  movements: StockMovement[];
  nearestExpiry: string;
  vatRate: number; // e.g. 0.05
}

export interface ServiceRecipeItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
}

export interface DentalService {
  id: string;
  code: string;
  name: string;
  category: 'Hygiene' | 'Restorative' | 'Surgery' | 'Endodontics' | 'Cosmetic' | 'Diagnostic';
  retailPrice: number;
  wholesalePrice: number;
  vatRate: number;
  durationMinutes: number;
  recipe: ServiceRecipeItem[];
  description: string;
}

export type CustomerType = 'retail' | 'wholesale';
export type WholesaleSubtype = 'Clinic' | 'Pharmacy' | 'Dental Lab' | 'Individual Dentist';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  wholesaleSubtype?: WholesaleSubtype;
  phone: string;
  email: string;
  preferredLanguage: Language;
  optInWhatsApp: boolean;
  branchId: Exclude<BranchId, 'all'>;
  loyaltyPoints: number;
  creditLimit: number;
  currentBalance: number; // outstanding debt
  taxId?: string;
  createdAt: string;
  lastVisit: string;
  totalSpent: number;
}

export type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-show';
export type WhatsAppStatus = 'Sent' | 'Delivered' | 'Read' | 'Replied "Confirm"' | 'Failed';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  dentistName: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  branchId: Exclude<BranchId, 'all'>;
  status: AppointmentStatus;
  whatsappStatus: WhatsAppStatus;
  notes?: string;
  amount: number;
}

export type PromotionType = 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle' | 'spend_threshold';
export type PromotionAudience = 'all' | 'retail' | 'wholesale' | 'wholesale_subtype' | 'vip_group';

export interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  type: PromotionType;
  value: number; // percentage or fixed amount
  buyQty?: number;
  getQty?: number;
  audience: PromotionAudience;
  wholesaleSubtype?: WholesaleSubtype;
  applicableBranchIds: BranchId[];
  startDate: string;
  endDate: string;
  status: 'active' | 'scheduled' | 'expired' | 'paused';
  redemptions: number;
  revenueGenerated: number;
  notifyOnWhatsApp: boolean;
  whatsappMessageEn: string;
  whatsappMessageSo: string;
  whatsappMessageAr: string;
  estimatedRecipients: number;
}

export type TransferStatus = 'Draft' | 'In transit' | 'Received';

export interface TransferItem {
  itemId: string;
  sku: string;
  itemName: string;
  quantityRequested: number;
  quantityReceived?: number;
  batchNumber: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranch: Exclude<BranchId, 'all'>;
  destinationBranch: Exclude<BranchId, 'all'>;
  createdAt: string;
  dispatchedAt?: string;
  receivedAt?: string;
  status: TransferStatus;
  items: TransferItem[];
  initiatedBy: string;
  notes?: string;
}

export type PurchaseStatus = 'Draft' | 'Ordered' | 'Received' | 'Partial';

export interface PurchaseOrderItem {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQty?: number;
  receivedBatchNumber?: string;
  receivedExpiryDate?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  branchId: Exclude<BranchId, 'all'>;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string;
  status: PurchaseStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentTerms: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'Utility' | 'Marketing' | 'Authentication';
  language: Language;
  content: string;
  variables: string[];
  status: 'Approved' | 'Pending' | 'Rejected';
  updatedAt: string;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  templateId: string;
  audience: string;
  targetCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  status: 'Scheduled' | 'Sending' | 'Sent';
  scheduledTime: string;
  branchId: BranchId;
}

export interface WhatsAppLog {
  id: string;
  recipientName: string;
  phone: string;
  messageType: 'Appointment Reminder' | 'Promotion Broadcast' | 'Invoice Delivery' | 'Incoming Reply';
  messagePreview: string;
  direction: 'outbound' | 'inbound';
  status: WhatsAppStatus;
  timestamp: string;
  patientReply?: string;
}

export interface CartItem {
  type: 'item' | 'service';
  id: string;
  skuOrCode: string;
  name: string;
  unitPrice: number;
  quantity: number;
  vatRate: number;
  discount: number; // USD discount per line
}

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  branchId: Exclude<BranchId, 'all'>;
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  wholesaleSubtype?: WholesaleSubtype;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  promotionCode?: string;
  vatAmount: number;
  total: number;
  paymentMethod: 'Cash' | 'Mobile money' | 'Bank' | 'Credit';
  loyaltyPointsRedeemed: number;
  loyaltyPointsEarned: number;
  cashierName: string;
}
