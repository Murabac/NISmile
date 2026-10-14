import ExcelJS from 'exceljs'
import {
  CLINIC_ADDRESS,
  CLINIC_LEGAL_NAME,
  CLINIC_PHONE,
  CLINIC_TAX_ID,
} from '../clinic.ts'
import {
  generatedAtLabel,
  humanizeKey,
  isMoneyKey,
  reportSubtitle,
  reportTitle,
} from './format.ts'
import type { ReportPeriod, ReportResult, ReportType } from './types.ts'

const MARINE = 'FF0C3B4A'
const TEAL = 'FF12A6A0'
const ENAMEL = 'FFF4F8F7'
const WHITE = 'FFFFFFFF'
const INK = 'FF10262D'
const MUTED = 'FF536E75'

type ExportInput = {
  type: ReportType
  period: ReportPeriod
  branchLabel: string
  data: ReportResult
}

export async function exportReportExcel(input: ExportInput): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DentaFlow'
  workbook.created = new Date()
  workbook.modified = new Date()

  const title = reportTitle(input.type)
  const subtitle = reportSubtitle({
    type: input.type,
    period: input.period,
    branchLabel: input.branchLabel,
    startsAt: input.data.starts_at,
    endsAt: input.data.ends_at,
  })
  const generated = generatedAtLabel()

  const summary = workbook.addWorksheet('Summary', {
    views: [{ showGridLines: false }],
  })
  paintCoverSheet(summary, {
    title,
    subtitle,
    generated,
    totals: input.data.totals ?? {},
    note: input.data.note,
  })

  if ((input.data.by_branch ?? []).length > 0) {
    const sheet = workbook.addWorksheet('By branch', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    paintDataSheet(sheet, input.data.by_branch ?? [], 'By branch')
  }

  const detail = workbook.addWorksheet('Detail', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  paintDataSheet(detail, input.data.rows ?? [], 'Detail')

  const safeName = `${title.replace(/[^\w]+/g, '_')}_${input.period}`
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `DentaFlow_${safeName}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function paintCoverSheet(
  sheet: ExcelJS.Worksheet,
  input: {
    title: string
    subtitle: string
    generated: string
    totals: Record<string, number | string | null>
    note?: string
  },
) {
  sheet.columns = [{ width: 28 }, { width: 22 }, { width: 42 }]

  sheet.mergeCells('A1:C1')
  const brand = sheet.getCell('A1')
  brand.value = CLINIC_LEGAL_NAME
  brand.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } }
  brand.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARINE } }
  brand.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 22

  sheet.mergeCells('A2:C2')
  const clinic = sheet.getCell('A2')
  clinic.value = `${CLINIC_ADDRESS} · Tel ${CLINIC_PHONE} · Tax ID ${CLINIC_TAX_ID}`
  clinic.font = { name: 'Calibri', size: 9, color: { argb: MUTED } }
  clinic.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENAMEL } }

  sheet.mergeCells('A4:C4')
  const title = sheet.getCell('A4')
  title.value = input.title
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: MARINE } }
  sheet.getRow(4).height = 28

  sheet.mergeCells('A5:C5')
  const sub = sheet.getCell('A5')
  sub.value = input.subtitle
  sub.font = { name: 'Calibri', size: 10, color: { argb: MUTED } }

  sheet.mergeCells('A6:C6')
  const gen = sheet.getCell('A6')
  gen.value = `Generated ${input.generated} · DentaFlow`
  gen.font = { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } }

  sheet.getCell('A8').value = 'Metric'
  sheet.getCell('B8').value = 'Value'
  styleHeaderRow(sheet.getRow(8), 2)

  let rowIndex = 9
  const entries = Object.entries(input.totals)
  if (entries.length === 0) {
    sheet.getCell(`A${rowIndex}`).value = 'No totals'
    sheet.getCell(`B${rowIndex}`).value = '—'
    rowIndex += 1
  } else {
    for (const [key, raw] of entries) {
      const labelCell = sheet.getCell(`A${rowIndex}`)
      const valueCell = sheet.getCell(`B${rowIndex}`)
      labelCell.value = humanizeKey(key)
      labelCell.font = { name: 'Calibri', size: 10, color: { argb: INK } }
      applyValue(valueCell, key, raw)
      if (rowIndex % 2 === 1) {
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENAMEL } }
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENAMEL } }
      }
      rowIndex += 1
    }
  }

  if (input.note) {
    rowIndex += 1
    sheet.mergeCells(`A${rowIndex}:C${rowIndex}`)
    const note = sheet.getCell(`A${rowIndex}`)
    note.value = input.note
    note.font = { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } }
  }

  rowIndex += 2
  sheet.mergeCells(`A${rowIndex}:C${rowIndex}`)
  const footer = sheet.getCell(`A${rowIndex}`)
  footer.value =
    'Confidential clinic report · Prepared with DentaFlow · Figures in USD unless noted'
  footer.font = { name: 'Calibri', size: 8, color: { argb: MUTED } }
  footer.border = {
    top: { style: 'thin', color: { argb: 'FFDDE7E5' } },
  }
}

function paintDataSheet(
  sheet: ExcelJS.Worksheet,
  rows: Record<string, unknown>[],
  emptyLabel: string,
) {
  if (rows.length === 0) {
    sheet.columns = [{ width: 40 }]
    sheet.getCell('A1').value = `No ${emptyLabel.toLowerCase()} rows for this filter.`
    sheet.getCell('A1').font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
    return
  }

  const keys = Object.keys(rows[0]!)
  sheet.columns = keys.map((key) => ({
    header: humanizeKey(key),
    key,
    width: Math.min(36, Math.max(12, humanizeKey(key).length + 4)),
  }))

  styleHeaderRow(sheet.getRow(1), keys.length)

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 2)
    keys.forEach((key, col) => {
      const cell = excelRow.getCell(col + 1)
      applyValue(cell, key, row[key])
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENAMEL } }
      }
    })
  })

  const footerRow = rows.length + 3
  sheet.mergeCells(footerRow, 1, footerRow, keys.length)
  const footer = sheet.getCell(footerRow, 1)
  footer.value = `${rows.length} row(s) · ${CLINIC_LEGAL_NAME} · DentaFlow`
  footer.font = { name: 'Calibri', size: 8, color: { argb: MUTED } }
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 20
  for (let i = 1; i <= colCount; i += 1) {
    const cell = row.getCell(i)
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARINE } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: TEAL } },
    }
  }
}

function applyValue(cell: ExcelJS.Cell, key: string, value: unknown) {
  cell.font = { name: 'Calibri', size: 10, color: { argb: INK } }
  if (value == null || value === '') {
    cell.value = '—'
    return
  }
  if (typeof value === 'boolean') {
    cell.value = value ? 'Yes' : 'No'
    return
  }
  if (typeof value === 'number') {
    cell.value = value
    if (isMoneyKey(key) || (!Number.isInteger(value) && Math.abs(value) >= 0.01)) {
      cell.numFmt = '"$"#,##0.00'
      cell.alignment = { horizontal: 'right' }
    } else {
      cell.numFmt = Number.isInteger(value) ? '0' : '0.##'
      cell.alignment = { horizontal: 'right' }
    }
    return
  }
  cell.value = String(value)
}
