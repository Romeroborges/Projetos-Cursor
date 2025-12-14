export function formatBRLFromCents(cents: number): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Aceita: "12", "12,50", "12.50", "R$ 12,50".
export function parseBRLToCents(input: string): number {
  const raw = (input ?? '').trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(/[^0-9.,-]/g, '');

  // Normaliza decimal para "." e remove milhares.
  // Estratégia: se tiver vírgula, considera vírgula como decimal e remove pontos.
  if (cleaned.includes(',')) {
    const noThousands = cleaned.replace(/\./g, '');
    const normalized = noThousands.replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  // Sem vírgula: pode ser inteiro ou decimal com ponto
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
