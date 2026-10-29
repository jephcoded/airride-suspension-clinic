/** Kobo -> "₦185,000" */
export function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const toKobo = (naira: number) => Math.round(naira * 100);
