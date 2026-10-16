import * as XLSX from 'xlsx'

export type ImportKind = 'items' | 'customers' | 'opening_stock'

const TEMPLATES: Record<ImportKind, { headers: string[]; sample: string[] }> = {
  items: {
    headers: [
      'sku',
      'name',
      'category',
      'unit',
      'cost',
      'reorder_level',
      'retail_price',
      'wholesale_price',
      'barcode',
    ],
    sample: [
      'IMP-DEMO-01',
      'Demo Flouride Varnish',
      'Preventive',
      'Tube',
      '4.50',
      '10',
      '12.00',
      '9.50',
      '',
    ],
  },
  customers: {
    headers: [
      'name',
      'customer_type',
      'subtype',
      'phone',
      'credit_limit',
      'notes',
    ],
    sample: [
      'Demo Wholesale Clinic',
      'wholesale',
      'clinic',
      '+252634000001',
      '1000',
      'Import sample',
    ],
  },
  opening_stock: {
    headers: ['sku', 'batch_no', 'expiry_date', 'quantity', 'unit_cost', 'legacy'],
    sample: ['IMP-DEMO-01', 'OPEN-IMP-01', '2027-12-31', '20', '4.50', 'n'],
  },
}

export function downloadTemplate(kind: ImportKind) {
  const t = TEMPLATES[kind]
  const sheet = XLSX.utils.aoa_to_sheet([t.headers, t.sample])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Import')
  XLSX.writeFile(book, `dentaflow_${kind}_template.xlsx`)
}

/** Read the first sheet of an .xlsx / .xls file into row objects keyed by header. */
export async function parseExcel(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = book.SheetNames[0]
  if (!sheetName) return []
  const sheet = book.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  })

  return rawRows
    .map((row) => {
      const obj: Record<string, string> = {}
      for (const [key, value] of Object.entries(row)) {
        obj[key.trim().toLowerCase()] = cellToString(value)
      }
      return obj
    })
    .filter((row) => Object.values(row).some((value) => value !== ''))
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return String(value).trim()
}
