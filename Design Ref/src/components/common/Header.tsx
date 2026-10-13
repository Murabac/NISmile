import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Globe,
  Sun,
  Moon,
  ChevronDown,
  User,
  ShieldCheck,
  Check,
  Bell,
  Sparkles,
} from 'lucide-react';
import { BranchId, Language, Role } from '../../types';
import { mockBranches } from '../../data/mockData';
import { translations } from '../../i18n/translations';

interface HeaderProps {
  currentBranch: BranchId;
  onBranchChange: (branch: BranchId) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDark: boolean;
  onToggleDark: () => void;
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  needsAttentionCount: number;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentBranch,
  onBranchChange,
  language,
  onLanguageChange,
  isDark,
  onToggleDark,
  currentRole,
  onRoleChange,
  needsAttentionCount,
  onOpenNotifications,
}) => {
  const t = translations[language];
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const branchRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setIsBranchMenuOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBranchLabel = (id: BranchId) => {
    if (id === 'all') return t.branches.all;
    if (id === 'main') return t.branches.main;
    if (id === 'hargeisa-north') return t.branches.hargeisaNorth;
    if (id === 'burao') return t.branches.burao;
    return id;
  };

  const roles: Role[] = [
    'Owner',
    'Branch Manager',
    'Receptionist',
    'Dentist',
    'Storekeeper',
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#0F2830] border-b border-[#DDE7E5] dark:border-[#1A4452] px-4 md:px-6 flex items-center justify-between gap-4 transition-colors">
      {/* Left: Branch Selector */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={branchRef}>
          <button
            type="button"
            onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-[10px] text-sm font-medium bg-[#F4F8F7] dark:bg-[#143540] text-[#0C3B4A] dark:text-[#E8F2F0] border border-[#DDE7E5] dark:border-[#1A4452] hover:border-[#12A6A0] dark:hover:border-[#2CC7BF] transition-all focus:outline-none focus:ring-2 focus:ring-[#12A6A0]/40"
          >
            <Building2 className="w-4 h-4 text-[#12A6A0] shrink-0" />
            <span className="font-semibold">{getBranchLabel(currentBranch)}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          </button>

          {isBranchMenuOpen && (
            <div className="absolute start-0 mt-1.5 w-64 bg-white dark:bg-[#0F2830] rounded-[10px] shadow-lg border border-[#DDE7E5] dark:border-[#1A4452] py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#536E75] dark:text-[#8AA4A0]">
                Select Operating Branch
              </div>

              {/* Owner can see "All branches" */}
              <button
                type="button"
                onClick={() => {
                  if (currentRole === 'Owner') {
                    onBranchChange('all');
                    setIsBranchMenuOpen(false);
                  }
                }}
                disabled={currentRole !== 'Owner'}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-start transition-colors ${
                  currentRole !== 'Owner'
                    ? 'opacity-40 cursor-not-allowed text-[#536E75]'
                    : currentBranch === 'all'
                    ? 'bg-[#12A6A0]/10 text-[#0C3B4A] dark:text-[#2CC7BF] font-semibold'
                    : 'text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540]'
                }`}
              >
                <div className="flex flex-col">
                  <span>{t.branches.all}</span>
                  {currentRole !== 'Owner' && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                      (Restricted to Owner role)
                    </span>
                  )}
                </div>
                {currentBranch === 'all' && (
                  <Check className="w-4 h-4 text-[#12A6A0]" />
                )}
              </button>

              <div className="h-px bg-[#DDE7E5] dark:bg-[#1A4452] my-1" />

              {mockBranches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onBranchChange(b.id);
                    setIsBranchMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-start transition-colors ${
                    currentBranch === b.id
                      ? 'bg-[#12A6A0]/10 text-[#0C3B4A] dark:text-[#2CC7BF] font-semibold'
                      : 'text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{getBranchLabel(b.id)}</span>
                    <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                      {b.location}
                    </span>
                  </div>
                  {currentBranch === b.id && (
                    <Check className="w-4 h-4 text-[#12A6A0]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Notifications, Language, Dark Mode, Role Badge & User Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Needs attention badge / Notification toggle */}
        {needsAttentionCount > 0 && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-[#E0A100] border border-[#E0A100]/30 hover:bg-amber-100 transition-colors"
            title="Items needing clinical attention"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="font-mono">{needsAttentionCount}</span>
            <span className="hidden sm:inline">attention</span>
          </button>
        )}

        {/* Language Switcher */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-medium text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] transition-colors"
            aria-label="Change language"
          >
            <Globe className="w-3.5 h-3.5 text-[#12A6A0]" />
            <span className="font-semibold uppercase">{language}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isLangMenuOpen && (
            <div className="absolute end-0 mt-1.5 w-44 bg-white dark:bg-[#0F2830] rounded-[10px] shadow-lg border border-[#DDE7E5] dark:border-[#1A4452] py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  onLanguageChange('en');
                  setIsLangMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-start ${
                  language === 'en'
                    ? 'font-bold text-[#12A6A0] bg-[#12A6A0]/10'
                    : 'text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540]'
                }`}
              >
                <span>English (EN)</span>
                {language === 'en' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onLanguageChange('so');
                  setIsLangMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-start ${
                  language === 'so'
                    ? 'font-bold text-[#12A6A0] bg-[#12A6A0]/10'
                    : 'text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540]'
                }`}
              >
                <span>Af-Soomaali (SO)</span>
                {language === 'so' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onLanguageChange('ar');
                  setIsLangMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-start ${
                  language === 'ar'
                    ? 'font-bold text-[#12A6A0] bg-[#12A6A0]/10'
                    : 'text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>العربية (AR - RTL)</span>
                </div>
                {language === 'ar' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Light / Dark Toggle */}
        <button
          type="button"
          onClick={onToggleDark}
          className="p-2 rounded-[10px] text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-[#2CC7BF]" />
          ) : (
            <Moon className="w-4 h-4 text-[#0C3B4A]" />
          )}
        </button>

        {/* User Menu & Role Badge */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-[10px] hover:bg-[#F4F8F7] dark:hover:bg-[#143540] border border-transparent hover:border-[#DDE7E5] dark:hover:border-[#1A4452] transition-colors"
          >
            <div className="w-8 h-8 rounded-[8px] bg-[#0C3B4A] dark:bg-[#2CC7BF] text-white dark:text-[#08191F] flex items-center justify-center font-display font-bold text-xs">
              {currentRole === 'Owner'
                ? 'DR'
                : currentRole === 'Dentist'
                ? 'SA'
                : currentRole === 'Branch Manager'
                ? 'GF'
                : 'DF'}
            </div>
            <div className="hidden md:flex flex-col text-start">
              <span className="text-xs font-semibold text-[#10262D] dark:text-[#E8F2F0] leading-none">
                Dr. Sahra Awale
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="inline-block px-1.5 py-0.2 text-[10px] font-semibold bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF] rounded">
                  {currentRole}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 hidden md:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute end-0 mt-1.5 w-60 bg-white dark:bg-[#0F2830] rounded-[10px] shadow-xl border border-[#DDE7E5] dark:border-[#1A4452] py-2 z-50">
              <div className="px-4 py-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">Signed in as</p>
                <p className="text-sm font-bold text-[#10262D] dark:text-[#E8F2F0]">
                  Dr. Sahra Awale
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#12A6A0]" />
                  <span className="text-xs font-semibold text-[#0C3B4A] dark:text-[#2CC7BF]">
                    Role: {currentRole}
                  </span>
                </div>
              </div>

              {/* Role Switcher for Prototyping */}
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#536E75] dark:text-[#8AA4A0]">
                Switch Active Role
              </div>
              <div className="px-2 space-y-0.5">
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onRoleChange(r);
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-[6px] text-start transition-colors ${
                      currentRole === r
                        ? 'bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF] font-semibold'
                        : 'text-[#10262D] dark:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540]'
                    }`}
                  >
                    <span>{r}</span>
                    {currentRole === r && <Check className="w-3.5 h-3.5 text-[#12A6A0]" />}
                  </button>
                ))}
              </div>

              <div className="h-px bg-[#DDE7E5] dark:bg-[#1A4452] my-2" />
              <div className="px-4 py-1 text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                {currentRole === 'Owner'
                  ? 'All branches & financial settings unlocked.'
                  : 'Branch-scoped permissions active.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
