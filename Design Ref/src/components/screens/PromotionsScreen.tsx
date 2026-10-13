import React, { useState } from 'react';
import {
  Percent,
  Plus,
  Tag,
  DollarSign,
  Users,
  Calendar,
  Share2,
  Sparkles,
  Award,
  Sliders,
  CheckCircle,
  Eye,
} from 'lucide-react';
import {
  BranchId,
  Language,
  Promotion,
  PromotionAudience,
  PromotionType,
  WholesaleSubtype,
} from '../../types';
import { translations } from '../../i18n/translations';
import { mockPromotions } from '../../data/mockData';
import { StatusPill } from '../common/StatusPill';
import { Modal } from '../common/Modal';

interface PromotionsScreenProps {
  language: Language;
}

export const PromotionsScreen: React.FC<PromotionsScreenProps> = ({ language }) => {
  const t = translations[language];

  const [promotions, setPromotions] = useState<Promotion[]>(mockPromotions);
  const [activeTab, setActiveTab] = useState<'promos' | 'loyalty'>('promos');

  // Create Promotion Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoType, setPromoType] = useState<PromotionType>('buy_x_get_y');
  const [promoAudience, setPromoAudience] = useState<PromotionAudience>('wholesale');
  const [wholesaleSubtype, setWholesaleSubtype] = useState<WholesaleSubtype>('Clinic');
  const [promoValue, setPromoValue] = useState(100);
  const [buyQty, setBuyQty] = useState(10);
  const [getQty, setGetQty] = useState(1);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [previewLang, setPreviewLang] = useState<Language>('so');

  // Loyalty settings state
  const [loyaltyRate, setLoyaltyRate] = useState(1); // 1 point per $1 spent
  const [pointValue, setPointValue] = useState(0.05); // 100 points = $5.00
  const [minRedeem, setMinRedeem] = useState(100); // 100 points min

  const sampleSomaliMsg =
    'Dalab Gaar Ah N.I SMILE Oral care & Teeth whitening: Iibso 10 sanduuq oo qalabka ama daawada ilkaha ah, waxaadna helaysaa 1 sanduuq oo BILAASH ah! Ku habboon rugaha iyo farmasiyada.';
  const sampleArabicMsg =
    'عرض حصري من N.I SMILE Oral care & Teeth whitening لعيادات ومختبرات الأسنان: اشترِ 10 علب من المستلزمات الطبية واحصل على علبة مجاناً!';
  const sampleEnglishMsg =
    'Exclusive offer from N.I SMILE Oral care & Teeth whitening: Buy 10 boxes of clinical dental consumables and receive 1 complimentary box! Valid this month.';

  const handleCreatePromo = () => {
    if (!promoTitle) return;

    const newPromo: Promotion = {
      id: `promo-${Date.now()}`,
      code: `PROMO-${Math.floor(1000 + Math.random() * 9000)}`,
      title: promoTitle,
      description: 'Custom multi-branch promotional campaign rule.',
      type: promoType,
      value: promoValue,
      buyQty: promoType === 'buy_x_get_y' ? buyQty : undefined,
      getQty: promoType === 'buy_x_get_y' ? getQty : undefined,
      audience: promoAudience,
      applicableBranchIds: ['all'],
      startDate: '2026-10-15',
      endDate: '2026-11-30',
      status: 'active',
      redemptions: 0,
      revenueGenerated: 0,
      notifyOnWhatsApp: notifyWhatsApp,
      whatsappMessageEn: sampleEnglishMsg,
      whatsappMessageSo: sampleSomaliMsg,
      whatsappMessageAr: sampleArabicMsg,
      estimatedRecipients: promoAudience === 'wholesale' ? 42 : 310,
    };

    setPromotions([newPromo, ...promotions]);
    setIsCreateOpen(false);
    setPromoTitle('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.promotions} & Patient Loyalty
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Automatic discounts, Buy X Get Y deals, and WhatsApp broadcasts (highlighted in Coral)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#FF6B57] text-white hover:bg-[#FF7A66] transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promotion</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher: Promotions vs Loyalty Settings */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('promos')}
          className={`px-4 py-2 text-xs font-bold rounded-[8px] transition-colors ${
            activeTab === 'promos'
              ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'bg-white dark:bg-[#0F2830] text-[#536E75] dark:text-[#8AA4A0] border border-[#DDE7E5] dark:border-[#1A4452]'
          }`}
        >
          Active Promotions ({promotions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('loyalty')}
          className={`px-4 py-2 text-xs font-bold rounded-[8px] transition-colors ${
            activeTab === 'loyalty'
              ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
              : 'bg-white dark:bg-[#0F2830] text-[#536E75] dark:text-[#8AA4A0] border border-[#DDE7E5] dark:border-[#1A4452]'
          }`}
        >
          Loyalty Program Rules
        </button>
      </div>

      {activeTab === 'promos' ? (
        /* Promotions Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="p-5 rounded-[10px] border border-[#FF6B57]/30 bg-white dark:bg-[#0F2830] shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              {/* Top Accent in Coral */}
              <div className="absolute top-0 inset-x-0 h-1 bg-[#FF6B57]" />

              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#FF6B57] bg-[#FF6B57]/10 px-2 py-0.5 rounded">
                    {promo.code}
                  </span>
                  <StatusPill variant="promo" label={promo.status.toUpperCase()} size="sm" />
                </div>

                <h3 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-3 leading-snug">
                  {promo.title}
                </h3>
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1.5 line-clamp-2">
                  {promo.description}
                </p>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                  <Users className="w-3.5 h-3.5 text-[#12A6A0]" />
                  <span className="capitalize">Audience: {promo.audience.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Performance Results */}
              <div className="pt-3 border-t border-[#EEF4F3] dark:border-[#1A4452] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#536E75] dark:text-[#8AA4A0]">Redemptions:</span>
                  <span className="font-mono font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                    {promo.redemptions} times
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#536E75] dark:text-[#8AA4A0]">Attributed Revenue:</span>
                  <span className="font-mono font-bold text-[#12A6A0]">
                    ${promo.revenueGenerated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {promo.notifyOnWhatsApp && (
                  <div className="p-2 rounded bg-[#12A6A0]/10 flex items-center justify-between text-[11px] text-[#0C3B4A] dark:text-[#2CC7BF]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Share2 className="w-3 h-3 text-[#12A6A0]" />
                      Broadcast Audience
                    </span>
                    <span className="font-mono font-bold">{promo.estimatedRecipients} recipients</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Loyalty Settings Panel */
        <div className="max-w-2xl bg-white dark:bg-[#0F2830] p-6 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-5 shadow-xs text-xs">
          <div>
            <h3 className="font-display text-base font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
              Patient Loyalty & Points Redemption Engine
            </h3>
            <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
              Configure points earned per dollar spent, USD point redemption ratios, and minimum balance thresholds.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Earning Rate (Points awarded per $1 USD spent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={loyaltyRate}
                  onChange={(e) => setLoyaltyRate(parseInt(e.target.value) || 1)}
                  className="w-24 h-10 px-3 font-mono text-center bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
                <span className="text-[#536E75] dark:text-[#8AA4A0]">
                  pts per $1 spent on dental procedures or products
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Point Monetary Value ($USD per point)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.01"
                  value={pointValue}
                  onChange={(e) => setPointValue(parseFloat(e.target.value) || 0.05)}
                  className="w-24 h-10 px-3 font-mono text-center bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
                <span className="text-[#536E75] dark:text-[#8AA4A0]">
                  (100 points = ${(100 * pointValue).toFixed(2)} discount at POS)
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Minimum Points Required for Redemption
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={minRedeem}
                  onChange={(e) => setMinRedeem(parseInt(e.target.value) || 100)}
                  className="w-24 h-10 px-3 font-mono text-center bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
                <span className="text-[#536E75] dark:text-[#8AA4A0]">
                  Threshold required before customer toggle is unlocked on checkout
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#DDE7E5] dark:border-[#1A4452] flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
              >
                Save Loyalty Parameters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Promotion Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Promotional Campaign"
        subtitle="Configure discount formulas, targeted audience, and WhatsApp notification"
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
              onClick={handleCreatePromo}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#FF6B57] text-white hover:bg-[#FF7A66] transition-colors"
            >
              Launch Promotion
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Promotion Campaign Title *
            </label>
            <input
              type="text"
              value={promoTitle}
              onChange={(e) => setPromoTitle(e.target.value)}
              placeholder="e.g. Wholesale: buy 10 boxes, get 1 free"
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Discount Mechanism
              </label>
              <select
                value={promoType}
                onChange={(e) => setPromoType(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="buy_x_get_y">Buy X Get Y Free</option>
                <option value="percentage">Percentage Discount (%)</option>
                <option value="fixed_amount">Fixed Amount ($)</option>
                <option value="spend_threshold">Spend Threshold Reward</option>
                <option value="bundle">Procedure Bundle</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Target Audience
              </label>
              <select
                value={promoAudience}
                onChange={(e) => setPromoAudience(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="wholesale">All Wholesale Accounts</option>
                <option value="retail">All Retail Patients</option>
                <option value="all">Everyone (Entire Network)</option>
                <option value="wholesale_subtype">Specific Wholesale Subtype</option>
              </select>
            </div>
          </div>

          {promoType === 'buy_x_get_y' && (
            <div className="grid grid-cols-2 gap-4 bg-[#FF6B57]/10 p-3 rounded-[8px]">
              <div>
                <label className="font-bold text-[#C93824] dark:text-[#FF9D8E] block mb-1">
                  Buy Quantity (X)
                </label>
                <input
                  type="number"
                  value={buyQty}
                  onChange={(e) => setBuyQty(parseInt(e.target.value) || 1)}
                  className="w-full h-10 px-3 font-mono bg-white dark:bg-[#0F2830] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
              <div>
                <label className="font-bold text-[#C93824] dark:text-[#FF9D8E] block mb-1">
                  Get Free Units (Y)
                </label>
                <input
                  type="number"
                  value={getQty}
                  onChange={(e) => setGetQty(parseInt(e.target.value) || 1)}
                  className="w-full h-10 px-3 font-mono bg-white dark:bg-[#0F2830] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
                />
              </div>
            </div>
          )}

          {/* WhatsApp Notification Broadcast Toggle with Live Multilingual Preview */}
          <div className="p-4 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                  Notify Eligible Customers on WhatsApp
                </span>
                <p className="text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                  Estimated reach: ~{promoAudience === 'wholesale' ? '42 clinics & pharmacies' : '310 retail patients'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyWhatsApp}
                onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                className="w-4 h-4 text-[#12A6A0] rounded"
              />
            </div>

            {notifyWhatsApp && (
              <div className="space-y-2 pt-2 border-t border-[#DDE7E5] dark:border-[#1A4452]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#536E75] uppercase">
                    Message Preview
                  </span>
                  <div className="flex items-center gap-1">
                    {(['so', 'ar', 'en'] as Language[]).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setPreviewLang(l)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          previewLang === l
                            ? 'bg-[#12A6A0] text-white'
                            : 'bg-white dark:bg-[#0F2830] text-[#536E75]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`p-3 bg-white dark:bg-[#0F2830] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px] text-[11px] font-mono leading-relaxed ${
                    previewLang === 'ar' ? 'text-right' : 'text-left'
                  }`}
                  dir={previewLang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {previewLang === 'so'
                    ? sampleSomaliMsg
                    : previewLang === 'ar'
                    ? sampleArabicMsg
                    : sampleEnglishMsg}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
