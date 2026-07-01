/** Helpers de formatação no padrão pt-BR (R$, datas, percentuais). */

const moedaFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numeroFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata um número como moeda (R$ 1.234,56). */
export function formatBRL(valor: number | null | undefined): string {
  return moedaFmt.format(Number(valor ?? 0));
}

/** Formata um número com 2 casas (1.234,56), sem símbolo de moeda. */
export function formatNumero(valor: number | null | undefined): string {
  return numeroFmt.format(Number(valor ?? 0));
}

/**
 * Formata uma fração (0.119) como percentual ("11,9%").
 * Use `casas` para controlar a precisão exibida.
 */
export function formatPercent(
  fracao: number | null | undefined,
  casas = 2,
): string {
  const pct = Number(fracao ?? 0) * 100;
  return (
    pct.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: casas,
    }) + "%"
  );
}

/** Formata uma data (Date | ISO string) como dd/MM/aaaa. */
export function formatData(data: string | Date | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Converte um texto digitado em número, aceitando os formatos pt-BR
 * ("431.790,00", "431790,5") e o formato simples ("431790.5").
 */
export function parseNumeroBR(input: string | number | null | undefined): number {
  if (typeof input === "number") return input;
  if (!input) return 0;
  let s = String(input).trim().replace(/\s/g, "").replace(/r\$/gi, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Data de vencimento de uma competência, mantendo o dia base e clampando ao
 * último dia válido do mês (ex.: dia 31 em fevereiro → 28/29). Recebe a
 * competência como 'YYYY-MM' ou 'YYYY-MM-DD' e devolve 'YYYY-MM-DD'.
 */
export function vencimentoDaCompetencia(
  diaBase: number,
  competencia: string,
): string {
  const [y, m] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dia = Math.min(Math.max(Math.trunc(diaBase) || 1, 1), ultimoDia);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(y, 4)}-${p(m)}-${p(dia)}`;
}

/** Converte uma fração (0.119) no texto de um input de percentual ("11.9"). */
export function fracaoParaInputPct(f: number | null | undefined): string {
  if (f === null || f === undefined) return "";
  return (Math.round(f * 1e6) / 1e4).toString();
}

/** Converte o texto de um input de percentual ("11,9") em fração (0.119). */
export function inputPctParaFracao(str: string): number {
  return parseNumeroBR(str) / 100;
}

/** Nome do mês abreviado em maiúsculas (JAN, FEV, ...) a partir de uma data. */
const MESES = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

export function mesAbrev(data: string | Date | null | undefined): string {
  if (!data) return "";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "";
  return MESES[d.getUTCMonth()];
}

export { MESES };
