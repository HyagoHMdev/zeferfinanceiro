/**
 * Motor de cálculo do Sistema Financeiro Zefer.
 *
 * Funções puras (sem dependência de UI ou banco). Usadas tanto no cálculo ao vivo
 * dos formulários (client) quanto na gravação (server), garantindo um único ponto
 * de verdade para a matemática financeira.
 *
 * Regra de arredondamento: as planilhas originais calculam toda a cadeia em
 * precisão total e arredondam apenas na exibição. Por isso o cálculo é feito com
 * os valores brutos (não arredondados) e o `round2()` é aplicado somente ao
 * produzir cada campo final. Ex.: líquido do corretor = 6.657,12 (e não 6.657,13
 * que sairia se cada passo fosse arredondado).
 */

/**
 * Arredonda para 2 casas decimais com "round half away from zero" (igual ao
 * ROUND do Excel). O pequeno nudge (1e-8) compensa o erro de representação de
 * ponto flutuante (ex.: 7556.325 que internamente vira 7556.32499999...).
 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + 1e-8) * 100)) / 100;
}

/** Converte um percentual digitado pelo usuário (ex.: 5 ou 11,9) para fração (0.05 / 0.119). */
export function percentParaFracao(percent: number): number {
  return percent / 100;
}

/** Converte uma fração (0.05) para percentual (5). */
export function fracaoParaPercent(fracao: number): number {
  return fracao * 100;
}

export interface ComissaoInput {
  /** Valor Geral de Venda (valor do imóvel). */
  vgv: number;
  /** % de comissão da construtora, em fração (ex.: 0.05 para 5%). */
  percentualComissao: number;
  /** % de repasse ao parceiro, em fração (0 quando não há parceiro). */
  percentualParceiro?: number;
  /** % de imposto da imobiliária sobre a nota, em fração (ex.: 0.119). */
  percentualImpostoImobiliaria: number;
  /** % de comissão do corretor sobre o VGV, em fração (ex.: 0.0175). */
  percentualCorretor: number;
  /** % de imposto retido na NF do corretor, em fração (ex.: 0.119). */
  percentualImpostoNf: number;
}

export interface ComissaoResultado {
  comissaoBruta: number;
  valorParceiro: number;
  saldoPosParceiro: number;
  valorImposto: number;
  liquidoZefer: number;
  comissaoCorretorBruto: number;
  valorImpostoNf: number;
  liquidoCorretor: number;
  /** Lucro líquido da imobiliária = líquido Zefer − líquido do corretor. */
  lucroLiquido: number;
}

/**
 * Calcula toda a cadeia de comissão de uma venda, do bruto ao lucro líquido da
 * imobiliária. Reproduz exatamente a planilha COMISSÕES.xlsx.
 */
export function calcularComissao(input: ComissaoInput): ComissaoResultado {
  const {
    vgv,
    percentualComissao,
    percentualParceiro = 0,
    percentualImpostoImobiliaria,
    percentualCorretor,
    percentualImpostoNf,
  } = input;

  // Cadeia da imobiliária (precisão total).
  const comissaoBrutaRaw = vgv * percentualComissao;
  const valorParceiroRaw = comissaoBrutaRaw * percentualParceiro;
  const saldoPosParceiroRaw = comissaoBrutaRaw - valorParceiroRaw;
  const valorImpostoRaw = saldoPosParceiroRaw * percentualImpostoImobiliaria;
  const liquidoZeferRaw = saldoPosParceiroRaw - valorImpostoRaw;

  // Cadeia do corretor (comissão é sobre o VGV, não sobre a comissão bruta).
  const comissaoCorretorBrutoRaw = vgv * percentualCorretor;
  const valorImpostoNfRaw = comissaoCorretorBrutoRaw * percentualImpostoNf;
  const liquidoCorretorRaw = comissaoCorretorBrutoRaw - valorImpostoNfRaw;

  // Resultado da imobiliária.
  const lucroLiquidoRaw = liquidoZeferRaw - liquidoCorretorRaw;

  return {
    comissaoBruta: round2(comissaoBrutaRaw),
    valorParceiro: round2(valorParceiroRaw),
    saldoPosParceiro: round2(saldoPosParceiroRaw),
    valorImposto: round2(valorImpostoRaw),
    liquidoZefer: round2(liquidoZeferRaw),
    comissaoCorretorBruto: round2(comissaoCorretorBrutoRaw),
    valorImpostoNf: round2(valorImpostoNfRaw),
    liquidoCorretor: round2(liquidoCorretorRaw),
    lucroLiquido: round2(lucroLiquidoRaw),
  };
}

export interface DistribuicaoInput {
  /** Valor recebido na entrada. */
  valor: number;
  /** % de dízimo, em fração (ex.: 0.10). 0 quando não há dízimo. */
  percentualDizimo?: number;
  /** % destinado à empresa, em fração (ex.: 0.10). */
  percentualEmpresa: number;
}

export interface DistribuicaoResultado {
  valorDizimo: number;
  liquido: number;
  valorEmpresa: number;
  valorPessoal: number;
}

/**
 * Calcula o dízimo, o líquido e a distribuição empresa/pessoal de uma entrada.
 * Reproduz a planilha ENTRADAS E DISTRIBUIÇÕES.xlsx:
 *   dízimo = valor × %dízimo; líquido = valor − dízimo;
 *   empresa = líquido × %empresa; pessoal = líquido − empresa.
 */
export function calcularDistribuicao(input: DistribuicaoInput): DistribuicaoResultado {
  const { valor, percentualDizimo = 0, percentualEmpresa } = input;

  const valorDizimoRaw = valor * percentualDizimo;
  const liquidoRaw = valor - valorDizimoRaw;
  const valorEmpresaRaw = liquidoRaw * percentualEmpresa;
  const valorPessoalRaw = liquidoRaw - valorEmpresaRaw;

  return {
    valorDizimo: round2(valorDizimoRaw),
    liquido: round2(liquidoRaw),
    valorEmpresa: round2(valorEmpresaRaw),
    valorPessoal: round2(valorPessoalRaw),
  };
}

/**
 * Extrato/saldo de um corretor.
 * saldo = Σ líquido das comissões recebidas e não pagas + bonificações − adiantamentos.
 */
export interface ExtratoCorretorInput {
  comissoesAReceber: number; // soma do líquido das vendas "recebido" ainda não pagas
  bonificacoes: number;
  adiantamentos: number;
}

export function calcularSaldoCorretor(input: ExtratoCorretorInput): number {
  return round2(input.comissoesAReceber + input.bonificacoes - input.adiantamentos);
}
