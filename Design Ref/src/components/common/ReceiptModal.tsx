import React from 'react';
import { Printer, Download, Share2, Check, X } from 'lucide-react';
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

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: SaleTransaction | null;
  onSendWhatsApp?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
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
      title="Point of Sale Receipt"
      subtitle={`Receipt #${transaction.receiptNumber}`}
      maxWidth="md"
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
                WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
          </div>
        </div>
      }
    >
      {/* Thermal receipt style card */}
      <div className="p-6 bg-white border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] text-[#10262D] shadow-sm max-w-sm mx-auto font-mono text-xs">
        {/* Header */}
        <div className="text-center pb-4 border-b border-dashed border-[#B0C6C2] space-y-1">
          <div className="flex justify-center mb-1">
            <img
              src={CLINIC_LOGO_SRC}
              alt={CLINIC_MARK_NAME}
              className="h-16 w-16 object-contain"
            />
          </div>
          <p className="font-bold text-sm tracking-wide text-[#0C3B4A]">
            {CLINIC_LEGAL_NAME}
          </p>
          <p className="text-[11px] text-neutral-600">{CLINIC_ADDRESS}</p>
          <p className="text-[11px] text-neutral-600">Tel: {CLINIC_PHONE}</p>
          <p className="text-[10px] text-neutral-500 pt-1">Tax ID: {CLINIC_TAX_ID}</p>
        </div>

        {/* Meta */}
        <div className="py-3 border-b border-dashed border-[#B0C6C2] space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-neutral-500">Receipt No:</span>
            <span className="font-bold">{transaction.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Date & Time:</span>
            <span>{transaction.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Cashier:</span>
            <span>{transaction.cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Customer:</span>
            <span className="font-semibold">{transaction.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Payment Type:</span>
            <span className="font-semibold">{transaction.paymentMethod}</span>
          </div>
        </div>

        {/* Line Items */}
        <div className="py-3 border-b border-dashed border-[#B0C6C2] space-y-2">
          <div className="flex justify-between font-bold text-[10px] uppercase text-neutral-500 pb-1">
            <span>Item / Qty</span>
            <span>Price</span>
            <span>Total</span>
          </div>
          {transaction.items.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex justify-between font-medium">
                <span className="truncate max-w-[170px]">{item.name}</span>
                <span className="tabular-nums font-bold">
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>
                  {item.quantity} x ${item.unitPrice.toFixed(2)}
                </span>
                <span className="text-[9px] uppercase">{item.skuOrCode}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Calculation */}
        <div className="py-3 border-b border-dashed border-[#B0C6C2] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-600">Subtotal</span>
            <span className="tabular-nums">${transaction.subtotal.toFixed(2)}</span>
          </div>

          {transaction.discount > 0 && (
            <div className="flex justify-between text-[#FF6B57] font-semibold">
              <span>
                Discount / Promo{' '}
                {transaction.promotionCode ? `(${transaction.promotionCode})` : ''}
              </span>
              <span className="tabular-nums">-${transaction.discount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-neutral-600">
            <span>VAT (5.0%)</span>
            <span className="tabular-nums">${transaction.vatAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-base font-bold text-[#0C3B4A] pt-2 border-t border-neutral-300">
            <span>TOTAL PAID</span>
            <span className="tabular-nums">${transaction.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Loyalty & Footer */}
        <div className="pt-3 text-center space-y-2">
          {transaction.loyaltyPointsEarned > 0 && (
            <div className="bg-[#12A6A0]/10 p-2 rounded text-[11px] text-[#0C3B4A]">
              Earned <span className="font-bold">+{transaction.loyaltyPointsEarned}</span> Loyalty Points today!
            </div>
          )}
          <div className="text-[10px] text-neutral-600 space-y-0.5">
            <p>Zaad: {CLINIC_ZAAD}</p>
            <p>eDahab: {CLINIC_EDAHAB}</p>
            <p>MyCash (Amal Bank): {CLINIC_MYCASH}</p>
          </div>
          <p className="text-[10px] text-neutral-500">
            Thank you for trusting {CLINIC_LEGAL_NAME}.
          </p>
          <div className="pt-2 flex justify-center">
            {/* Simulated barcode */}
            <div className="flex items-center gap-0.5 h-7">
              {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 2, 3, 1, 2, 3, 1, 4, 2, 1, 3].map(
                (w, i) => (
                  <span
                    key={i}
                    className="bg-neutral-800 h-full inline-block"
                    style={{ width: `${w}px` }}
                  />
                )
              )}
            </div>
          </div>
          <p className="text-[9px] text-neutral-400">
            {transaction.receiptNumber}
          </p>
        </div>
      </div>
    </Modal>
  );
};
