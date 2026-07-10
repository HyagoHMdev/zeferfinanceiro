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
 * Status efetivo de um lançamento: um "pendente" com vencimento já passado é
 * considerado "atrasado" automaticamente (derivado, sem gravar no banco).
 */
export function statusLancamentoEfetivo(
  status: "pago" | "pendente" | "atrasado",
  dataVencimento: string | null | undefined,
): "pago" | "pendente" | "atrasado" {
  if (status === "pendente" && dataVencimento) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (dataVencimento.slice(0, 10) < hoje) return "atrasado";
  }
  return status;
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

// ---------------------------------------------------------------------------
// Valor por extenso (pt-BR), para recibos.
// ---------------------------------------------------------------------------
const EXT_UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
];
const EXT_10_19 = [
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
];
const EXT_DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
];
const EXT_CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** Extenso de um número de 0 a 999. */
function centenaExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) partes.push(EXT_CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(EXT_UNIDADES[resto]);
    else if (resto < 20) partes.push(EXT_10_19[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? EXT_DEZENAS[d] : `${EXT_DEZENAS[d]} e ${EXT_UNIDADES[u]}`);
    }
  }
  return partes.join(" e ");
}

/** Extenso de um inteiro não negativo (até bilhões). */
function inteiroExtenso(n: number): string {
  if (n === 0) return "zero";
  const grupos: number[] = [];
  let x = n;
  while (x > 0) {
    grupos.unshift(x % 1000);
    x = Math.floor(x / 1000);
  }
  const escalaS = ["", "mil", "milhão", "bilhão"];
  const escalaP = ["", "mil", "milhões", "bilhões"];
  const L = grupos.length;
  const partes: { g: number; txt: string }[] = [];
  for (let idx = 0; idx < L; idx++) {
    const g = grupos[idx];
    if (g === 0) continue;
    const pos = L - 1 - idx; // 0 = unidades, 1 = mil, 2 = milhão...
    let txt: string;
    if (pos === 1 && g === 1) txt = "mil";
    else {
      const c = centenaExtenso(g);
      const suf = pos === 0 ? "" : g === 1 ? escalaS[pos] : escalaP[pos];
      txt = suf ? `${c} ${suf}` : c;
    }
    partes.push({ g, txt });
  }
  let out = partes[0].txt;
  for (let i = 1; i < partes.length; i++) {
    const usarE = partes[i].g < 100 || partes[i].g % 100 === 0;
    out += (usarE ? " e " : " ") + partes[i].txt;
  }
  return out;
}

/** Valor monetário por extenso, ex.: 225.42 → "Duzentos e vinte e cinco reais e quarenta e dois centavos". */
export function valorPorExtenso(valor: number): string {
  const v = Math.abs(valor);
  const inteiro = Math.floor(v + 1e-9);
  const centavos = Math.round((v - inteiro) * 100);
  const partes: string[] = [];
  if (inteiro > 0 || centavos === 0) {
    partes.push(`${inteiroExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    partes.push(`${inteiroExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  const txt = partes.join(" e ");
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
