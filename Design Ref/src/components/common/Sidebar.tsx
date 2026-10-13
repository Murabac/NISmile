import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  ArrowLeftRight,
  Truck,
  Sparkles,
  Users,
  CalendarDays,
  Percent,
  MessageSquare,
  BarChart3,
  FileSpreadsheet,
  Settings,
  X,
} from 'lucide-react';
import { Language } from '../../types';
import { translations } from '../../i18n/translations';
import { Logo } from './Logo';

export type ScreenId =
  | 'dashboard'
  | 'pos'
  | 'stock'
  | 'transfers'
  | 'purchases'
  | 'services'
  | 'customers'
  | 'appointments'
  | 'promotions'
  | 'whatsapp'
  | 'reports'
  | 'import'
  | 'settings';

interface SidebarProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  language: Language;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  badgeCounts?: {
    stockAlerts?: number;
    unconfirmedAppointments?: number;
    activePromotions?: number;
    whatsappQueue?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onSelectScreen,
  language,
  mobileOpen,
  onCloseMobile,
  badgeCounts = {},
}) => {
  const t = translations[language];

  const navItems = [
    {
      id: 'dashboard' as ScreenId,
      label: t.nav.dashboard,
      icon: LayoutDashboard,
    },
    {
      id: 'pos' as ScreenId,
      label: t.nav.pos,
      icon: ShoppingCart,
      isSpecial: true, // Counter POS
    },
    {
      id: 'stock' as ScreenId,
      label: t.nav.stock,
      icon: Boxes,
      badge: badgeCounts.stockAlerts,
    },
    {
      id: 'transfers' as ScreenId,
      label: t.nav.transfers,
      icon: ArrowLeftRight,
    },
    {
      id: 'purchases' as ScreenId,
      label: t.nav.purchases,
      icon: Truck,
    },
    {
      id: 'services' as ScreenId,
      label: t.nav.services,
      icon: Sparkles,
    },
    {
      id: 'customers' as ScreenId,
      label: t.nav.customers,
      icon: Users,
    },
    {
      id: 'appointments' as ScreenId,
      label: t.nav.appointments,
      icon: CalendarDays,
      badge: badgeCounts.unconfirmedAppointments,
    },
    {
      id: 'promotions' as ScreenId,
      label: t.nav.promotions,
      icon: Percent,
      isPromo: true, // Coral accent indicator
      badge: badgeCounts.activePromotions,
    },
    {
      id: 'whatsapp' as ScreenId,
      label: t.nav.whatsapp,
      icon: MessageSquare,
      badge: badgeCounts.whatsappQueue,
    },
    {
      id: 'reports' as ScreenId,
      label: t.nav.reports,
      icon: BarChart3,
    },
    {
      id: 'import' as ScreenId,
      label: t.nav.import,
      icon: FileSpreadsheet,
    },
    {
      id: 'settings' as ScreenId,
      label: t.nav.settings,
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed top-0 bottom-0 start-0 z-50 w-64 bg-[#0C3B4A] dark:bg-[#091C23] text-[#E4F1EF] flex flex-col border-e border-[#144959] dark:border-[#143540] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Bar */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#144959] dark:border-[#143540] shrink-0">
          <Logo size="md" isLightOnDark={true} />
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-[8px] text-[#A6C2C7] hover:text-white hover:bg-[#144959] transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectScreen(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-[#12A6A0] text-[#0C3B4A] font-bold shadow-sm'
                    : 'text-[#C7DFDC] hover:text-white hover:bg-[#144959] dark:hover:bg-[#143540]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive
                        ? 'text-[#0C3B4A]'
                        : item.isPromo
                        ? 'text-[#FF6B57]'
                        : 'text-[#12A6A0]'
                    } group-hover:scale-105`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {/* Optional Badge */}
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                      isActive
                        ? 'bg-[#0C3B4A] text-white'
                        : item.isPromo
                        ? 'bg-[#FF6B57] text-white'
                        : 'bg-[#144959] text-[#12A6A0]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Status Footprint */}
        <div className="p-3 border-t border-[#144959] dark:border-[#143540] shrink-0 bg-[#092B36] dark:bg-[#07171C]">
          <div className="flex items-center justify-between text-[11px] text-[#A6C2C7]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2E9E6B]" />
              Multi-Branch Online
            </span>
            <span className="font-mono text-[10px] opacity-75">v2.4.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
