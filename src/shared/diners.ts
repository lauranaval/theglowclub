// Imports en cèntims enters. Mai no es fa servir float per calcular diners.

/** Converteix un text en euros («8», «0,10», «12.5») a cèntims. Retorna null si no és un import vàlid. */
export function eurosACents(text: string): number | null {
  const net = text.trim().replace(/\s|€/g, "");
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(net);
  if (!m) return null;
  const euros = Number(m[1]);
  const cents = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return euros * 100 + cents;
}

/** Format català: «1.234,50 €», «0,30 €», «−5,00 €». */
export function formatEuros(cents: number): string {
  const signe = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resta = (abs % 100).toString().padStart(2, "0");
  return `${signe}${euros},${resta} €`;
}

export function esCentsValids(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
}
