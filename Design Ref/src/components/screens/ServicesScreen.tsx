import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Clock,
  DollarSign,
  UtensilsCrossed,
  Package,
  Layers,
  Edit2,
  Trash2,
} from 'lucide-react';
import { DentalService, Language, ServiceRecipeItem } from '../../types';
import { translations } from '../../i18n/translations';
import { mockDentalServices, mockStockItems } from '../../data/mockData';
import { Modal } from '../common/Modal';

interface ServicesScreenProps {
  language: Language;
}

export const ServicesScreen: React.FC<ServicesScreenProps> = ({ language }) => {
  const t = translations[language];

  const [services, setServices] = useState<DentalService[]>(mockDentalServices);
  const [selectedService, setSelectedService] = useState<DentalService>(mockDentalServices[1]); // default to Filling
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form state for new service
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<DentalService['category']>('Restorative');
  const [newRetailPrice, setNewRetailPrice] = useState(60.0);
  const [newWholesalePrice, setNewWholesalePrice] = useState(48.0);
  const [newDuration, setNewDuration] = useState(30);
  const [newDescription, setNewDescription] = useState('');

  const handleCreateService = () => {
    if (!newServiceName) return;
    const newSrv: DentalService = {
      id: `srv-${Date.now()}`,
      code: `SRV-CUS-0${Math.floor(10 + Math.random() * 90)}`,
      name: newServiceName,
      category: newServiceCategory,
      retailPrice: newRetailPrice,
      wholesalePrice: newWholesalePrice,
      vatRate: 0.05,
      durationMinutes: newDuration,
      description: newDescription || 'Standard clinical oral procedure.',
      recipe: [
        {
          itemId: 'item-7',
          itemName: 'Disposable Patient Bibs 3-Ply',
          quantity: 1,
          unit: 'Unit',
        },
        {
          itemId: 'item-2',
          itemName: 'Latex Gloves M',
          quantity: 2,
          unit: 'Pieces',
        },
      ],
    };

    setServices([...services, newSrv]);
    setSelectedService(newSrv);
    setIsAddOpen(false);
    setNewServiceName('');
    setNewDescription('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.services} & Treatment Recipes
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Clinical procedures, retail/wholesale pricing, duration, and automatic inventory consumption recipes
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Clinical Service</span>
        </button>
      </div>

      {/* Two Column Layout: Service Cards + Recipe Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Services List (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {services.map((srv) => {
              const isSelected = selectedService.id === srv.id;

              return (
                <div
                  key={srv.id}
                  onClick={() => setSelectedService(srv)}
                  className={`p-4 rounded-[10px] border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-white dark:bg-[#0F2830] border-[#12A6A0] ring-2 ring-[#12A6A0]/20'
                      : 'bg-white dark:bg-[#0F2830] border-[#DDE7E5] dark:border-[#1A4452] hover:border-[#12A6A0]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#12A6A0]">
                          {srv.code}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#EEF4F3] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] font-semibold">
                          {srv.category}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-1">
                        {srv.name}
                      </h3>
                      <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1 line-clamp-2">
                        {srv.description}
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      <div className="font-mono text-base font-extrabold text-[#0C3B4A] dark:text-[#2CC7BF] tabular-nums">
                        ${srv.retailPrice.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] font-mono">
                        WS: ${srv.wholesalePrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#EEF4F3] dark:border-[#1A4452] text-xs text-[#536E75] dark:text-[#8AA4A0]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#12A6A0]" />
                      <span>{srv.durationMinutes} mins chair time</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-[#0C3B4A] dark:text-[#2CC7BF]">
                      <Package className="w-3.5 h-3.5" />
                      <span>{srv.recipe.length} materials consumed</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Recipe Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] p-5 space-y-4 shadow-xs sticky top-20">
          <div className="pb-3 border-b border-[#DDE7E5] dark:border-[#1A4452]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#12A6A0]">
                {selectedService.code} RECIPE
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF]">
                {selectedService.durationMinutes} min procedure
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-[#0C3B4A] dark:text-[#E8F2F0] mt-1">
              {selectedService.name}
            </h3>
            <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1">
              Automatic stock deduction upon appointment completion or POS sale.
            </p>
          </div>

          {/* Consumed Materials List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#0C3B4A] dark:text-[#E8F2F0] uppercase tracking-wider">
              Consumed Clinical Inventory (Recipe)
            </h4>

            <div className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]">
              {selectedService.recipe.map((r, i) => (
                <div key={i} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#10262D] dark:text-[#E8F2F0]">
                      {r.itemName}
                    </p>
                    <p className="text-[10px] text-[#536E75] dark:text-[#8AA4A0]">
                      Deducted per single procedure
                    </p>
                  </div>
                  <div className="text-end font-mono font-bold text-xs text-[#0C3B4A] dark:text-[#2CC7BF] bg-[#F4F8F7] dark:bg-[#143540] px-2 py-1 rounded">
                    {r.quantity} {r.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & VAT Metrics */}
          <div className="p-3.5 bg-[#F4F8F7] dark:bg-[#143540] rounded-[8px] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#536E75] dark:text-[#8AA4A0]">Retail Patient Fee:</span>
              <span className="font-mono font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                ${selectedService.retailPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#536E75] dark:text-[#8AA4A0]">Wholesale / Contract Fee:</span>
              <span className="font-mono font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                ${selectedService.wholesalePrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#536E75] dark:text-[#8AA4A0]">Standard Tax Rate:</span>
              <span className="font-mono">VAT 5.0% (${(selectedService.retailPrice * 0.05).toFixed(2)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Service Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create New Clinical Service"
        subtitle="Define procedural pricing, duration, and default materials recipe"
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
              onClick={handleCreateService}
              className="px-4 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
            >
              Save Service
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Service Name *
            </label>
            <input
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="e.g. Ceramic Inlay Preparation"
              className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Category
              </label>
              <select
                value={newServiceCategory}
                onChange={(e) => setNewServiceCategory(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              >
                <option value="Restorative">Restorative</option>
                <option value="Hygiene">Hygiene</option>
                <option value="Surgery">Surgery</option>
                <option value="Endodontics">Endodontics</option>
                <option value="Cosmetic">Cosmetic</option>
                <option value="Diagnostic">Diagnostic</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(parseInt(e.target.value) || 30)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Retail Price ($)
              </label>
              <input
                type="number"
                step="0.5"
                value={newRetailPrice}
                onChange={(e) => setNewRetailPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
            <div>
              <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
                Wholesale Price ($)
              </label>
              <input
                type="number"
                step="0.5"
                value={newWholesalePrice}
                onChange={(e) => setNewWholesalePrice(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 font-mono bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-[#0C3B4A] dark:text-[#E8F2F0] block mb-1">
              Clinical Description
            </label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Clinical steps and patient care protocol..."
              className="w-full p-2.5 bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] rounded-[8px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
