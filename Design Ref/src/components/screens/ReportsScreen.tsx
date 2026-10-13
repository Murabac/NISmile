import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  Percent,
  FileSpreadsheet,
  Building2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { BranchId, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { mockBranchComparison, mockStockItems } from '../../data/mockData';

interface ReportsScreenProps {
  currentBranch: BranchId;
  language: Language;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  currentBranch,
  language,
}) => {
  const t = translations[language];

  const [reportType, setReportType] = useState<
    | 'sales'
    | 'profit'
    | 'valuation'
    | 'expiry'
    | 'debts'
    | 'vat'
    | 'promos'
  >('sales');

  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'mtd' | 'ytd'>('mtd');

  const handleExportCSV = () => {
    // Generate simple client-side CSV trigger
    const rows = [
      ['DentaFlow Clinical & Financial Report', reportType.toUpperCase()],
      ['Generated Date', '2026-10-13'],
      ['Branch', currentBranch],
      [''],
      ['Metric / Identifier', 'Value USD', 'Reference Category'],
      ['Main Clinic Revenue', '16840.00', 'Central'],
      ['Hargeisa North Revenue', '9450.00', 'North'],
      ['Burao Revenue', '6890.00', 'East'],
      ['Consolidated VAT Collected (5%)', '1659.00', 'Tax Authority'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DentaFlow_${reportType}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.reports} & Audit Analytics
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Financial ledgers, branch comparisons, tax liabilities, and inventory holding valuations
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-[10px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Statement</span>
        </button>
      </div>

      {/* Filter and Report Type Selection */}
      <div className="bg-white dark:bg-[#0F2830] p-4 rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-3 shadow-xs">
        {/* Report Types Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
          {[
            { id: 'sales', label: 'Sales by Branch' },
            { id: 'profit', label: 'Profit & Margins' },
            { id: 'valuation', label: 'Stock Asset Valuation' },
            { id: 'expiry', label: 'Expiry Risk Audit' },
            { id: 'debts', label: 'Wholesale Receivables' },
            { id: 'vat', label: 'VAT 5% Tax Ledger' },
            { id: 'promos', label: 'Promotion ROI' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReportType(r.id as any)}
              className={`px-3 py-1.5 rounded-[8px] whitespace-nowrap text-xs font-semibold transition-colors ${
                reportType === r.id
                  ? 'bg-[#0C3B4A] text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
                  : 'bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Date Filter & Aggregation */}
        <div className="flex items-center justify-between pt-2 border-t border-[#EEF4F3] dark:border-[#1A4452] text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#12A6A0]" />
            <span className="font-semibold text-[#10262D] dark:text-[#E8F2F0]">Period:</span>
            <div className="flex items-center gap-1">
              {(['today', '7d', '30d', 'mtd', 'ytd'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 rounded text-[11px] font-mono uppercase font-bold ${
                    period === p
                      ? 'bg-[#12A6A0]/15 text-[#0C3B4A] dark:text-[#2CC7BF]'
                      : 'text-[#536E75] hover:bg-[#EEF4F3]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] font-mono">
            Reporting Currency: USD ($)
          </span>
        </div>
      </div>

      {/* Metric Highlights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452]">
          <span className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Gross Period Revenue
          </span>
          <p className="font-mono text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] mt-1 tabular-nums">
            $33,180.00
          </p>
          <span className="text-[11px] text-[#2E9E6B] font-semibold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> +18.4% compared to prior month
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452]">
          <span className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Gross Clinical Profit (COGS Deducted)
          </span>
          <p className="font-mono text-2xl font-black text-[#12A6A0] mt-1 tabular-nums">
            $21,440.00
          </p>
          <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] font-mono mt-1 block">
            Average margin: 64.6%
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452]">
          <span className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            VAT Collected (5.0%)
          </span>
          <p className="font-mono text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] mt-1 tabular-nums">
            $1,659.00
          </p>
          <span className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] font-mono mt-1 block">
            Ready for tax return export
          </span>
        </div>
      </div>

      {/* Main Table for the Selected Report */}
      <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#DDE7E5] dark:border-[#1A4452] flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#0C3B4A] dark:text-[#E8F2F0]">
            {reportType === 'sales'
              ? 'Multi-Branch Revenue & Performance Audit'
              : reportType === 'profit'
              ? 'Margin Breakdown by Treatment & Category'
              : reportType === 'valuation'
              ? 'Clinical Inventory Asset Balance Sheet'
              : reportType === 'vat'
              ? 'Tax Invoice Line Output (5% Standard)'
              : 'Audit Data Ledger'}
          </h3>
          <span className="text-xs font-mono text-[#536E75] dark:text-[#8AA4A0]">
            October 2026
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] uppercase font-semibold text-[10px]">
                <th className="py-3 px-4 text-start">Entity / Department</th>
                <th className="py-3 px-4 text-end">Gross Sales</th>
                <th className="py-3 px-4 text-end">Cost of Goods</th>
                <th className="py-3 px-4 text-end">Net Profit</th>
                <th className="py-3 px-4 text-end">Margin %</th>
                <th className="py-3 px-4 text-end">Tax (5%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
              {mockBranchComparison.map((b) => {
                const cogs = b.revenue * 0.35;
                const profit = b.revenue - cogs;
                const vat = b.revenue * 0.05;

                return (
                  <tr key={b.branch} className="hover:bg-[#F4F8F7]/60 dark:hover:bg-[#143540]/60">
                    <td className="py-3.5 px-4 font-bold text-[#10262D] dark:text-[#E8F2F0]">
                      {b.branch}
                      <p className="text-[10px] text-[#536E75] font-normal">{b.appointments} patient visits</p>
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono tabular-nums font-bold text-[#0C3B4A] dark:text-[#2CC7BF]">
                      ${b.revenue.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono tabular-nums text-[#536E75] dark:text-[#8AA4A0]">
                      ${cogs.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono tabular-nums font-bold text-[#2E9E6B]">
                      ${profit.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono tabular-nums font-semibold">
                      65.0%
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono tabular-nums text-[#536E75]">
                      ${vat.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
