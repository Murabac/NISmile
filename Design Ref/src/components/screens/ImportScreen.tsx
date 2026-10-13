import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  ArrowRight,
  Boxes,
  Users,
  Database,
  Check,
} from 'lucide-react';
import { Language } from '../../types';
import { translations } from '../../i18n/translations';

interface ImportScreenProps {
  language: Language;
}

export const ImportScreen: React.FC<ImportScreenProps> = ({ language }) => {
  const t = translations[language];

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedEntity, setSelectedEntity] = useState<'items' | 'customers' | 'stock'>('items');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Sample error validation rows in review step
  const validationRows = [
    {
      row: 4,
      sku: 'RES-CMP-B1',
      name: 'Composite B1 Syringe',
      error: 'Invalid expiry date format: "31/02/2027" (day out of range)',
      severity: 'error' as const,
    },
    {
      row: 11,
      sku: 'CON-MSK-BLUE',
      name: 'Surgical Face Masks 3-Ply',
      error: 'Missing reorder level; system defaulted to 20 units',
      severity: 'warning' as const,
    },
  ];

  const handleDownloadTemplate = (type: string) => {
    let headers = '';
    if (type === 'items') {
      headers = 'SKU,Name,Category,RetailPrice,WholesalePrice,Unit,ReorderLevel,VATRate\nRES-CMP-A3,Composite A3 Syringe,Restorative,28.00,21.50,Syringe,25,0.05';
    } else if (type === 'customers') {
      headers = 'Name,Type,WholesaleSubtype,Phone,Email,PreferredLanguage,CreditLimit\nDr. Farah Clinic,wholesale,Clinic,+252634421890,orders@farah.so,so,5000';
    } else {
      headers = 'SKU,BatchNumber,ExpiryDate,Quantity,BranchId,UnitCost\nRES-CMP-A3,CMP-2026-90,2027-10-15,30,main,14.20';
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + headers;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DentaFlow_${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulateUpload = (fileName: string) => {
    setUploadedFileName(fileName);
    setCurrentStep(3); // jump to review
  };

  const handleConfirmImport = () => {
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      setCurrentStep(1);
      setUploadedFileName(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DDE7E5] dark:border-[#1A4452]">
        <div>
          <h1 className="font-display text-2xl font-black text-[#0C3B4A] dark:text-[#E8F2F0] tracking-tight">
            {t.nav.import} & Batch Migration
          </h1>
          <p className="text-xs text-[#536E75] dark:text-[#8AA4A0]">
            Three-step data pipeline with schema validation for items, customer profiles and opening stock
          </p>
        </div>
      </div>

      {/* 3-Step Wizard Indicator */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { num: 1, title: '1. Download Template', desc: 'Pre-formatted CSV schema' },
          { num: 2, title: '2. Upload CSV File', desc: 'Parse records into memory' },
          { num: 3, title: '3. Review & Validate', desc: 'Resolve row errors & commit' },
        ].map((s) => (
          <div
            key={s.num}
            onClick={() => setCurrentStep(s.num as any)}
            className={`p-3.5 rounded-[10px] border transition-all cursor-pointer ${
              currentStep === s.num
                ? 'bg-white dark:bg-[#0F2830] border-[#12A6A0] ring-2 ring-[#12A6A0]/20'
                : currentStep > s.num
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                : 'bg-[#F4F8F7] dark:bg-[#143540] border-[#DDE7E5] dark:border-[#1A4452] opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#0C3B4A] dark:text-[#E8F2F0]">
                {s.title}
              </span>
              {currentStep > s.num && <CheckCircle className="w-4 h-4 text-[#2E9E6B]" />}
            </div>
            <p className="text-[11px] text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {importSuccess && (
        <div className="p-4 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400 text-emerald-900 dark:text-emerald-200 rounded-[10px] text-xs font-semibold flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-[#2E9E6B] shrink-0" />
          <div>
            <p className="font-bold">Import Batch Committed Successfully!</p>
            <p className="text-[11px] font-normal">
              24 valid records merged into DentaFlow live branch inventory without overwriting existing batches.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Download Template */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
            Select Dataset to Download Template
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Items Card */}
            <div className="p-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-3 flex flex-col justify-between">
              <div>
                <Boxes className="w-7 h-7 text-[#12A6A0]" />
                <h4 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-2">
                  Clinical Items & Products
                </h4>
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1">
                  SKUs, names, clinical categories, retail prices, wholesale prices, units and reorder levels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleDownloadTemplate('items');
                  setCurrentStep(2);
                  setSelectedEntity('items');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Items Template</span>
              </button>
            </div>

            {/* Customers Card */}
            <div className="p-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-3 flex flex-col justify-between">
              <div>
                <Users className="w-7 h-7 text-[#12A6A0]" />
                <h4 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-2">
                  Customers & Patient Records
                </h4>
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1">
                  Names, types (Retail / Wholesale), subtypes, WhatsApp numbers, preferred languages and credit limits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleDownloadTemplate('customers');
                  setCurrentStep(2);
                  setSelectedEntity('customers');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Customers Template</span>
              </button>
            </div>

            {/* Opening Stock Card */}
            <div className="p-5 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] space-y-3 flex flex-col justify-between">
              <div>
                <Database className="w-7 h-7 text-[#12A6A0]" />
                <h4 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0] mt-2">
                  Opening Stock & Batches
                </h4>
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1">
                  Initial quantity counts, batch numbers, manufacturer expiry dates, branch assignments and unit costs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleDownloadTemplate('stock');
                  setCurrentStep(2);
                  setSelectedEntity('stock');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-[8px] bg-[#0C3B4A] text-white hover:bg-[#12A6A0] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Stock Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Upload File */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="p-8 bg-white dark:bg-[#0F2830] rounded-[10px] border-2 border-dashed border-[#DDE7E5] dark:border-[#1A4452] text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#12A6A0]/15 text-[#12A6A0] mx-auto flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                Upload CSV File for {selectedEntity.toUpperCase()}
              </h3>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-1">
                Drag and drop your populated spreadsheet or choose from test fixtures below.
              </p>
            </div>

            {/* Quick Test Fixtures */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => handleSimulateUpload('Hargeisa_Central_Opening_Stock_2026.csv')}
                className="px-3 py-2 rounded-[8px] bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] text-xs font-semibold hover:border-[#12A6A0]"
              >
                📄 Sample: Hargeisa_Central_Opening_Stock.csv
              </button>
              <button
                type="button"
                onClick={() => handleSimulateUpload('Burao_Branch_Items_Catalog.csv')}
                className="px-3 py-2 rounded-[8px] bg-[#F4F8F7] dark:bg-[#143540] border border-[#DDE7E5] dark:border-[#1A4452] text-xs font-semibold hover:border-[#12A6A0]"
              >
                📄 Sample: Burao_Branch_Items_Catalog.csv
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Validation */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-[#536E75] uppercase font-semibold">
                Parsed File
              </span>
              <p className="font-bold text-sm text-[#0C3B4A] dark:text-[#E8F2F0]">
                {uploadedFileName || 'Stock_Import_Batch_Oct2026.csv'}
              </p>
              <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                Total records: <strong className="font-mono">26</strong> · Valid:{' '}
                <strong className="font-mono text-[#2E9E6B]">24</strong> · Errors / Warnings:{' '}
                <strong className="font-mono text-[#D64545]">2</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-3 py-2 text-xs font-semibold text-[#536E75] hover:text-[#10262D]"
              >
                Upload Different File
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-[8px] bg-[#12A6A0] text-white hover:bg-[#0C3B4A] transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Import 24 Records</span>
              </button>
            </div>
          </div>

          {/* Validation Errors Table */}
          <div className="bg-white dark:bg-[#0F2830] rounded-[10px] border border-[#DDE7E5] dark:border-[#1A4452] overflow-hidden shadow-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E0A100]" />
              <span>Rows Requiring Attention Before Commit</span>
            </div>

            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#DDE7E5] dark:border-[#1A4452] bg-[#F4F8F7] dark:bg-[#143540] text-[#536E75] dark:text-[#8AA4A0] text-[10px] uppercase font-semibold">
                  <th className="py-2.5 px-3 text-start">Row #</th>
                  <th className="py-2.5 px-3 text-start">SKU / Code</th>
                  <th className="py-2.5 px-3 text-start">Item Name</th>
                  <th className="py-2.5 px-3 text-start">Validation Diagnostics</th>
                  <th className="py-2.5 px-3 text-center">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF4F3] dark:divide-[#1A4452]">
                {validationRows.map((v) => (
                  <tr key={v.row} className="hover:bg-[#F4F8F7]/60">
                    <td className="py-2.5 px-3 font-mono font-bold">{v.row}</td>
                    <td className="py-2.5 px-3 font-mono">{v.sku}</td>
                    <td className="py-2.5 px-3 font-medium">{v.name}</td>
                    <td className="py-2.5 px-3 text-[#10262D] dark:text-[#E8F2F0]">
                      {v.error}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          v.severity === 'error'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {v.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
