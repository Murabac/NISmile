import React, { useState } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowRight,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Building2,
  RefreshCw,
  Send,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { BranchId, Language, Role } from '../../types';
import { translations } from '../../i18n/translations';
import {
  mockStockItems,
  mockAppointments,
  mockCustomers,
  mockSales14Days,
  mockBranchComparison,
} from '../../data/mockData';
import { StatusPill } from '../common/StatusPill';

interface DashboardScreenProps {
  currentBranch: BranchId;
  language: Language;
  currentRole: Role;
  onNavigate: (screen: any) => void;
  onSelectStockItem?: (itemId: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  currentBranch,
  language,
  currentRole,
  onNavigate,
  onSelectStockItem,
}) => {
  const t = translations[language];
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Compute metrics based on branch filter
  const branchStockItems = mockStockItems.filter((item) => {
    if (currentBranch === 'all') return true;
    return (item.branchQuantities[currentBranch] || 0) >= 0;
  });

  const lowStockCount = branchStockItems.filter((i) => {
    const qty =
      currentBranch === 'all'
        ? Object.values(i.branchQuantities).reduce((a, b) => a + b, 0)
        : i.branchQuantities[currentBranch] || 0;
    return qty > 0 && qty <= i.reorderLevel;
  }).length;

  const outOfStockCount = branchStockItems.filter((i) => {
    const qty =
      currentBranch === 'all'
        ? Object.values(i.branchQuantities).reduce((a, b) => a + b, 0)
        : i.branchQuantities[currentBranch] || 0;
    return qty === 0;
  }).length;

  const expiringCount = branchStockItems.filter((i) => {
    return i.nearestExpiry <= '2026-12-31';
  }).length;

  const totalWholesaleDebt = mockCustomers
    .filter((c) => c.type === 'wholesale')
    .filter((c) => currentBranch === 'all' || c.branchId === currentBranch)
    .reduce((acc, c) => acc + c.currentBalance, 0);

  const todayAppointments = mockAppointments.filter((a) => {
    if (a.date !== '2026-10-13') return false;
    return currentBranch === 'all' || a.branchId === currentBranch;
  });

  // Needs Attention feed
  const needsAttentionList = [
    {
      id: 'att-1',
      type: 'stock',
      title: 'Impression Material Putty',
      detail: '0 units in Central Clinic (Out of stock)',
      action: 'Transfer Stock',
      statusVariant: 'out-of-stock' as const,
      statusLabel: 'Out of stock',
      actionHandler: () => onNavigate('transfers'),
    },
    {
      id: 'att-2',
      type: 'expiry',
      title: 'Lidocaine 2% Cartridges (Batch #LID-NEAR-440)',
      detail: 'Expires Nov 20, 2026 (38 days remaining)',
      action: 'Inspect Batch',
      statusVariant: 'near-expiry' as const,
      statusLabel: 'Expires in 38d',
      actionHandler: () => onNavigate('stock'),
    },
    {
      id: 'att-3',
      type: 'debt',
      title: 'SomCare Central Pharmacy',
      detail: '$2,850.00 overdue on Net 30 wholesale invoice',
      action: 'Send WhatsApp Reminder',
      statusVariant: 'cancelled' as const,
      statusLabel: 'Overdue ($2,850)',
      actionHandler: () => onNavigate('whatsapp'),
    },
    {
      id: 'att-4',
      type: 'appointment',
      title: 'Khadar Hassan Elmi (Extraction at 14:00)',
      detail: 'WhatsApp reminder sent, awaiting patient confirmation',
      action: 'Confirm',
      statusVariant: 'scheduled' as const,
      statusLabel: 'Unconfirmed',
      actionHandler: () => onNavigate('appointments'),
    },
  ];

  // SVG Chart calculation for 14-day sales
  const maxSale = Math.max(...mockSales14Days.map((d) => d.sales));
  const minSale = Math.min(...mockSales14Days.map((d) => d.sales));
  const chartHeight = 160;
  const chartWidth = 720;
  const paddingX = 30;
  const paddingY = 20;

  const points = mockSales14Days.map((d, index) => {
    const x =
      paddingX +
      (index / (mockSales14Days.length - 1)) * (chartWidth - paddingX * 2);
    const y =
      chartHeight -
      paddingY -
      ((d.sales - minSale * 0.8) / (maxSale - minSale * 0.8)) *
        (chartHeight - paddingY * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.dashboard.title}
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
            {t.dashboard.subtitle}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Sale (POS)</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('appointments')}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-[10px] bg-white dark:bg-[#0F2830] text-[#0C3B4A] dark:text-[#2CC7BF] border border-[#DDE7E5] dark:border-[#1A4452] hover:border-[#12A6A0] transition-colors"
          >
            <Calendar className="w-4 h-4 text-[#12A6A0]" />
            <span>Book Patient</span>
          </button>
        </div>
      </div>

      {/* KPI 5-Card Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Today's Sales */}
        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
            <span>{t.dashboard.todaySales}</span>
            <DollarSign className="w-4 h-4 text-[#12A6A0]" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-[#0C3B4A] dark:text-[#E8F2F0] font-mono tabular-nums">
            $2,740.00
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#2E9E6B] font-semibold">
            <TrendingUp className="w-3 h-3" />
            <span>+14.2% vs yesterday</span>
          </div>
        </div>

        {/* Appointments Today */}
        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
            <span>{t.dashboard.todayAppointments}</span>
            <Calendar className="w-4 h-4 text-[#12A6A0]" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-[#0C3B4A] dark:text-[#E8F2F0] font-mono tabular-nums">
            {todayAppointments.length}
          </div>
          <div className="mt-1 text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
            <span className="font-semibold text-[#2E9E6B]">
              {todayAppointments.filter((a) => a.status === 'Confirmed').length}{' '}
              confirmed
            </span>{' '}
            · 1 completed
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
            <span>{t.dashboard.lowStockItems}</span>
            <AlertTriangle className="w-4 h-4 text-[#E0A100]" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-[#E0A100] font-mono tabular-nums">
            {lowStockCount + outOfStockCount}
          </div>
          <div className="mt-1 text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
            <span className="font-semibold text-[#D64545]">{outOfStockCount} zero stock</span>{' '}
            · {lowStockCount} below reorder
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
            <span>{t.dashboard.expiringBatches}</span>
            <Clock className="w-4 h-4 text-[#E0A100]" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-[#0C3B4A] dark:text-[#E8F2F0] font-mono tabular-nums">
            {expiringCount}
          </div>
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
            Nearest: Nov 20, 2026
          </div>
        </div>

        {/* Outstanding Wholesale Debt */}
        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
            <span>{t.dashboard.wholesaleDebt}</span>
            <TrendingUp className="w-4 h-4 text-[#D64545]" />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-[#0C3B4A] dark:text-[#E8F2F0] font-mono tabular-nums">
            ${totalWholesaleDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
            Across 4 wholesale accounts
          </div>
        </div>
      </div>

      {/* Main Grid: 14-Day Sales Chart & Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 14-Day Sales Trend */}
        <div className="lg:col-span-2 p-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E5] dark:border-[#1A4452]">
            <div>
              <h2 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                {t.dashboard.sales14Days}
              </h2>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
                Daily revenue in USD with appointment correlations
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[#10262D] dark:text-[#E8F2F0]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#12A6A0]" />
                Sales ($USD)
              </span>
              <span className="font-mono text-[#536E75] dark:text-[#8AA4A0]">
                Avg: $2,217/day
              </span>
            </div>
          </div>

          {/* Interactive SVG Line Chart */}
          <div className="relative pt-6 pb-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
            >
              {/* Horizontal gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = paddingY + pct * (chartHeight - paddingY * 2);
                return (
                  <line
                    key={idx}
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-[#DDE7E5] dark:text-[#1A4452]"
                  />
                );
              })}

              {/* Area fill */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#12A6A0" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#12A6A0" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d={`${pathD} L ${points[points.length - 1].x} ${
                  chartHeight - paddingY
                } L ${points[0].x} ${chartHeight - paddingY} Z`}
                fill="url(#chartGradient)"
              />

              {/* Smooth trend path */}
              <path
                d={pathD}
                fill="none"
                stroke="#12A6A0"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint === i ? 5 : 3}
                    className="fill-white dark:fill-[#0F2830] stroke-[#12A6A0] stroke-2 cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint !== null && (
              <div
                className="absolute z-10 px-3 py-1.5 rounded-[8px] bg-[#0C3B4A] text-white text-xs shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(points[hoveredPoint].x / chartWidth) * 100}%`,
                  top: `${(points[hoveredPoint].y / chartHeight) * 100}%`,
                }}
              >
                <p className="font-bold font-mono">
                  ${points[hoveredPoint].sales.toFixed(2)}
                </p>
                <p className="text-[10px] text-[#12A6A0]">
                  {points[hoveredPoint].date} · {points[hoveredPoint].transactions} bills
                </p>
              </div>
            )}

            {/* X-axis date labels */}
            <div className="flex justify-between px-3 text-[10px] text-[#536E75] dark:text-[#8AA4A0] font-mono pt-2">
              <span>{mockSales14Days[0].date}</span>
              <span>{mockSales14Days[4].date}</span>
              <span>{mockSales14Days[8].date}</span>
              <span>{mockSales14Days[13].date} (Today)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#DDE7E5] dark:border-[#1A4452] flex items-center justify-between text-xs text-[#536E75] dark:text-[#8AA4A0]">
            <span>14-day total: <strong className="font-mono text-[#0C3B4A] dark:text-[#E8F2F0]">$31,040.00</strong></span>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="font-semibold text-[#12A6A0] hover:underline flex items-center gap-1"
            >
              Detailed sales analytics <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 1 Col: Needs Attention List */}
        <div className="p-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E5] dark:border-[#1A4452]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#E0A100]" />
                <h2 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                  {t.dashboard.needsAttention}
                </h2>
              </div>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full">
                4 items
              </span>
            </div>

            <div className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452] mt-2">
              {needsAttentionList.map((item) => (
                <div key={item.id} className="py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-[#10262D] dark:text-[#E8F2F0] leading-snug">
                      {item.title}
                    </p>
                    <StatusPill
                      variant={item.statusVariant}
                      label={item.statusLabel}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-[#536E75] dark:text-[#8AA4A0]">
                    {item.detail}
                  </p>
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={item.actionHandler}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#0C3B4A] dark:text-[#2CC7BF] bg-[#F4F8F7] dark:bg-[#143540] hover:bg-[#12A6A0]/15 rounded-[6px] border border-[#DDE7E5] dark:border-[#1A4452] transition-colors"
                    >
                      {item.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#DDE7E5] dark:border-[#1A4452] text-end">
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-[#12A6A0] hover:underline"
            >
              {t.dashboard.viewAll} issues & inventory alerts
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Branch Comparison (Prominent when "All branches" is selected) */}
      {currentBranch === 'all' && (
        <div className="p-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E5] dark:border-[#1A4452]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#12A6A0]" />
              <div>
                <h3 className="font-display text-sm font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                  {t.dashboard.branchComparison}
                </h3>
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
                  Consolidated view for Clinic Owner across all active operating clinics
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#536E75] dark:text-[#8AA4A0]">
              Oct 2026 MTD
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockBranchComparison.map((b) => (
              <div
                key={b.branch}
                className="p-4 bg-[#F4F8F7] dark:bg-[#143540] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[#0C3B4A] dark:text-[#E8F2F0]">
                    {b.branch}
                  </h4>
                  <span className="text-[11px] font-semibold text-[#2E9E6B]">
                    Active
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#536E75] dark:text-[#8AA4A0]">MTD Revenue:</span>
                    <span className="font-mono font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                      ${b.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#536E75] dark:text-[#8AA4A0]">Stock Asset Value:</span>
                    <span className="font-mono font-medium">
                      ${b.stockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#536E75] dark:text-[#8AA4A0]">Monthly Patients:</span>
                    <span className="font-mono">{b.appointments} visits</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#536E75] dark:text-[#8AA4A0]">Low Stock Alerts:</span>
                    <span
                      className={`font-mono font-bold ${
                        b.lowStockCount > 0 ? 'text-[#E0A100]' : 'text-[#2E9E6B]'
                      }`}
                    >
                      {b.lowStockCount} items
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="w-full bg-[#DDE7E5] dark:bg-[#1A4452] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#12A6A0] h-full rounded-full"
                      style={{ width: `${(b.revenue / 16840) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-end text-[#536E75] dark:text-[#8AA4A0] mt-1 font-mono">
                    {((b.revenue / (16840 + 9450 + 6890)) * 100).toFixed(1)}% network share
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
