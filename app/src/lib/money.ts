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
