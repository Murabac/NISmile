import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  Search,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';
import { BranchId, Language, StockTransfer, TransferItem } from '../../types';
import { translations } from '../../i18n/translations';
import { mockTransfers, mockStockItems } from '../../data/mockData';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';

interface TransfersScreenProps {
  currentBranch: BranchId;
  language: Language;
}

export const TransfersScreen: React.FC<TransfersScreenProps> = ({
  currentBranch,
  language,
}) => {
  const t = translations[language];

  const [transfers, setTransfers] = useState<StockTransfer[]>(mockTransfers);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Create Transfer Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sourceBranch, setSourceBranch] = useState<'main' | 'hargeisa-north' | 'burao'>('main');
  const [destBranch, setDestBranch] = useState<'main' | 'hargeisa-north' | 'burao'>('hargeisa-north');
  const [selectedItemId, setSelectedItemId] = useState(mockStockItems[0].id);
  const [transferQty, setTransferQty] = useState(10);
  const [transferNotes, setTransferNotes] = useState('');

  // Receive Transfer Modal
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receivedCounts, setReceivedCounts] = useState<Record<string, number>>({});

  const filteredTransfers = transfers.filter((tr) => {
    if (currentBranch === 'all') return true;
    return tr.sourceBranch === currentBranch || tr.destinationBranch === currentBranch;
  });

  const handleCreateTransfer = () => {
    const item = mockStockItems.find((i) => i.id === selectedItemId) || mockStockItems[0];
    const newTransfer: StockTransfer = {
      id: `trf-${Date.now()}`,
      transferNumber: `TRF-2026-0${Math.floor(80 + Math.random() * 20)}`,
      sourceBranch,
      destinationBranch: destBranch,
      createdAt: '2026-10-13 14:50',
      dispatchedAt: '2026-10-13 15:00',
      status: 'In transit',
      initiatedBy: 'Dr. Sahra Awale',
      notes: transferNotes || 'Inter-branch replenishment dispatch',
      items: [
        {
          itemId: item.id,
          sku: item.sku,
          itemName: item.name,
          quantityRequested: transferQty,
          batchNumber: item.batches[0]?.batchNumber || 'CMP-2024-88A',
        },
      ],
    };

    setTransfers([newTransfer, ...transfers]);
    setIsCreateOpen(false);
    setTransferNotes('');
  };

  const handleOpenReceive = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    const initialCounts: Record<string, number> = {};
    transfer.items.forEach((it) => {
      initialCounts[it.itemId] = it.quantityRequested;
    });
    setReceivedCounts(initialCounts);
    setIsReceiveOpen(true);
  };

  const handleConfirmReceive = () => {
    if (!selectedTransfer) return;

    const updated = transfers.map((tr) => {
      if (tr.id === selectedTransfer.id) {
        return {
          ...tr,
          status: 'Received' as const,
          receivedAt: '2026-10-13 15:10',
          items: tr.items.map((it) => ({
            ...it,
            quantityReceived: receivedCounts[it.itemId] ?? it.quantityRequested,
          })),
        };
      }
      return tr;
    });

    setTransfers(updated);
    setIsReceiveOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.transfers}
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Branch-to-branch supply chain manifests, in-transit dispatch, and receiving audits
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Transfers Table */}
      <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                <th className="py-3 px-4 text-start">Transfer #</th>
                <th className="py-3 px-4 text-start">Origin Branch</th>
                <th className="py-3 px-4 text-start">Destination</th>
                <th className="py-3 px-4 text-start">Items</th>
                <th className="py-3 px-4 text-start">Initiated By</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-end">Dispatch Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
              {filteredTransfers.map((tr) => (
                <tr key={tr.id} className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                    {tr.transferNumber}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#10262D] dark:text-[#E8F2F0] capitalize">
                    {tr.sourceBranch.replace('-', ' ')}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#10262D] dark:text-[#E8F2F0] capitalize">
                    {tr.destinationBranch.replace('-', ' ')}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[#10262D] dark:text-[#E8F2F0]">
                      {tr.items.length} line items
                    </span>
                    <p className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] truncate max-w-xs">
                      {tr.items.map((i) => `${i.itemName} (${i.quantityRequested})`).join(', ')}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-[#536E75] dark:text-[#8AA4A0]">
                    {tr.initiatedBy}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusPill
                      variant={
                        tr.status === 'Received'
                          ? 'received'
                          : tr.status === 'In transit'
                          ? 'in-transit'
                          : 'draft'
                      }
                      size="sm"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-end font-mono text-[#536E75] dark:text-[#8AA4A0]">
                    {tr.createdAt}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {tr.status === 'In transit' ? (
                      <button
                        type="button"
                        onClick={() => handleOpenReceive(tr)}
                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#12A6A0] hover:bg-[#0C3B4A] rounded-[6px] transition-colors"
                      >
                        Receive Goods
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-[#536E75] dark:text-[#8AA4A0]">
                        Completed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Transfer Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Dispatch Branch Stock Transfer"
        subtitle="Initiate inter-clinic supply movement with inventory decrement"
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
              onClick={handleCreateTransfer}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              Dispatch Transfer
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Dispatch Source Branch
              </label>
              <select
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="main">Main Clinic (Central)</option>
                <option value="hargeisa-north">Hargeisa North</option>
                <option value="burao">Burao Branch</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Receiving Destination Branch
              </label>
              <select
                value={destBranch}
                onChange={(e) => setDestBranch(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="hargeisa-north">Hargeisa North</option>
                <option value="burao">Burao Branch</option>
                <option value="main">Main Clinic (Central)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Select Item to Transfer
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            >
              {mockStockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku}) · Available: {item.branchQuantities[sourceBranch] || 0}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Transfer Quantity
            </label>
            <input
              type="number"
              min={1}
              value={transferQty}
              onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Transfer Reason & Notes
            </label>
            <input
              type="text"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="e.g. Urgent anesthesia restock for wisdom tooth procedures"
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>
        </div>
      </Modal>

      {/* Receive Screen Modal */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Receive & Inspect Stock Transfer"
        subtitle={`Verifying manifest #${selectedTransfer?.transferNumber || ''}`}
        maxWidth="lg"
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
              Confirm Received Stock
            </button>
          </div>
        }
      >
        {selectedTransfer && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#536E75] dark:text-[#8AA4A0]">From:</span>
                <span className="font-bold capitalize">{selectedTransfer.sourceBranch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#536E75] dark:text-[#8AA4A0]">To:</span>
                <span className="font-bold capitalize">{selectedTransfer.destinationBranch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#536E75] dark:text-[#8AA4A0]">Dispatched:</span>
                <span className="font-mono">{selectedTransfer.createdAt}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] mb-2">
                Line Items Audit & Count Verification
              </h4>
              <div className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                {selectedTransfer.items.map((it) => (
                  <div key={it.itemId} className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-[#10262D] dark:text-[#E8F2F0]">
                        {it.itemName}
                      </p>
                      <p className="font-mono text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                        SKU: {it.sku} · Batch: {it.batchNumber}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#536E75]">Dispatched: {it.quantityRequested}</span>
                      <div className="flex items-center gap-1">
                        <label className="text-[11px] font-bold">Received:</label>
                        <input
                          type="number"
                          value={receivedCounts[it.itemId] ?? it.quantityRequested}
                          onChange={(e) =>
                            setReceivedCounts({
                              ...receivedCounts,
                              [it.itemId]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-16 h-8 text-center font-mono font-bold bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
