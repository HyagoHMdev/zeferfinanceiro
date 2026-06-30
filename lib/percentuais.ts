import type { PercentualChave, PercentualMensal } from "@/lib/types";

/** Retorna o mês 'YYYY-MM' de uma data ISO ('YYYY-MM-DD'). */
export function mesDe(dataISO: string | null | undefined): string {
  return (dataISO ?? "").slice(0, 7);
}

/** Converte 'YYYY-MM' em data de competência 'YYYY-MM-01'. */
export function competenciaISO(yyyymm: string): string {
  return `${yyyymm}-01`;
}

/**
 * Procura o percentual mensal para (chave, entidade, mês da data). Retorna a
 * fração (ex.: 0.0175) ou null se não houver valor definido para aquele mês.
 */
export function resolverPercentualMensal(
  rows: PercentualMensal[],
  chave: PercentualChave,
  entidadeId: string | null,
  dataISO: string,
): number | null {
  const mes = mesDe(dataISO);
  if (!mes) return null;
  const row = rows.find(
    (r) =>
      r.chave === chave &&
      (r.entidade_id ?? null) === (entidadeId ?? null) &&
      mesDe(r.competencia) === mes,
  );
  return row ? Number(row.percentual) : null;
}

/**
 * Percentual com cascata de fallback: usa o valor do mês; senão o primeiro
 * fallback não nulo (padrão do cadastro, depois o global). 0 se nada existir.
 */
export function percentualComFallback(
  rows: PercentualMensal[],
  chave: PercentualChave,
  entidadeId: string | null,
  dataISO: string,
  ...fallbacks: (number | null | undefined)[]
): number {
  const mensal = resolverPercentualMensal(rows, chave, entidadeId, dataISO);
  if (mensal != null) return mensal;
  for (const f of fallbacks) if (f != null) return Number(f);
  return 0;
}
