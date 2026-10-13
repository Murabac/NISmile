import React, { useState } from 'react';
import {
  Truck,
  Plus,
  PackagePlus,
  CheckCircle2,
  Calendar,
  Building,
  DollarSign,
  Search,
} from 'lucide-react';
import { BranchId, Language, PurchaseOrder, PurchaseOrderItem } from '../../types';
import { translations } from '../../i18n/translations';
import { mockPurchases, mockStockItems } from '../../data/mockData';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';

interface PurchasesScreenProps {
  currentBranch: BranchId;
  language: Language;
}

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({
  currentBranch,
  language,
}) => {
  const t = translations[language];

  const [orders, setOrders] = useState<PurchaseOrder[]>(mockPurchases);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Create Order Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('Gulf Dental Supplies Dubai');
  const [poBranch, setPoBranch] = useState<'main' | 'hargeisa-north' | 'burao'>('main');
  const [selectedItemId, setSelectedItemId] = useState(mockStockItems[0].id);
  const [orderQty, setOrderQty] = useState(50);
  const [unitCost, setUnitCost] = useState(14.2);

  // Receive Goods Modal
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receivedBatchNumber, setReceivedBatchNumber] = useState('BATCH-2026-X99');
  const [receivedExpiryDate, setReceivedExpiryDate] = useState('2028-06-30');

  const filteredOrders = orders.filter((po) => {
    if (currentBranch === 'all') return true;
    return po.branchId === currentBranch;
  });

  const handleCreateOrder = () => {
    const item = mockStockItems.find((i) => i.id === selectedItemId) || mockStockItems[0];
    const sub = orderQty * unitCost;
    const tax = sub * 0.05;
    const total = sub + tax;

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-9${Math.floor(500 + Math.random() * 500)}`,
      supplier: supplierName,
      branchId: poBranch,
      orderDate: '2026-10-13',
      expectedDate: '2026-10-24',
      status: 'Ordered',
      paymentTerms: 'Net 30 Days',
      subtotal: sub,
      tax,
      total,
      items: [
        {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          quantity: orderQty,
          unitCost,
          totalCost: sub,
        },
      ],
    };

    setOrders([newPO, ...orders]);
    setIsCreateOpen(false);
  };

  const handleOpenReceive = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsReceiveOpen(true);
  };

  const handleConfirmReceive = () => {
    if (!selectedOrder) return;

    const updated = orders.map((po) => {
      if (po.id === selectedOrder.id) {
        return {
          ...po,
          status: 'Received' as const,
          receivedDate: '2026-10-13',
          items: po.items.map((it) => ({
            ...it,
            receivedQty: it.quantity,
            receivedBatchNumber,
            receivedExpiryDate,
          })),
        };
      }
      return po;
    });

    setOrders(updated);
    setIsReceiveOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.purchases}
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Supplier procurement orders, batch intake and goods receiving with expiry indexing
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                <th className="py-3 px-4 text-start">PO Number</th>
                <th className="py-3 px-4 text-start">Supplier</th>
                <th className="py-3 px-4 text-start">Branch</th>
                <th className="py-3 px-4 text-start">Items Ordered</th>
                <th className="py-3 px-4 text-end">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-end">Order Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
              {filteredOrders.map((po) => (
                <tr key={po.id} className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                    {po.poNumber}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#10262D] dark:text-[#E8F2F0]">
                    {po.supplier}
                  </td>
                  <td className="py-3.5 px-4 text-[#536E75] dark:text-[#8AA4A0] capitalize">
                    {po.branchId.replace('-', ' ')}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[#10262D] dark:text-[#E8F2F0]">
                      {po.items.length} product lines
                    </span>
                    <p className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] truncate max-w-xs">
                      {po.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-end font-mono tabular-nums font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                    ${po.total.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusPill
                      variant={po.status === 'Received' ? 'received' : po.status === 'Ordered' ? 'scheduled' : 'draft'}
                      label={po.status}
                      size="sm"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-end font-mono text-[#536E75] dark:text-[#8AA4A0]">
                    {po.orderDate}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {po.status === 'Ordered' ? (
                      <button
                        type="button"
                        onClick={() => handleOpenReceive(po)}
                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#12A6A0] hover:bg-[#0C3B4A] rounded-[6px] transition-colors"
                      >
                        Receive Goods
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                        Received
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Purchase Order"
        subtitle="Issue vendor order with payment terms and expected delivery"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateOrder}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              Issue Order
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Supplier
              </label>
              <select
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="Gulf Dental Supplies Dubai">Gulf Dental Supplies Dubai</option>
                <option value="MedSupply Horn of Africa">MedSupply Horn of Africa</option>
                <option value="East Africa Pharma Ltd">East Africa Pharma Ltd</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Destination Clinic Branch
              </label>
              <select
                value={poBranch}
                onChange={(e) => setPoBranch(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="main">Main Clinic (Central)</option>
                <option value="hargeisa-north">Hargeisa North</option>
                <option value="burao">Burao Branch</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Clinical Item
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                const item = mockStockItems.find((i) => i.id === e.target.value);
                if (item) setUnitCost(item.costPrice);
              }}
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            >
              {mockStockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Order Quantity
              </label>
              <input
                type="number"
                min={1}
                value={orderQty}
                onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Unit Cost (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Receive Goods with Batch & Expiry inputs */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Receive Goods & Batch Registration"
        subtitle={`Entering inventory for PO #${selectedOrder?.poNumber || ''}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsReceiveOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReceive}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#12A6A0] text-white hover:bg-[#0C3B4A] transition-colors"
            >
              Commit to Inventory
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#536E75] dark:text-[#8AA4A0]">
            Input the manufacturer batch code and expiration printed on the packaging to index for FIFO tracking.
          </p>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Manufacturer Batch Number *
            </label>
            <input
              type="text"
              value={receivedBatchNumber}
              onChange={(e) => setReceivedBatchNumber(e.target.value)}
              placeholder="e.g. LOT-2026-99A"
              className="w-full h-10 px-3 font-mono font-bold bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Expiration Date *
            </label>
            <input
              type="date"
              value={receivedExpiryDate}
              onChange={(e) => setReceivedExpiryDate(e.target.value)}
              className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
