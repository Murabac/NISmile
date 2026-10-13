import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  CheckCheck,
  Check,
  Clock,
  Smartphone,
  Sparkles,
  Users,
  Search,
  Filter,
  FileText,
  Radio,
  ChevronRight,
  CornerDownLeft,
} from 'lucide-react';
import { Language, WhatsAppCampaign, WhatsAppLog, WhatsAppTemplate } from '../../types';
import { translations } from '../../i18n/translations';
import {
  mockWhatsAppTemplates,
  mockWhatsAppCampaigns,
  mockWhatsAppLogs,
} from '../../data/mockData';
import { CLINIC_LEGAL_NAME, CLINIC_LOGO_SRC, CLINIC_MARK_NAME } from '../../data/clinic';
import { StatusPill } from '../common/StatusPill';

interface WhatsAppScreenProps {
  language: Language;
}

export const WhatsAppScreen: React.FC<WhatsAppScreenProps> = ({ language }) => {
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'templates' | 'campaigns' | 'logs'>('templates');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(mockWhatsAppTemplates);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>(mockWhatsAppCampaigns);
  const [logs, setLogs] = useState<WhatsAppLog[]>(mockWhatsAppLogs);

  // Phone preview selection: 'appointment-reminder' | 'coral-promo'
  const [phonePreviewType, setPhonePreviewType] = useState<'appointment' | 'promo'>('appointment');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.whatsapp} Engagement & Messaging
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Meta WhatsApp Cloud API templates, appointment confirmation webhooks, and automated campaigns
          </p>
        </div>

        {/* Live gateway status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-[#2E9E6B] animate-pulse" />
          <span className="font-semibold">Cloud API Webhook Active (+252 63 4401200)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-xs font-bold rounded-[8px] transition-colors ${
            activeTab === 'templates'
              ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'bg-white dark:bg-[#0F2830] text-[#536E75] dark:text-[#8AA4A0] border border-[#DDE7E5] dark:border-[#1A4452]'
          }`}
        >
          Meta Verified Templates ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 text-xs font-bold rounded-[8px] transition-colors ${
            activeTab === 'campaigns'
              ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'bg-white dark:bg-[#0F2830] text-[#536E75] dark:text-[#8AA4A0] border border-[#DDE7E5] dark:border-[#1A4452]'
          }`}
        >
          Campaign Queue ({campaigns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-xs font-bold rounded-[8px] transition-colors ${
            activeTab === 'logs'
              ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'bg-white dark:bg-[#0F2830] text-[#536E75] dark:text-[#8AA4A0] border border-[#DDE7E5] dark:border-[#1A4452]'
          }`}
        >
          Live Message Log & Replies ({logs.length})
        </button>
      </div>

      {/* Main Grid: Content (8 Cols) + Phone Preview Device (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols */}
        <div className="lg:col-span-8 space-y-4">
          {activeTab === 'templates' && (
            <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                    <th className="py-3 px-4 text-start">Template Name</th>
                    <th className="py-3 px-4 text-start">Category</th>
                    <th className="py-3 px-4 text-start">Language</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-end">Updated</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#10262D] dark:text-[#E8F2F0]">
                        {tpl.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#EEF4F3] dark:bg-[#143540] text-[10px] font-semibold text-[#536E75] dark:text-[#8AA4A0]">
                          {tpl.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono uppercase font-bold text-[#12A6A0]">
                        {tpl.language}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusPill
                          variant={tpl.status === 'Approved' ? 'confirmed' : 'low-stock'}
                          label={tpl.status}
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-end font-mono text-[#536E75] dark:text-[#8AA4A0]">
                        {tpl.updatedAt}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (tpl.id === 'tpl-2') setPhonePreviewType('promo');
                            else setPhonePreviewType('appointment');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#0C3B4A] dark:text-[#2CC7BF] bg-[#F4F8F7] dark:bg-[#143540] hover:bg-[#12A6A0]/15 rounded-[6px] border border-[#DDE7E5] dark:border-[#1A4452] transition-colors"
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-3">
              {campaigns.map((cmp) => (
                <div
                  key={cmp.id}
                  className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                        {cmp.name}
                      </h3>
                      <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                        Target Audience: {cmp.audience}
                      </p>
                    </div>
                    <StatusPill
                      variant={cmp.status === 'Sent' ? 'received' : 'scheduled'}
                      label={cmp.status}
                      size="sm"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs bg-[#F4F8F7] dark:bg-[#143540] p-3 rounded-[8px]">
                    <div>
                      <span className="text-[10px] text-[#536E75] block">Target</span>
                      <span className="font-mono font-bold text-sm">{cmp.targetCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#536E75] block">Sent</span>
                      <span className="font-mono font-bold text-sm text-[#0C3B4A] dark:text-[#2CC7BF]">
                        {cmp.sentCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#536E75] block">Delivered</span>
                      <span className="font-mono font-bold text-sm text-[#2E9E6B]">
                        {cmp.deliveredCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#536E75] block">Read Rate</span>
                      <span className="font-mono font-bold text-sm text-[#12A6A0]">
                        {cmp.sentCount > 0 ? `${Math.round((cmp.readCount / cmp.sentCount) * 100)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                    <th className="py-3 px-4 text-start">Recipient</th>
                    <th className="py-3 px-4 text-start">Type</th>
                    <th className="py-3 px-4 text-start">Status & Delivery</th>
                    <th className="py-3 px-4 text-start">Patient Reply</th>
                    <th className="py-3 px-4 text-end">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#10262D] dark:text-[#E8F2F0]">
                        {log.recipientName}
                        <p className="font-mono text-[10px] text-[#536E75] font-normal">{log.phone}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[#536E75] dark:text-[#8AA4A0]">
                        {log.messageType}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusPill
                          variant={
                            log.status === 'Replied "Confirm"'
                              ? 'replied'
                              : log.status === 'Delivered'
                              ? 'delivered'
                              : log.status === 'Read'
                              ? 'read'
                              : 'scheduled'
                          }
                          label={log.status}
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        {log.patientReply ? (
                          <div className="flex items-center gap-1.5 text-[#1E754E] dark:text-[#53D496] font-medium">
                            <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
                            <span className="italic">"{log.patientReply}"</span>
                          </div>
                        ) : (
                          <span className="text-[#536E75] dark:text-[#8AA4A0] text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-end font-mono text-[#536E75] dark:text-[#8AA4A0]">
                        {log.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Phone-Style WhatsApp Preview Mockup */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
            <span>Device Preview</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPhonePreviewType('appointment')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  phonePreviewType === 'appointment'
                    ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
                    : 'bg-white dark:bg-[#0F2830] text-[#536E75]'
                }`}
              >
                Reminder
              </button>
              <button
                type="button"
                onClick={() => setPhonePreviewType('promo')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  phonePreviewType === 'promo'
                    ? 'bg-[#FF6B57] text-white'
                    : 'bg-white dark:bg-[#0F2830] text-[#536E75]'
                }`}
              >
                Coral Promo
              </button>
            </div>
          </div>

          {/* Realistic Phone Bezel */}
          <div className="w-full max-w-[320px] mx-auto bg-[#0C1B20] p-3 rounded-[32px] shadow-2xl border-4 border-[#143540]">
            {/* Phone Screen Area */}
            <div className="bg-[#EFEAE2] dark:bg-[#0B141A] rounded-[24px] overflow-hidden flex flex-col h-[520px] text-xs">
              {/* WhatsApp App Header */}
              <div className="bg-[#0C3B4A] text-white p-3 flex items-center gap-2.5 shrink-0">
                <img
                  src={CLINIC_LOGO_SRC}
                  alt={CLINIC_MARK_NAME}
                  className="w-8 h-8 rounded-full object-cover bg-white"
                />
                <div>
                  <p className="font-bold text-xs leading-none">{CLINIC_MARK_NAME}</p>
                  <p className="text-[10px] text-[#A6C2C7] mt-0.5">{CLINIC_LEGAL_NAME}</p>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                <div className="text-center">
                  <span className="text-[9px] bg-white/70 dark:bg-white/10 px-2 py-0.5 rounded shadow-2xs text-neutral-600 dark:text-neutral-300">
                    TODAY
                  </span>
                </div>

                {phonePreviewType === 'appointment' ? (
                  <>
                    {/* Somali Appointment Reminder */}
                    <div className="bg-white dark:bg-[#202C33] p-3 rounded-[10px] rounded-tl-none shadow-xs text-[#111B21] dark:text-[#E9EDEF] space-y-2 max-w-[90%]">
                      <p className="font-bold text-[#0C3B4A] dark:text-[#2CC7BF] text-[11px]">
                        XUSUUSIN BALLAN ({CLINIC_MARK_NAME})
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Mudane/Marwo <strong>Ayaan Abdi Mohamed</strong>,
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Waxaan kugu xusuusinaynaa ballantaada ilkaha ee {CLINIC_LEGAL_NAME}:
                      </p>
                      <div className="p-2 bg-[#F4F8F7] dark:bg-[#111B21] rounded text-[10px] font-mono space-y-0.5">
                        <p>Taariikhda: <strong>2026-10-13</strong></p>
                        <p>Saacadda: <strong>09:30 AM</strong></p>
                        <p>Dhakhtarka: <strong>Dr. Sahra Awale</strong></p>
                        <p>Adeegga: <strong>Composite Dental Filling</strong></p>
                      </div>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400">
                        Fadlan ku soo jawaab "XAQIIJI" si aad u xaqiijiso ballantaada.
                      </p>
                      <div className="text-end text-[9px] text-neutral-400 font-mono flex items-center justify-end gap-1">
                        <span>08:15 AM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#12A6A0]" />
                      </div>
                    </div>

                    {/* Patient Reply Bubble */}
                    <div className="ms-auto bg-[#D9FDD3] dark:bg-[#005C4B] p-2.5 rounded-[10px] rounded-tr-none shadow-xs text-[#111B21] dark:text-[#E9EDEF] max-w-[85%] text-end space-y-1">
                      <p className="text-[11px] text-start">
                        Haa, waan imanayaa inshaAllah. Mahadsanidiin.
                      </p>
                      <div className="text-[9px] text-neutral-500 dark:text-neutral-300 font-mono flex items-center justify-end gap-1">
                        <span>08:22 AM</span>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Coral Promotion Message */}
                    <div className="bg-white dark:bg-[#202C33] p-3 rounded-[10px] rounded-tl-none shadow-xs text-[#111B21] dark:text-[#E9EDEF] space-y-2 max-w-[90%] border-s-4 border-[#FF6B57]">
                      <div className="flex items-center gap-1.5 text-[#FF6B57] font-bold text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF6B57]" />
                        <span>DALAB GAAR AH OO JUMLO AH</span>
                      </div>
                      <p className="text-[11px] font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                        Iibso 10 Sanduuq, Hel 1 Bilaash ah!
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Dhammaan rugaha caafimaadka ilkaha iyo farmasiyada: dalbo galoofisyada, suuxdinta Lidocaine ama disposable bibs bishan oo hel 1 sanduuq oo bilaash ah!
                      </p>
                      <div className="bg-[#FF6B57]/10 p-2 rounded text-[10px] text-[#C93824] dark:text-[#FF9D8E] font-semibold">
                        Koodhka: WS-BOX10-FREE1 · Dhacaya: Nov 30
                      </div>
                      <div className="text-end text-[9px] text-neutral-400 font-mono flex items-center justify-end gap-1">
                        <span>09:00 AM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#12A6A0]" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="p-2 bg-white dark:bg-[#202C33] flex items-center gap-2 border-t border-neutral-300 dark:border-neutral-700 shrink-0">
                <input
                  type="text"
                  disabled
                  placeholder="Type a message..."
                  className="flex-1 h-8 px-3 text-[11px] bg-[#F0F2F5] dark:bg-[#2A3942] rounded-full border-none outline-none"
                />
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-[#12A6A0] text-white flex items-center justify-center shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
