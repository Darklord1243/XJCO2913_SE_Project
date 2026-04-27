import { toFiniteNumber } from './number';

const gbpCurrencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const amount = toFiniteNumber(value, 0);
  return gbpCurrencyFormatter.format(amount);
}
