import type { BranchRegion } from './branches/types.ts'

export type ForeignCurrency = 'SLSH' | 'ETB'

export type FxRates = {
  fx_slsh_per_usd: number | null
  fx_etb_per_usd: number | null
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatTaxPercent(rate: number) {
  const pct = Number(rate) * 100
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`
}

/** Foreign currency units for 1 USD → amount in that currency. */
export function convertUsd(usd: number, ratePerUsd: number): number {
  return Number(usd) * Number(ratePerUsd)
}

export function foreignCurrencyForRegion(region: BranchRegion | null | undefined): ForeignCurrency {
  return region === 'ethiopia' ? 'ETB' : 'SLSH'
}

export function rateForRegion(
  region: BranchRegion | null | undefined,
  rates: FxRates | null | undefined,
): number | null {
  if (!rates) return null
  if (region === 'ethiopia') {
    return rates.fx_etb_per_usd != null && rates.fx_etb_per_usd > 0
      ? rates.fx_etb_per_usd
      : null
  }
  return rates.fx_slsh_per_usd != null && rates.fx_slsh_per_usd > 0
    ? rates.fx_slsh_per_usd
    : null
}

export function formatForeign(
  usd: number,
  currency: ForeignCurrency,
  ratePerUsd: number,
): string {
  const amount = convertUsd(usd, ratePerUsd)
  if (currency === 'SLSH') {
    return `${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(Math.round(amount))} SLSH`
  }
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ETB`
}

/** USD plus regional foreign amount when that rate is set. */
export function formatMoneyForRegion(
  usd: number,
  region: BranchRegion | null | undefined,
  rates: FxRates | null | undefined,
): string {
  const usdText = formatMoney(usd)
  const currency = foreignCurrencyForRegion(region)
  const rate = rateForRegion(region, rates)
  if (rate == null) return usdText
  return `${usdText} · ${formatForeign(usd, currency, rate)}`
}

export function regionLabel(region: BranchRegion | null | undefined): string {
  if (region === 'ethiopia') return 'Ethiopia'
  return 'Somaliland'
}
