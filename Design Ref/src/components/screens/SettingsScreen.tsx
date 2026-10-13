import React, { useState } from 'react';
import {
  Settings,
  Users,
  Building2,
  Tag,
  Receipt,
  Clock,
  Globe,
  Save,
  ShieldCheck,
  Check,
  Phone,
  Mail,
  MapPin,
  Percent,
} from 'lucide-react';
import { BranchId, Language, Role } from '../../types';
import { translations } from '../../i18n/translations';
import { mockBranches } from '../../data/mockData';
import {
  CLINIC_ADDRESS,
  CLINIC_EDAHAB,
  CLINIC_LEGAL_NAME,
  CLINIC_MYCASH,
  CLINIC_PHONE,
  CLINIC_TAX_ID,
  CLINIC_ZAAD,
} from '../../data/clinic';

interface SettingsScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  language,
  onLanguageChange,
}) => {
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<
    'users' | 'branches' | 'pricelists' | 'tax' | 'clinic' | 'reminders' | 'languages'
  >('users');

  // Clinic details state
  const [clinicName, setClinicName] = useState(CLINIC_LEGAL_NAME);
  const [taxId, setTaxId] = useState(CLINIC_TAX_ID);
  const [phone, setPhone] = useState(CLINIC_PHONE);
  const [zaadMerchant, setZaadMerchant] = useState(CLINIC_ZAAD);
  const [edahabAccount, setEdahabAccount] = useState(CLINIC_EDAHAB);
  const [mycashAccount, setMycashAccount] = useState(CLINIC_MYCASH);
  const [address, setAddress] = useState(CLINIC_ADDRESS);

  // Reminders timing
  const [remind24h, setRemind24h] = useState(true);
  const [remind2h, setRemind2h] = useState(true);
  const [postFollowup, setPostFollowup] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const usersList = [
    {
      name: 'Dr. Sahra Awale',
      role: 'Owner' as Role,
      email: 'sahra.awale@dentaflow.so',
      branch: 'All branches',
      status: 'Active',
    },
    {
      name: 'Dr. Guled Farah',
      role: 'Branch Manager' as Role,
      email: 'guled.farah@dentaflow.so',
      branch: 'Hargeisa North',
      status: 'Active',
    },
    {
      name: 'Dr. Hibaaq Warsame',
      role: 'Dentist' as Role,
      email: 'hibaaq.w@dentaflow.so',
      branch: 'Burao Branch',
      status: 'Active',
    },
    {
      name: 'Ahmed Jama',
      role: 'Storekeeper' as Role,
      email: 'ahmed.jama@dentaflow.so',
      branch: 'Main Clinic (Central)',
      status: 'Active',
    },
    {
      name: 'Fadumo Ali',
      role: 'Receptionist' as Role,
      email: 'fadumo.ali@dentaflow.so',
      branch: 'Main Clinic (Central)',
      status: 'Active',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.settings} & System Configuration
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Users & role permissions, multi-branch profiles, tax schedules, and invoice identifiers
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Changes</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 rounded-[8px] text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-[#2E9E6B]" />
          <span>Configuration saved successfully and synced across all branches!</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-white dark:bg-[#0F2830] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[10px] shadow-xs text-xs">
        {[
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'branches', label: 'Branches', icon: Building2 },
          { id: 'pricelists', label: 'Price Lists', icon: Tag },
          { id: 'tax', label: 'Tax & VAT Rates', icon: Percent },
          { id: 'clinic', label: 'Clinic Details (Invoices)', icon: Receipt },
          { id: 'reminders', label: 'Reminder Timing', icon: Clock },
          { id: 'languages', label: 'Language & Locale', icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-[8px] whitespace-nowrap font-semibold transition-colors ${
                isActive
                  ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
                  : 'text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white dark:bg-[#0F2830] p-6 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs text-xs">
        {/* USERS & ROLES */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Team Members & Access Roles
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Owner role grants full visibility across all branches; operational roles are scoped to assigned branches.
              </p>
            </div>

            <div className="border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] overflow-hidden">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-start">Staff Member</th>
                    <th className="py-2.5 px-3 text-start">Assigned Role</th>
                    <th className="py-2.5 px-3 text-start">Operating Branch Scope</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
                  {usersList.map((u, i) => (
                    <tr key={i} className="hover:bg-[#F4F8F7]/60">
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#10262D] dark:text-[#E8F2F0] block">
                          {u.name}
                        </span>
                        <span className="text-[10px] text-[#536E75]">{u.email}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#10262D] dark:text-[#E8F2F0] font-medium">
                        {u.branch}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BRANCHES */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Clinic Branches Network
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Physical operating sites with direct inventory stockrooms and chairs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mockBranches.map((b) => (
                <div
                  key={b.id}
                  className="p-4 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                      {b.name}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#12A6A0]/15 text-[#12A6A0] font-bold">
                      Branch ID: {b.id}
                    </span>
                  </div>
                  <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
                    Location: {b.location}
                  </p>
                  <p className="text-xs font-mono text-[#536E75] dark:text-[#8AA4A0]">
                    Direct line: {b.phone}
                  </p>
                  <div className="pt-2 border-t border-[#DDE7E5] dark:border-[#1A4452] flex justify-between text-[11px] text-[#536E75]">
                    <span>Manager: {b.manager}</span>
                    <span className="font-semibold">{b.activeStaff} staff</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRICE LISTS */}
        {activeTab === 'pricelists' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Tiered Price Lists
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Configured catalog rate-cards applied automatically on Point of Sale checkout.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-[8px] border border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                    Standard Retail Price List
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    Default for Patients
                  </span>
                </div>
                <p className="text-xs text-[#536E75]">
                  Standard clinical MSRP for walk-in and registered dental patients.
                </p>
              </div>

              <div className="p-4 rounded-[8px] border border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                    Wholesale Tier A (Clinics & Pharmacies)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#0C3B4A] text-white rounded">
                    Wholesale Default
                  </span>
                </div>
                <p className="text-xs text-[#536E75]">
                  Discounted bulk wholesale rates for external clinics, pharmacies, and labs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAX RATES */}
        {activeTab === 'tax' && (
          <div className="space-y-4 max-w-xl">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Value Added Tax (VAT) & Excise Rates
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Somaliland Ministry of Finance tax schedules applied as a separate line on all receipts and tax invoices.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                    Standard Clinical VAT
                  </p>
                  <p className="text-[11px] text-[#536E75]">Applies to all retail procedures and dental inventory</p>
                </div>
                <span className="font-mono text-base font-bold text-[#12A6A0]">
                  5.0%
                </span>
              </div>

              <div className="p-3 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                    Exempt Medical Items
                  </p>
                  <p className="text-[11px] text-[#536E75]">Prescription pharmaceuticals and emergency surgery</p>
                </div>
                <span className="font-mono text-base font-bold text-[#536E75]">
                  0.0%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CLINIC DETAILS (FOR INVOICES) */}
        {activeTab === 'clinic' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Clinic Details (Rendered on Official Invoices & Receipts)
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Official registration credentials, Ministry of Health license, and payment settlement endpoints.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Legal Clinic Name
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>

              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Tax Registration Number
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  Zaad
                </label>
                <input
                  type="text"
                  value={zaadMerchant}
                  onChange={(e) => setZaadMerchant(e.target.value)}
                  className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  eDahab
                </label>
                <input
                  type="text"
                  value={edahabAccount}
                  onChange={(e) => setEdahabAccount(e.target.value)}
                  className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
              <div>
                <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                  MyCash (Amal Bank)
                </label>
                <input
                  type="text"
                  value={mycashAccount}
                  onChange={(e) => setMycashAccount(e.target.value)}
                  placeholder="Pending"
                  className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* REMINDER TIMING */}
        {activeTab === 'reminders' && (
          <div className="space-y-4 max-w-xl">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Automated WhatsApp Reminder Schedule
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Triggers dispatched prior to booked dental chair sessions to optimize show-up rates.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] cursor-pointer">
                <div>
                  <p className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                    24-Hour Advance Reminder
                  </p>
                  <p className="text-[11px] text-[#536E75]">
                    Requests confirmation reply from patient
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={remind24h}
                  onChange={(e) => setRemind24h(e.target.checked)}
                  className="w-4 h-4 text-[#12A6A0] rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] cursor-pointer">
                <div>
                  <p className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                    2-Hour Arrival Notice
                  </p>
                  <p className="text-[11px] text-[#536E75]">
                    Sends clinic Google Maps pin and arrival directions
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={remind2h}
                  onChange={(e) => setRemind2h(e.target.checked)}
                  className="w-4 h-4 text-[#12A6A0] rounded"
                />
              </label>
            </div>
          </div>
        )}

        {/* LANGUAGES */}
        {activeTab === 'languages' && (
          <div className="space-y-4 max-w-xl">
            <div>
              <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                Supported Practice Languages & RTL Behavior
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                DentaFlow provides complete localizations with right-to-left UI mirroring for Arabic.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { id: 'en' as Language, name: 'English (US/UK)', dir: 'LTR' },
                { id: 'so' as Language, name: 'Af-Soomaali (Somali)', dir: 'LTR' },
                { id: 'ar' as Language, name: 'العربية (Arabic - RTL)', dir: 'RTL' },
              ].map((l) => (
                <div
                  key={l.id}
                  onClick={() => onLanguageChange(l.id)}
                  className={`p-3 rounded-[8px] border flex items-center justify-between cursor-pointer transition-colors ${
                    language === l.id
                      ? 'bg-[#12A6A0]/15 border-[#12A6A0] font-bold text-[#0C3B4A] dark:text-[#2CC7BF]'
                      : 'bg-[#F4F8F7] dark:bg-[#143540] border-[#DDE7E5] dark:border-[#1A4452] text-[#10262D] dark:text-[#E8F2F0]'
                  }`}
                >
                  <div>
                    <span>{l.name}</span>
                    <span className="text-[10px] text-[#536E75] ms-2">Layout: {l.dir}</span>
                  </div>
                  {language === l.id && <Check className="w-4 h-4 text-[#12A6A0]" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
