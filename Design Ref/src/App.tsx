import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { BranchId, Language, Role } from './types';
import { Header } from './components/common/Header';
import { Sidebar, ScreenId } from './components/common/Sidebar';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { PointOfSaleScreen } from './components/screens/PointOfSaleScreen';
import { StockScreen } from './components/screens/StockScreen';
import { TransfersScreen } from './components/screens/TransfersScreen';
import { PurchasesScreen } from './components/screens/PurchasesScreen';
import { ServicesScreen } from './components/screens/ServicesScreen';
import { CustomersScreen } from './components/screens/CustomersScreen';
import { AppointmentsScreen } from './components/screens/AppointmentsScreen';
import { PromotionsScreen } from './components/screens/PromotionsScreen';
import { WhatsAppScreen } from './components/screens/WhatsAppScreen';
import { ReportsScreen } from './components/screens/ReportsScreen';
import { ImportScreen } from './components/screens/ImportScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('dashboard');
  const [currentBranch, setCurrentBranch] = useState<BranchId>('all');
  const [language, setLanguage] = useState<Language>('en');
  const [currentRole, setCurrentRole] = useState<Role>('Owner');
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Sync dark mode class on HTML document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Sync RTL / LTR layout and language code on HTML document
  useEffect(() => {
    if (language === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = language;
    }
  }, [language]);

  // Handle role restrictions on branch selection
  const handleRoleChange = (newRole: Role) => {
    setCurrentRole(newRole);
    if (newRole !== 'Owner' && currentBranch === 'all') {
      // Non-owners can only see their designated branch
      if (newRole === 'Branch Manager') {
        setCurrentBranch('hargeisa-north');
      } else if (newRole === 'Dentist') {
        setCurrentBranch('main');
      } else {
        setCurrentBranch('main');
      }
    }
  };

  const handleBranchChange = (branch: BranchId) => {
    if (currentRole !== 'Owner' && branch === 'all') {
      return;
    }
    setCurrentBranch(branch);
  };

  return (
    <div className="min-h-screen bg-[#F4F8F7] dark:bg-[#08191F] text-[#10262D] dark:text-[#E8F2F0] flex flex-col font-body transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        language={language}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        badgeCounts={{
          stockAlerts: 3,
          unconfirmedAppointments: 2,
          activePromotions: 3,
          whatsappQueue: 1,
        }}
      />

      {/* Main Content Area - uses logical margin-inline-start (ms-64) for perfect RTL/LTR mirroring */}
      <div className="flex-1 lg:ms-64 flex flex-col min-w-0">
        {/* Top Header */}
        <div className="flex items-center">
          {/* Mobile hamburger menu button */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-3 text-[#0C3B4A] dark:text-[#E8F2F0] hover:bg-[#EEF4F3] dark:hover:bg-[#143540] border-b border-[#DDE7E5] dark:border-[#1A4452]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <Header
              currentBranch={currentBranch}
              onBranchChange={handleBranchChange}
              language={language}
              onLanguageChange={setLanguage}
              isDark={isDark}
              onToggleDark={() => setIsDark(!isDark)}
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
              needsAttentionCount={4}
              onOpenNotifications={() => setCurrentScreen('dashboard')}
            />
          </div>
        </div>

        {/* Viewport Content Container */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              currentBranch={currentBranch}
              language={language}
              currentRole={currentRole}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === 'pos' && (
            <PointOfSaleScreen
              currentBranch={currentBranch}
              language={language}
            />
          )}

          {currentScreen === 'stock' && (
            <StockScreen
              currentBranch={currentBranch}
              language={language}
            />
          )}

          {currentScreen === 'transfers' && (
            <TransfersScreen
              currentBranch={currentBranch}
              language={language}
            />
          )}

          {currentScreen === 'purchases' && (
            <PurchasesScreen
              currentBranch={currentBranch}
              language={language}
            />
          )}

          {currentScreen === 'services' && (
            <ServicesScreen language={language} />
          )}

          {currentScreen === 'customers' && (
            <CustomersScreen language={language} />
          )}

          {currentScreen === 'appointments' && (
            <AppointmentsScreen
              currentBranch={currentBranch}
              language={language}
            />
          )}

          {currentScreen === 'promotions' && (
            <PromotionsScreen language={language} />
          )}

          {currentScreen === 'whatsapp' && (
            <WhatsAppScreen language={language} />
          )}

          {currentScreen === 'reports' && (
            <ReportsScreen
              currentBranch={currentBranch}
              language={language}
            />
          )}

          {currentScreen === 'import' && (
            <ImportScreen language={language} />
          )}

          {currentScreen === 'settings' && (
            <SettingsScreen
              language={language}
              onLanguageChange={setLanguage}
            />
          )}
        </main>
      </div>
    </div>
  );
}
