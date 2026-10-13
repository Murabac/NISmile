import React from 'react';
import { Printer, Download, Share2, Building2, Phone, Mail } from 'lucide-react';
import { SaleTransaction } from '../../types';
import {
  CLINIC_ADDRESS,
  CLINIC_EDAHAB,
  CLINIC_LEGAL_NAME,
  CLINIC_LOGO_SRC,
  CLINIC_MARK_NAME,
  CLINIC_MYCASH,
  CLINIC_PHONE,
  CLINIC_TAX_ID,
  CLINIC_ZAAD,
} from '../../data/clinic';
import { Modal } from './Modal';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: SaleTransaction | null;
  onSendWhatsApp?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSendWhatsApp,
}) => {
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Commercial Tax Invoice (A4 Format)"
      subtitle={`Tax Invoice #${transaction.receiptNumber.replace('RCP', 'INV')}`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-[#536E75] hover:text-[#10262D] rounded-[8px]"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {onSendWhatsApp && (
              <button
                type="button"
                onClick={onSendWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[8px] bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF] hover:bg-[#12A6A0]/25 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Send PDF on WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>
      }
    >
      {/* A4 Document sheet preview */}
      <div className="p-8 bg-white text-[#10262D] border border-[#DDE7E5] rounded-[8px] shadow-sm max-w-2xl mx-auto space-y-6 text-sm">
        {/* Letterhead Header */}
        <div className="flex items-start justify-between pb-6 border-b border-[#DDE7E5]">
          <div>
            <img
              src={CLINIC_LOGO_SRC}
              alt={CLINIC_MARK_NAME}
              className="h-24 w-24 object-contain"
            />
            <div className="mt-3 text-xs text-[#536E75] space-y-0.5">
              <p className="font-semibold text-[#10262D]">{CLINIC_LEGAL_NAME}</p>
              <p>{CLINIC_ADDRESS}</p>
              <p>Tel: {CLINIC_PHONE}</p>
              <p>Tax ID: <span className="font-mono">{CLINIC_TAX_ID}</span></p>
            </div>
          </div>
          <div className="text-end">
            <h2 className="font-display text-2xl font-black text-[#0C3B4A] tracking-tight">
              TAX INVOICE
            </h2>
            <p className="font-mono text-xs font-bold text-[#12A6A0] mt-1">
              #{transaction.receiptNumber.replace('RCP', 'INV')}
            </p>
            <div className="mt-3 text-xs text-[#536E75] space-y-0.5">
              <p>
                Date: <span className="font-mono text-[#10262D]">{transaction.date}</span>
              </p>
              <p>
                Due: <span className="font-mono text-[#10262D]">Due on Receipt</span>
              </p>
              <p>
                Status:{' '}
                <span className="font-semibold text-[#2E9E6B]">
                  PAID ({transaction.paymentMethod})
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="grid grid-cols-2 gap-6 bg-[#F4F8F7] p-4 rounded-[8px] text-xs">
          <div>
            <span className="font-bold text-[#536E75] uppercase text-[10px] tracking-wider">
              Billed To
            </span>
            <p className="font-bold text-sm text-[#0C3B4A] mt-1">
              {transaction.customerName}
            </p>
            <p className="text-[#536E75] mt-0.5">
              Category: {transaction.customerType === 'wholesale' ? 'Wholesale Partner' : 'Retail Patient'}
            </p>
            {transaction.wholesaleSubtype && (
              <p className="text-[#536E75]">Subtype: {transaction.wholesaleSubtype}</p>
            )}
          </div>
          <div>
            <span className="font-bold text-[#536E75] uppercase text-[10px] tracking-wider">
              Issued By / Operating Branch
            </span>
            <p className="font-bold text-sm text-[#0C3B4A] mt-1">
              {CLINIC_LEGAL_NAME}
            </p>
            <p className="text-[#536E75] mt-0.5">
              Attending Officer: {transaction.cashierName}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#DDE7E5] text-[#536E75] uppercase text-[10px] text-start font-semibold">
                <th className="py-2.5 pe-4">Code</th>
                <th className="py-2.5 px-4 text-start">Description</th>
                <th className="py-2.5 px-4 text-end">Rate</th>
                <th className="py-2.5 px-4 text-end">Qty</th>
                <th className="py-2.5 ps-4 text-end">Amount (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F3]">
              {transaction.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F4F8F7]/50">
                  <td className="py-3 pe-4 font-mono font-medium text-[#536E75]">
                    {item.skuOrCode}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#10262D]">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 text-end font-mono tabular-nums text-[#536E75]">
                    ${item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-end font-mono tabular-nums font-semibold">
                    {item.quantity}
                  </td>
                  <td className="py-3 ps-4 text-end font-mono tabular-nums font-bold text-[#0C3B4A]">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end pt-4 border-t border-[#DDE7E5]">
          <div className="w-64 space-y-2 text-xs">
            <div className="flex justify-between text-[#536E75]">
              <span>Subtotal:</span>
              <span className="font-mono tabular-nums">${transaction.subtotal.toFixed(2)}</span>
            </div>

            {transaction.discount > 0 && (
              <div className="flex justify-between text-[#FF6B57] font-semibold">
                <span>
                  Discounts & Promotions{' '}
                  {transaction.promotionCode ? `(${transaction.promotionCode})` : ''}:
                </span>
                <span className="font-mono tabular-nums">-${transaction.discount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-[#536E75]">
              <span>VAT (5.0%):</span>
              <span className="font-mono tabular-nums">${transaction.vatAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-bold text-[#0C3B4A] pt-2 border-t border-[#DDE7E5]">
              <span>Invoice Total:</span>
              <span className="font-mono tabular-nums">${transaction.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Official Banking & Mobile Money Payment Footnote */}
        <div className="pt-4 border-t border-[#DDE7E5] text-[11px] text-[#536E75] space-y-0.5">
          <p className="font-bold text-[#10262D]">Payment</p>
          <p>Cash</p>
          <p>Zaad: <span className="font-mono font-semibold">{CLINIC_ZAAD}</span></p>
          <p>eDahab: <span className="font-mono font-semibold">{CLINIC_EDAHAB}</span></p>
          <p>MyCash (Amal Bank): <span className="font-mono font-semibold">{CLINIC_MYCASH}</span></p>
        </div>
      </div>
    </Modal>
  );
};
