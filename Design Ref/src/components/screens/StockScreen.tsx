import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  History,
  Layers,
  SlidersHorizontal,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Building2,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { BranchId, Language, StockItem, StockStatus } from '../../types';
import { translations } from '../../i18n/translations';
import { mockStockItems } from '../../data/mockData';
import { StatusPill } from '../common/StatusPill';
import { Drawer } from '../common/Drawer';
import { Modal } from '../common/Modal';

interface StockScreenProps {
  currentBranch: BranchId;
  language: Language;
}

export const StockScreen: React.FC<StockScreenProps> = ({
  currentBranch,
  language,
}) => {
  const t = translations[language];

  const [items, setItems] = useState<StockItem[]>(mockStockItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low-stock' | 'near-expiry' | 'out-of-stock'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Detail drawer
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Adjust stock modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustReason, setAdjustReason] = useState<
    'Count reconciliation' | 'Damage' | 'Expired batch' | 'Returned to vendor'
  >('Count reconciliation');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState('');

  // Categories list
  const categories = ['all', 'Restorative', 'Consumables', 'Anesthetics', 'Hygiene', 'Cosmetic', 'Prosthodontics'];

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const branchQty =
        currentBranch === 'all'
          ? Object.values(item.branchQuantities).reduce((a, b) => a + b, 0)
          : item.branchQuantities[currentBranch] || 0;

      // Status check
      let matchesStatus = true;
      if (statusFilter === 'out-of-stock') {
        matchesStatus = branchQty === 0;
      } else if (statusFilter === 'low-stock') {
        matchesStatus = branchQty > 0 && branchQty <= item.reorderLevel;
      } else if (statusFilter === 'near-expiry') {
        matchesStatus = item.nearestExpiry <= '2026-12-31';
      }

      // Category check
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      // Search check
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.batches.some((b) => b.batchNumber.toLowerCase().includes(query));

      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [items, currentBranch, statusFilter, categoryFilter, searchQuery]);

  const getItemStatusVariant = (qty: number, reorderLevel: number, nearestExpiry: string) => {
    if (qty === 0) return 'out-of-stock';
    if (nearestExpiry <= '2026-11-30') return 'near-expiry';
    if (qty <= reorderLevel) return 'low-stock';
    return 'in-stock';
  };

  const handleOpenDetail = (item: StockItem) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const handleApplyAdjustment = () => {
    if (!selectedItem) return;

    const branchKey = currentBranch === 'all' ? 'main' : currentBranch;
    const currentQty = selectedItem.branchQuantities[branchKey] || 0;
    const newQty = Math.max(0, currentQty + adjustQuantity);

    const updatedItem: StockItem = {
      ...selectedItem,
      branchQuantities: {
        ...selectedItem.branchQuantities,
        [branchKey]: newQty,
      },
      movements: [
        {
          id: `m-adj-${Date.now()}`,
          date: '2026-10-13 14:45',
          type: 'adjustment',
          quantity: adjustQuantity,
          previousQty: currentQty,
          newQty: newQty,
          reference: `ADJ-${Date.now().toString().slice(-4)}`,
          user: 'Storekeeper / Auditor',
          notes: `${adjustReason}: ${adjustNotes}`,
        },
        ...selectedItem.movements,
      ],
    };

    setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? updatedItem : i)));
    setSelectedItem(updatedItem);
    setIsAdjustModalOpen(false);
    setAdjustQuantity(0);
    setAdjustNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.stock.title}
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Batch tracking, real-time branch quantities, expiry control and movement ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (items.length > 0) {
                setSelectedItem(items[0]);
                setIsAdjustModalOpen(true);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t.stock.adjustStock}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white dark:bg-[#0F2830] p-4 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
        {/* Search Input */}
        <div className="md:col-span-5 relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#536E75] dark:text-[#8AA4A0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.stock.searchPlaceholder}
            className="w-full h-10 ps-9 pe-3 text-xs bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#12A6A0]/40 text-[#10262D] dark:text-[#E8F2F0]"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: t.stock.filterAll },
            { id: 'low-stock', label: t.stock.filterLowStock },
            { id: 'near-expiry', label: t.stock.filterNearExpiry },
            { id: 'out-of-stock', label: t.stock.filterOutOfStock },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-2.5 py-2 rounded-[6px] text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === f.id
                  ? 'bg-[#0C3B4A] dark:bg-[#2CC7BF] text-white dark:text-[#08191F]'
                  : 'bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category Select */}
        <div className="md:col-span-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#12A6A0]/40 text-[#10262D] dark:text-[#E8F2F0]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                <th className="py-3 px-4 text-start">{t.stock.sku}</th>
                <th className="py-3 px-4 text-start">{t.stock.name}</th>
                <th className="py-3 px-4 text-start">{t.stock.category}</th>
                <th className="py-3 px-4 text-end">{t.stock.branchQty}</th>
                <th className="py-3 px-4 text-end">{t.stock.reorderLevel}</th>
                <th className="py-3 px-4 text-center">{t.stock.status}</th>
                <th className="py-3 px-4 text-end">{t.stock.nearestExpiry}</th>
                <th className="py-3 px-4 text-center">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#536E75] dark:text-[#8AA4A0]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-[#E0A100]" />
                      <p className="text-xs font-semibold">No stock items match your criteria.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setCategoryFilter('all');
                        }}
                        className="text-xs text-[#12A6A0] hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const qty =
                    currentBranch === 'all'
                      ? Object.values(item.branchQuantities).reduce((a, b) => a + b, 0)
                      : item.branchQuantities[currentBranch] || 0;

                  const variant = getItemStatusVariant(qty, item.reorderLevel, item.nearestExpiry);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenDetail(item)}
                      className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-[#536E75] dark:text-[#8AA4A0] whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#10262D] dark:text-[#E8F2F0]">
                        <span className="group-hover:text-[#12A6A0] transition-colors">
                          {item.name}
                        </span>
                        <div className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] font-normal">
                          {item.batches.length} active batches · {item.unit}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-[#EEF4F3] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] font-medium text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-end font-mono tabular-nums font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                        {qty}
                      </td>
                      <td className="py-3.5 px-4 text-end font-mono tabular-nums text-[#536E75] dark:text-[#8AA4A0]">
                        {item.reorderLevel}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusPill variant={variant} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-end font-mono tabular-nums text-[#536E75] dark:text-[#8AA4A0]">
                        {item.nearestExpiry}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(item);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#0C3B4A] dark:text-[#2CC7BF] bg-[#F4F8F7] dark:bg-[#143540] hover:bg-[#12A6A0]/15 rounded-[6px] border border-[#DDE7E5] dark:border-[#1A4452] transition-colors"
                        >
                          {t.common.viewDetails}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table summary bar */}
        <div className="p-3 border-t border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#0A2027] flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
          <span>
            Showing <strong className="font-mono">{filteredItems.length}</strong> of{' '}
            <strong className="font-mono">{items.length}</strong> clinical items
          </span>
          <span className="font-mono">Branch: {currentBranch.toUpperCase()}</span>
        </div>
      </div>

      {/* Item Detail Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedItem?.name || 'Item Details'}
        subtitle={`SKU: ${selectedItem?.sku} · Category: ${selectedItem?.category}`}
        width="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75] hover:text-[#10262D]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Adjust Stock Quantity
            </button>
          </div>
        }
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px]">
              <div>
                <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold">
                  Retail Price
                </span>
                <p className="font-mono font-bold text-sm text-[#0C3B4A] dark:text-[#2CC7BF]">
                  ${selectedItem.retailPrice.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold">
                  Wholesale Price
                </span>
                <p className="font-mono font-bold text-sm text-[#0C3B4A] dark:text-[#2CC7BF]">
                  ${selectedItem.wholesalePrice.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold">
                  Avg Cost Price
                </span>
                <p className="font-mono font-bold text-sm text-[#536E75] dark:text-[#8AA4A0]">
                  ${selectedItem.costPrice.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Branch Quantities Matrix */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#12A6A0]" />
                Branch Stock Distribution
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(selectedItem.branchQuantities).map(([branch, count]) => (
                  <div
                    key={branch}
                    className="p-2.5 rounded-[8px] border border-[#DDE7E5] dark:border-[#1A4452] bg-white dark:bg-[#0A2027] text-xs"
                  >
                    <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] capitalize">
                      {branch.replace('-', ' ')}
                    </span>
                    <p className="font-mono font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-0.5">
                      {count} units
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Batches Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#12A6A0]" />
                {t.stock.batches} ({selectedItem.batches.length})
              </h4>
              <div className="border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3 text-start">{t.stock.batchNumber}</th>
                      <th className="py-2 px-3 text-end">Quantity</th>
                      <th className="py-2 px-3 text-end">{t.stock.unitCost}</th>
                      <th className="py-2 px-3 text-end">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
                    {selectedItem.batches.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2 px-3 font-mono font-medium">{b.batchNumber}</td>
                        <td className="py-2 px-3 text-end font-mono font-bold">{b.quantity}</td>
                        <td className="py-2 px-3 text-end font-mono">${b.unitCost.toFixed(2)}</td>
                        <td
                          className={`py-2 px-3 text-end font-mono ${
                            b.expiryDate <= '2026-11-30' ? 'text-[#D64545] font-bold' : ''
                          }`}
                        >
                          {b.expiryDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Movement History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0] flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#12A6A0]" />
                {t.stock.movementHistory}
              </h4>
              {selectedItem.movements.length === 0 ? (
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] italic">
                  No movement entries recorded for this item yet.
                </p>
              ) : (
                <div className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                  {selectedItem.movements.map((m) => (
                    <div key={m.id} className="p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#10262D] dark:text-[#E8F2F0] capitalize">
                          {m.type.replace('_', ' ')}
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            m.quantity < 0 ? 'text-[#D64545]' : 'text-[#2E9E6B]'
                          }`}
                        >
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                        <span>{m.user} · Ref: {m.reference}</span>
                        <span className="font-mono">{m.date}</span>
                      </div>
                      {m.notes && (
                        <p className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] italic">
                          "{m.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Adjust Inventory Count"
        subtitle={`Adjusting stock for ${selectedItem?.name || ''}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75] hover:text-[#10262D]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyAdjustment}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              Save Adjustment
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Adjustment Reason
            </label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value as any)}
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] text-[#10262D] dark:text-[#E8F2F0]"
            >
              <option value="Count reconciliation">Count reconciliation (Cycle count)</option>
              <option value="Damage">Damaged in surgery / transit</option>
              <option value="Expired batch">Expired batch disposal</option>
              <option value="Returned to vendor">Returned to supplier</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Quantity Delta (+ to increase, - to decrease)
            </label>
            <input
              type="number"
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
              className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] text-[#10262D] dark:text-[#E8F2F0]"
              placeholder="e.g. -2 or 5"
            />
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Clinical / Auditor Notes
            </label>
            <textarea
              rows={3}
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="Provide reason for physical reconciliation..."
              className="w-full p-2.5 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] text-[#10262D] dark:text-[#E8F2F0]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
