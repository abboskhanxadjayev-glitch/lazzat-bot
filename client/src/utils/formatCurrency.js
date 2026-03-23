export function formatCurrency(value) {
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "UZS",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}
