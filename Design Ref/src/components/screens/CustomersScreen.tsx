import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MessageSquare,
  Building,
  CreditCard,
  Printer,
  Calendar,
  DollarSign,
  Award,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import { Customer, CustomerType, Language, WholesaleSubtype } from '../../types';
import { translations } from '../../i18n/translations';
import { mockCustomers } from '../../data/mockData';
import {
  CLINIC_ADDRESS,
  CLINIC_LEGAL_NAME,
  CLINIC_LOGO_SRC,
  CLINIC_MARK_NAME,
  CLINIC_PHONE,
  CLINIC_TAX_ID,
} from '../../data/clinic';
import { Drawer } from '../common/Drawer';
import { Modal } from '../common/Modal';

interface CustomersScreenProps {
  language: Language;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ language }) => {
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<CustomerType>('wholesale');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);

  // Profile Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Statement Modal
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Add Customer Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomerType>('retail');
  const [newWholesaleSubtype, setNewWholesaleSubtype] = useState<WholesaleSubtype>('Clinic');
  const [newPhone, setNewPhone] = useState('+252 63 ');
  const [newEmail, setNewEmail] = useState('');
  const [newLang, setNewLang] = useState<Language>('so');
  const [newCreditLimit, setNewCreditLimit] = useState(3000);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesTab = c.type === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [customers, activeTab, searchQuery]);

  const handleOpenProfile = (c: Customer) => {
    setSelectedCustomer(c);
    setIsDrawerOpen(true);
  };

  const handleCreateCustomer = () => {
    if (!newName) return;
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: newName,
      type: newType,
      wholesaleSubtype: newType === 'wholesale' ? newWholesaleSubtype : undefined,
      phone: newPhone,
      email: newEmail,
      preferredLanguage: newLang,
      optInWhatsApp: true,
      branchId: 'main',
      loyaltyPoints: newType === 'retail' ? 100 : 0,
      creditLimit: newType === 'wholesale' ? newCreditLimit : 0,
      currentBalance: 0,
      createdAt: '2026-10-13',
      lastVisit: '2026-10-13',
      totalSpent: 0,
    };

    setCustomers([newCust, ...customers]);
    setSelectedCustomer(newCust);
    setIsAddOpen(false);
    setNewName('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.customers} & Patient Accounts
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Wholesale B2B accounts with ledger credit lines & retail patients with loyalty points
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0F2830] p-4 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
        {/* Retail vs Wholesale Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px]">
          <button
            type="button"
            onClick={() => setActiveTab('wholesale')}
            className={`px-4 py-1.5 text-xs font-bold rounded-[6px] transition-colors ${
              activeTab === 'wholesale'
                ? 'bg-white dark:bg-[#0F2830] text-[#0C3B4A] dark:text-[#2CC7BF] shadow-xs'
                : 'text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
            }`}
          >
            Wholesale Partners ({customers.filter((c) => c.type === 'wholesale').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('retail')}
            className={`px-4 py-1.5 text-xs font-bold rounded-[6px] transition-colors ${
              activeTab === 'retail'
                ? 'bg-white dark:bg-[#0F2830] text-[#0C3B4A] dark:text-[#2CC7BF] shadow-xs'
                : 'text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
            }`}
          >
            Retail Patients ({customers.filter((c) => c.type === 'retail').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#536E75] dark:text-[#8AA4A0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone (+252), email..."
            className="w-full h-10 ps-9 pe-3 text-xs bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#12A6A0]/40 text-[#10262D] dark:text-[#E8F2F0]"
          />
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((cust) => {
          const isWs = cust.type === 'wholesale';

          return (
            <div
              key={cust.id}
              onClick={() => handleOpenProfile(cust)}
              className="p-5 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] bg-white dark:bg-[#0F2830] hover:border-[#12A6A0] transition-all cursor-pointer shadow-xs flex flex-col justify-between group space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-[8px] bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F] flex items-center justify-center font-display font-bold text-xs shrink-0">
                    {cust.name.substring(0, 2).toUpperCase()}
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isWs
                        ? 'bg-[#0C3B4A]/10 text-[#0C3B4A] dark:text-[#2CC7BF]'
                        : 'bg-[#12A6A0]/10 text-[#12A6A0]'
                    }`}
                  >
                    {isWs ? cust.wholesaleSubtype : 'Retail Patient'}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-3 group-hover:text-[#12A6A0] transition-colors">
                  {cust.name}
                </h3>

                <div className="mt-2 space-y-1 text-xs text-[#536E75] dark:text-[#8AA4A0]">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#12A6A0]" />
                    <span className="font-mono">{cust.phone}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 opacity-60" />
                    <span className="truncate">{cust.email}</span>
                  </p>
                </div>
              </div>

              {/* Financial status footer */}
              <div className="pt-3 border-t border-[#EEF4F3] dark:border-[#1A4452] text-xs">
                {isWs ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] block">
                        Outstanding Debt
                      </span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          cust.currentBalance > 0 ? 'text-[#D64545]' : 'text-[#2E9E6B]'
                        }`}
                      >
                        ${cust.currentBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-end">
                      <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] block">
                        Credit Limit
                      </span>
                      <span className="font-mono text-[#536E75] dark:text-[#8AA4A0]">
                        ${cust.creditLimit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] block">
                        Loyalty Points
                      </span>
                      <span className="font-mono font-bold text-sm text-[#12A6A0]">
                        {cust.loyaltyPoints} pts
                      </span>
                    </div>
                    <div className="text-end">
                      <span className="text-[10px] text-[#536E75] dark:text-[#8AA4A0] block">
                        Lifetime Spend
                      </span>
                      <span className="font-mono text-[#0C3B4A] dark:text-[#E8F2F0] font-bold">
                        ${cust.totalSpent.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedCustomer?.name || 'Customer Profile'}
        subtitle={`ID: ${selectedCustomer?.id} · Preferred: ${selectedCustomer?.preferredLanguage.toUpperCase()}`}
        width="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setIsStatementOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Generate Statement
            </button>
          </div>
        }
      >
        {selectedCustomer && (
          <div className="space-y-6 text-xs">
            {/* Quick Banner */}
            <div className="p-4 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                  {selectedCustomer.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#12A6A0]/15 text-[#12A6A0]">
                  {selectedCustomer.type === 'wholesale'
                    ? selectedCustomer.wholesaleSubtype
                    : 'Retail Patient'}
                </span>
              </div>
              <p className="flex items-center gap-2 text-[#536E75] dark:text-[#8AA4A0]">
                <Phone className="w-3.5 h-3.5 text-[#12A6A0]" />
                <span className="font-mono">{selectedCustomer.phone}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                  WhatsApp Opted-In
                </span>
              </p>
            </div>

            {/* Balances / Loyalty */}
            <div className="grid grid-cols-2 gap-3">
              {selectedCustomer.type === 'wholesale' ? (
                <>
                  <div className="p-3 border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                    <span className="text-[#536E75] uppercase text-[10px] font-semibold">
                      Current Outstanding
                    </span>
                    <p className="font-mono text-lg font-bold text-[#D64545] mt-1">
                      ${selectedCustomer.currentBalance.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                    <span className="text-[#536E75] uppercase text-[10px] font-semibold">
                      Assigned Credit Limit
                    </span>
                    <p className="font-mono text-lg font-bold text-[#0C3B4A] dark:text-[#E8F2F0] mt-1">
                      ${selectedCustomer.creditLimit.toFixed(2)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                    <span className="text-[#536E75] uppercase text-[10px] font-semibold">
                      Loyalty Points Balance
                    </span>
                    <p className="font-mono text-lg font-bold text-[#12A6A0] mt-1">
                      {selectedCustomer.loyaltyPoints} pts
                    </p>
                  </div>
                  <div className="p-3 border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                    <span className="text-[#536E75] uppercase text-[10px] font-semibold">
                      Total Historical Spend
                    </span>
                    <p className="font-mono text-lg font-bold text-[#0C3B4A] dark:text-[#E8F2F0] mt-1">
                      ${selectedCustomer.totalSpent.toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Purchase History */}
            <div className="space-y-2">
              <h4 className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Recent Purchase & Billing History
              </h4>
              <div className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold font-mono">INV-2026-9812</p>
                    <p className="text-[11px] text-[#536E75]">2026-10-08 · Composite, Gloves, Anesthetics</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono font-bold">$780.00</p>
                    <span className="text-[10px] text-[#2E9E6B] font-semibold">Paid</span>
                  </div>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold font-mono">INV-2026-9402</p>
                    <p className="text-[11px] text-[#536E75]">2026-09-14 · Impression Material Bulk</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono font-bold">$1,420.00</p>
                    <span className="text-[10px] text-amber-600 font-semibold">Net 30 Pending</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Statement Modal */}
      <Modal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        title="Account Statement & Ledger"
        subtitle={`Account Statement for ${selectedCustomer?.name || ''}`}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setIsStatementOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
          </div>
        }
      >
        <div className="p-4 bg-white border border-[#DDE7E5] rounded-[8px] space-y-4 text-xs font-mono">
          <div className="border-b border-[#DDE7E5] pb-3 text-center">
            <img
              src={CLINIC_LOGO_SRC}
              alt={CLINIC_MARK_NAME}
              className="mx-auto mb-2 h-14 w-14 object-contain"
            />
            <h3 className="font-bold text-sm text-[#0C3B4A]">{CLINIC_LEGAL_NAME}</h3>
            <p className="text-[10px] text-[#536E75]">{CLINIC_ADDRESS}</p>
            <p className="text-[10px] text-[#536E75]">Tel: {CLINIC_PHONE} · Tax ID: {CLINIC_TAX_ID}</p>
            <p className="text-[10px] text-[#536E75]">Account statement</p>
            <p className="text-[11px] text-[#536E75]">Account: {selectedCustomer?.name}</p>
            <p className="text-[10px] text-[#536E75]">Generated: 2026-10-13 15:00 UTC</p>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Beginning Balance (Oct 01):</span>
              <span className="tabular-nums font-bold">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span>Total Invoiced (Debits):</span>
              <span className="tabular-nums font-bold">$2,200.00</span>
            </div>
            <div className="flex justify-between">
              <span>Settlements Received (Credits):</span>
              <span className="tabular-nums font-bold">-$780.00</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-neutral-300 font-bold text-xs text-[#0C3B4A]">
              <span>Current Outstanding Balance:</span>
              <span className="tabular-nums">${selectedCustomer?.currentBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register New Customer / Client"
        subtitle="Create retail patient profile or B2B wholesale partner ledger"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-[#536E75]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCustomer}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              Create Account
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Customer Account Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewType('wholesale')}
                className={`py-2 px-3 rounded-[8px] font-bold border transition-colors ${
                  newType === 'wholesale'
                    ? 'bg-[#0C3B4A] text-white border-[#0C3B4A]'
                    : 'bg-[#F4F8F7] dark:bg-[#143540] border-[#DDE7E5] dark:border-[#1A4452]'
                }`}
              >
                Wholesale Partner
              </button>
              <button
                type="button"
                onClick={() => setNewType('retail')}
                className={`py-2 px-3 rounded-[8px] font-bold border transition-colors ${
                  newType === 'retail'
                    ? 'bg-[#0C3B4A] text-white border-[#0C3B4A]'
                    : 'bg-[#F4F8F7] dark:bg-[#143540] border-[#DDE7E5] dark:border-[#1A4452]'
                }`}
              >
                Retail Patient
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Legal Name / Organization *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. SomCare Central Pharmacy or Ayaan Abdi"
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          {newType === 'wholesale' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Wholesale Subtype
                </label>
                <select
                  value={newWholesaleSubtype}
                  onChange={(e) => setNewWholesaleSubtype(e.target.value as any)}
                  className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                >
                  <option value="Clinic">Clinic</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Dental Lab">Dental Lab</option>
                  <option value="Individual Dentist">Individual Dentist</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Credit Limit ($)
                </label>
                <input
                  type="number"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(parseInt(e.target.value) || 0)}
                  className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                WhatsApp Phone Number (+252) *
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Preferred Language
              </label>
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="so">Af-Soomaali (Somali)</option>
                <option value="ar">العربية (Arabic)</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
