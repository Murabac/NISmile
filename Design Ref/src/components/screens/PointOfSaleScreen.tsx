import React, { useState, useMemo } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  FileText,
  Share2,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Sparkles,
  Percent,
  CheckCircle,
  AlertCircle,
  User,
} from 'lucide-react';
import {
  BranchId,
  CartItem,
  Customer,
  Language,
  SaleTransaction,
  WholesaleSubtype,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  mockStockItems,
  mockDentalServices,
  mockCustomers,
  mockPromotions,
} from '../../data/mockData';
import { ReceiptModal } from '../common/ReceiptModal';
import { InvoiceModal } from '../common/InvoiceModal';

interface PointOfSaleScreenProps {
  currentBranch: BranchId;
  language: Language;
}

export const PointOfSaleScreen: React.FC<PointOfSaleScreenProps> = ({
  currentBranch,
  language,
}) => {
  const t = translations[language];

  // Tab: 'items' or 'services'
  const [activeTab, setActiveTab] = useState<'items' | 'services'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Customer state: default to retail walk-in or first wholesale
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [paymentMethod, setPaymentMethod] = useState<
    'Cash' | 'Mobile money' | 'Bank' | 'Credit'
  >('Cash');
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([
    // Start with 2 sample items to showcase realistic immediate POS state
    {
      type: 'item',
      id: 'item-2',
      skuOrCode: 'CON-GLV-M100',
      name: 'Latex Gloves M (Box of 100)',
      unitPrice: 9.5,
      quantity: 10,
      vatRate: 0.05,
      discount: 0,
    },
    {
      type: 'service',
      id: 'srv-1',
      skuOrCode: 'SRV-CLN-01',
      name: 'Ultrasonic Scaling & Polishing (Cleaning)',
      unitPrice: 45.0,
      quantity: 1,
      vatRate: 0.05,
      discount: 0,
    },
  ]);

  // Modal previews
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<SaleTransaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active customer object
  const currentCustomer = useMemo(() => {
    if (selectedCustomerId === 'walk-in') {
      return {
        id: 'walk-in',
        name: t.pos.walkInCustomer,
        type: 'retail' as const,
        phone: '+252 63 4401200',
        email: 'walkin@dentaflow.so',
        preferredLanguage: language,
        optInWhatsApp: true,
        branchId: 'main' as const,
        loyaltyPoints: 0,
        creditLimit: 0,
        currentBalance: 0,
        createdAt: '2026-10-13',
        lastVisit: '2026-10-13',
        totalSpent: 0,
      } as Customer;
    }
    return mockCustomers.find((c) => c.id === selectedCustomerId) || mockCustomers[0];
  }, [selectedCustomerId, language, t]);

  const isWholesale = currentCustomer.type === 'wholesale';

  // Categories for filtering
  const itemCategories = ['all', 'Restorative', 'Consumables', 'Anesthetics', 'Hygiene', 'Cosmetic', 'Prosthodontics'];
  const serviceCategories = ['all', 'Hygiene', 'Restorative', 'Surgery', 'Endodontics', 'Cosmetic', 'Diagnostic'];

  // Filtered items & services
  const filteredItems = useMemo(() => {
    return mockStockItems.filter((i) => {
      const matchesSearch =
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || i.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, selectedCategory]);

  const filteredServices = useMemo(() => {
    return mockDentalServices.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, selectedCategory]);

  // Add item or service to cart
  const addToCart = (type: 'item' | 'service', id: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === id && item.type === type);
      if (existing) {
        return prev.map((item) =>
          item.id === id && item.type === type
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      if (type === 'item') {
        const product = mockStockItems.find((p) => p.id === id);
        if (!product) return prev;
        const price = isWholesale ? product.wholesalePrice : product.retailPrice;
        return [
          ...prev,
          {
            type: 'item',
            id: product.id,
            skuOrCode: product.sku,
            name: product.name,
            unitPrice: price,
            quantity: 1,
            vatRate: product.vatRate,
            discount: 0,
          },
        ];
      } else {
        const service = mockDentalServices.find((s) => s.id === id);
        if (!service) return prev;
        const price = isWholesale ? service.wholesalePrice : service.retailPrice;
        return [
          ...prev,
          {
            type: 'service',
            id: service.id,
            skuOrCode: service.code,
            name: service.name,
            unitPrice: price,
            quantity: 1,
            vatRate: service.vatRate,
            discount: 0,
          },
        ];
      }
    });
  };

  const updateQuantity = (id: string, type: 'item' | 'service', delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id && item.type === type) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (id: string, type: 'item' | 'service') => {
    setCart((prev) => prev.filter((item) => !(item.id === id && item.type === type)));
  };

  // Financial calculations
  // 1. Base subtotal
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [cart]);

  // 2. Automatic Promotion Detection
  // Wholesale Buy 10 Get 1 Free: if customer is wholesale or item qty >= 10
  const promoDiscount = useMemo(() => {
    let discount = 0;
    let promoReason = '';

    // Check Buy 10 Get 1 Free for boxes/items with quantity >= 10
    const bulkItem = cart.find(
      (c) => c.type === 'item' && c.quantity >= 10
    );
    if (bulkItem) {
      // 1 free item value
      discount += bulkItem.unitPrice;
      promoReason = 'Wholesale: Buy 10 boxes, get 1 free';
    }

    // Check Retail Hygiene 15% discount for cleaning service
    if (!isWholesale) {
      const cleaningService = cart.find((c) => c.id === 'srv-1');
      if (cleaningService) {
        discount += cleaningService.unitPrice * cleaningService.quantity * 0.15;
        promoReason = 'Hygiene Month 15% Off Cleaning';
      }
    }

    return { amount: discount, reason: promoReason };
  }, [cart, isWholesale]);

  // 3. Loyalty redemption discount (e.g. 200 pts = $10.00 discount)
  const loyaltyDiscount = useMemo(() => {
    if (redeemLoyalty && currentCustomer.loyaltyPoints >= 100) {
      // 100 points = $5.00
      const redeemablePoints = Math.min(currentCustomer.loyaltyPoints, 400);
      return (redeemablePoints / 100) * 5.0;
    }
    return 0;
  }, [redeemLoyalty, currentCustomer]);

  const totalDiscount = promoDiscount.amount + loyaltyDiscount;

  // 4. VAT calculation (5%)
  const vatRate = 0.05;
  const taxableBase = Math.max(0, subtotal - totalDiscount);
  const vatAmount = taxableBase * vatRate;

  // 5. Total due
  const total = taxableBase + vatAmount;

  // Checkout submission
  const handleCheckout = () => {
    if (cart.length === 0) return;

    const newTx: SaleTransaction = {
      id: `tx-${Date.now()}`,
      receiptNumber: `RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      branchId: currentBranch === 'all' ? 'main' : currentBranch,
      customerId: currentCustomer.id,
      customerName: currentCustomer.name,
      customerType: currentCustomer.type,
      wholesaleSubtype: currentCustomer.wholesaleSubtype,
      date: '2026-10-13 14:15',
      items: [...cart],
      subtotal,
      discount: totalDiscount,
      promotionCode: promoDiscount.amount > 0 ? 'WS-BOX10-FREE1' : undefined,
      vatAmount,
      total,
      paymentMethod,
      loyaltyPointsRedeemed: redeemLoyalty ? 200 : 0,
      loyaltyPointsEarned: Math.floor(total * 0.1),
      cashierName: 'Dr. Sahra Awale',
    };

    setLastTransaction(newTx);
    setIsReceiptOpen(true);
    showToast('Transaction finalized successfully! Receipt generated.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendWhatsApp = () => {
    showToast(
      `Receipt & treatment invoice dispatched via WhatsApp to ${currentCustomer.phone}!`
    );
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#0C3B4A] text-white rounded-[10px] shadow-2xl border border-[#12A6A0] text-xs font-medium animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-[#12A6A0]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* POS Two-Column Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Catalog (7 Cols on desktop) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] p-4 space-y-4 shadow-xs">
          {/* Barcode & Search Input - min 40px touch height */}
          <div className="relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#536E75] dark:text-[#8AA4A0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.pos.searchPlaceholder}
              className="w-full h-11 ps-10 pe-12 text-sm bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#12A6A0]/40 text-[#10262D] dark:text-[#E8F2F0]"
            />
            <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#536E75] dark:text-[#8AA4A0]">
              <Barcode className="w-5 h-5" />
            </div>
          </div>

          {/* Catalog Tabs: Items vs Services */}
          <div className="flex items-center justify-between gap-2 border-b border-[#DDE7E5] dark:border-[#1A4452] pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('items');
                  setSelectedCategory('all');
                }}
                className={`h-10 px-4 text-xs font-bold rounded-[8px] transition-colors ${
                  activeTab === 'items'
                    ? 'bg-[#0C3B4A] dark:bg-[#2CC7BF] text-white dark:text-[#08191F]'
                    : 'bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
                }`}
              >
                {t.pos.itemsTab} ({mockStockItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('services');
                  setSelectedCategory('all');
                }}
                className={`h-10 px-4 text-xs font-bold rounded-[8px] transition-colors ${
                  activeTab === 'services'
                    ? 'bg-[#0C3B4A] dark:bg-[#2CC7BF] text-white dark:text-[#08191F]'
                    : 'bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
                }`}
              >
                {t.pos.servicesTab} ({mockDentalServices.length})
              </button>
            </div>

            <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] hidden sm:inline">
              Tap any card to add to counter cart
            </span>
          </div>

          {/* Horizontal Category Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {(activeTab === 'items' ? itemCategories : serviceCategories).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-[6px] whitespace-nowrap text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF] font-bold border border-[#12A6A0]/40'
                    : 'bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] hover:bg-[#DDE7E5]/50'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Grid of Catalog Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pe-1">
            {activeTab === 'items'
              ? filteredItems.map((item) => {
                  const effectiveQty =
                    currentBranch === 'all'
                      ? Object.values(item.branchQuantities).reduce((a, b) => a + b, 0)
                      : item.branchQuantities[currentBranch] || 0;
                  const price = isWholesale ? item.wholesalePrice : item.retailPrice;

                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart('item', item.id)}
                      className="group p-3.5 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] bg-white dark:bg-[#0A2027] hover:border-[#12A6A0] transition-all cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-sm min-h-[110px]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                          <span className="font-mono">{item.sku}</span>
                          <span
                            className={`font-mono text-[10px] font-semibold ${
                              effectiveQty === 0
                                ? 'text-[#D64545]'
                                : effectiveQty <= item.reorderLevel
                                ? 'text-[#E0A100]'
                                : 'text-[#2E9E6B]'
                            }`}
                          >
                            {effectiveQty} in stock
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#10262D] dark:text-[#E8F2F0] leading-snug line-clamp-2 group-hover:text-[#12A6A0]">
                          {item.name}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#EEF4F3] dark:border-[#1A4452]">
                        <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                          {item.unit}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#0C3B4A] dark:text-[#2CC7BF] tabular-nums">
                            ${price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="w-7 h-7 rounded-[6px] bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF] flex items-center justify-center hover:bg-[#12A6A0] hover:text-white transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              : filteredServices.map((srv) => {
                  const price = isWholesale ? srv.wholesalePrice : srv.retailPrice;

                  return (
                    <div
                      key={srv.id}
                      onClick={() => addToCart('service', srv.id)}
                      className="group p-3.5 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] bg-white dark:bg-[#0A2027] hover:border-[#12A6A0] transition-all cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-sm min-h-[110px]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                          <span className="font-mono">{srv.code}</span>
                          <span className="text-[#536E75] font-mono">{srv.durationMinutes} mins</span>
                        </div>
                        <h4 className="text-xs font-bold text-[#10262D] dark:text-[#E8F2F0] leading-snug line-clamp-2 group-hover:text-[#12A6A0]">
                          {srv.name}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#EEF4F3] dark:border-[#1A4452]">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF4F3] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0]">
                          {srv.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#0C3B4A] dark:text-[#2CC7BF] tabular-nums">
                            ${price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="w-7 h-7 rounded-[6px] bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF] flex items-center justify-center hover:bg-[#12A6A0] hover:text-white transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* RIGHT COLUMN: Cart & Checkout (5 Cols on desktop) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] p-5 space-y-4 shadow-xs sticky top-20">
          {/* Customer Selector & Price List Badge */}
          <div className="space-y-2 pb-3 border-b border-[#DDE7E5] dark:border-[#1A4452]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                {t.pos.customerSelect}
              </label>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
                  isWholesale
                    ? 'bg-[#0C3B4A] text-white'
                    : 'bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF]'
                }`}
              >
                {isWholesale ? t.pos.wholesalePriceList : t.pos.retailPriceList}
              </span>
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full h-11 px-3 text-xs bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#12A6A0]/40 font-medium text-[#10262D] dark:text-[#E8F2F0]"
            >
              <option value="walk-in">{t.pos.walkInCustomer}</option>
              <optgroup label="Wholesale Partners">
                {mockCustomers
                  .filter((c) => c.type === 'wholesale')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.wholesaleSubtype}) · Debt: ${c.currentBalance.toFixed(2)}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Registered Retail Patients">
                {mockCustomers
                  .filter((c) => c.type === 'retail')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) · {c.loyaltyPoints} pts
                    </option>
                  ))}
              </optgroup>
            </select>

            {/* Wholesale subtype badge or loyalty points status */}
            {isWholesale && currentCustomer.wholesaleSubtype && (
              <div className="flex items-center justify-between text-[11px] bg-[#EEF4F3] dark:bg-[#143540] p-2 rounded-[6px]">
                <span className="font-semibold text-[#0C3B4A] dark:text-[#2CC7BF]">
                  Category: {currentCustomer.wholesaleSubtype}
                </span>
                <span className="font-mono text-[#536E75] dark:text-[#8AA4A0]">
                  Credit Limit: ${currentCustomer.creditLimit.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pe-1">
            {cart.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#536E75] dark:text-[#8AA4A0] border border-dashed border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                {t.pos.emptyCartMessage}
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between gap-3 p-2.5 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] text-xs"
                >
                  <div className="flex-1 truncate">
                    <p className="font-bold text-[#10262D] dark:text-[#E8F2F0] truncate">
                      {item.name}
                    </p>
                    <p className="font-mono text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                      ${item.unitPrice.toFixed(2)} each
                    </p>
                  </div>

                  {/* Quantity Controls - min 40px touch targets */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.type, -1)}
                      className="w-8 h-8 rounded-[6px] bg-white dark:bg-[#0F2830] border border-[#DDE7E5] dark:border-[#1A4452] flex items-center justify-center text-[#536E75] hover:text-[#10262D] transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono font-bold text-xs tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.type, 1)}
                      className="w-8 h-8 rounded-[6px] bg-white dark:bg-[#0F2830] border border-[#DDE7E5] dark:border-[#1A4452] flex items-center justify-center text-[#536E75] hover:text-[#10262D] transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.type)}
                      className="w-8 h-8 rounded-[6px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors ms-1"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-16 text-end font-mono font-bold text-[#0C3B4A] dark:text-[#2CC7BF] tabular-nums shrink-0">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Automatic Promotion line in Coral (#FF6B57) */}
          {promoDiscount.amount > 0 && (
            <div className="p-2.5 rounded-[8px] bg-[#FF6B57]/15 dark:bg-[#FF7A66]/20 border border-[#FF6B57]/35 flex items-center justify-between text-xs text-[#C93824] dark:text-[#FF9D8E]">
              <div className="flex items-center gap-1.5 font-bold">
                <Percent className="w-4 h-4 text-[#FF6B57]" />
                <span>{promoDiscount.reason}</span>
              </div>
              <span className="font-mono font-bold tabular-nums">
                -${promoDiscount.amount.toFixed(2)}
              </span>
            </div>
          )}

          {/* Loyalty Points Redemption Toggle */}
          {currentCustomer.loyaltyPoints >= 100 && (
            <div className="flex items-center justify-between p-2.5 bg-[#12A6A0]/10 rounded-[8px] text-xs">
              <div className="flex flex-col">
                <span className="font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                  {t.pos.loyaltyPointsToggle}
                </span>
                <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                  {currentCustomer.loyaltyPoints} {t.pos.pointsAvailable} ($
                  {((currentCustomer.loyaltyPoints / 100) * 5).toFixed(2)} value)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={redeemLoyalty}
                  onChange={(e) => setRedeemLoyalty(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#12A6A0]" />
              </label>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-[#DDE7E5] dark:border-[#1A4452] text-xs">
            <div className="flex justify-between text-[#536E75] dark:text-[#8AA4A0]">
              <span>{t.pos.subtotal}</span>
              <span className="font-mono tabular-nums">${subtotal.toFixed(2)}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-[#FF6B57] font-semibold">
                <span>{t.pos.discount}</span>
                <span className="font-mono tabular-nums">-${totalDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-[#536E75] dark:text-[#8AA4A0]">
              <span>{t.pos.vat}</span>
              <span className="font-mono tabular-nums">${vatAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-bold text-[#0C3B4A] dark:text-[#E8F2F0] pt-2 border-t border-[#DDE7E5] dark:border-[#1A4452]">
              <span>{t.pos.total}</span>
              <span className="font-mono tabular-nums text-lg text-[#12A6A0] dark:text-[#2CC7BF]">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector (Touch target >= 40px) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-[#536E75] dark:text-[#8AA4A0]">
              {t.pos.paymentMethod}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Cash', label: t.pos.cash, icon: Banknote },
                { id: 'Mobile money', label: 'Mobile (Zaad)', icon: Smartphone },
                { id: 'Bank', label: 'Bank (Dahabshiil)', icon: Building },
                { id: 'Credit', label: t.pos.credit, icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`h-10 px-2.5 rounded-[8px] text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      isSelected
                        ? 'bg-[#0C3B4A] text-white border-[#0C3B4A] dark:bg-[#2CC7BF] dark:text-[#08191F]'
                        : 'bg-[#F4F8F7] dark:bg-[#143540] border-[#DDE7E5] dark:border-[#1A4452] text-[#10262D] dark:text-[#E8F2F0] hover:border-[#12A6A0]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Checkout Button */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full h-12 rounded-[10px] bg-[#0C3B4A] dark:bg-[#2CC7BF] hover:bg-[#12A6A0] text-white dark:text-[#08191F] font-bold text-sm tracking-wide transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>{t.pos.checkoutNow}</span>
            <span className="font-mono">(${total.toFixed(2)})</span>
          </button>

          {/* Secondary Receipt / Invoice / WhatsApp Actions */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                if (!lastTransaction) handleCheckout();
                else setIsReceiptOpen(true);
              }}
              className="h-10 px-2 rounded-[8px] bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] text-[#0C3B4A] dark:text-[#E8F2F0] hover:border-[#12A6A0] flex items-center justify-center gap-1.5 font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="truncate">Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!lastTransaction) handleCheckout();
                else setIsInvoiceOpen(true);
              }}
              className="h-10 px-2 rounded-[8px] bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] text-[#0C3B4A] dark:text-[#E8F2F0] hover:border-[#12A6A0] flex items-center justify-center gap-1.5 font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate">A4 Invoice</span>
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="h-10 px-2 rounded-[8px] bg-[#12A6A0]/15 border border-[#12A6A0]/30 text-[#0C3B4A] dark:text-[#2CC7BF] hover:bg-[#12A6A0]/25 flex items-center justify-center gap-1.5 font-medium transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="truncate">WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transaction={lastTransaction}
        onSendWhatsApp={handleSendWhatsApp}
      />

      <InvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        transaction={lastTransaction}
        onSendWhatsApp={handleSendWhatsApp}
      />
    </div>
  );
};
