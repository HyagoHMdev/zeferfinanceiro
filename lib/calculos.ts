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

// ---------------------------------------------------------------------------
// FONTE ÚNICA DE VERDADE da cadeia financeira de uma venda.
// ---------------------------------------------------------------------------

export interface VendaCalcInput {
  /** Valor Geral de Venda (valor do imóvel). */
  vgv: number;
  /** % de comissão paga pela construtora, em fração (ex.: 0.05). */
  percentualComissao: number;
  /** Se há parceria nesta venda. */
  possuiParceria?: boolean;
  /** % da parceria sobre a comissão bruta, em fração. Só aplica se possuiParceria. */
  percentualParceria?: number;
  /** % de imposto da imobiliária, em fração (incide sobre o líquido pós-parceria). */
  percentualImpostoImobiliaria: number;
  /** % de comissão do corretor sobre o VGV, em fração. */
  percentualCorretor: number;
  /** % de desconto na comissão do corretor quando há parceria, em fração (0 = nenhum). */
  percentualDescontoParceiro?: number;
  /** % de imposto retido na NF do corretor, em fração. */
  percentualImpostoNf: number;
}

export interface VendaCalcResultado {
  comissaoBruta: number;
  valorParceria: number;
  liquidoPosParceria: number;
  valorImposto: number;
  liquidoZefer: number;
  comissaoCorretorBruto: number;
  descontoCorretor: number;
  comissaoCorretorAjustada: number;
  valorImpostoNf: number;
  liquidoCorretor: number;
  /** Lucro líquido da imobiliária = líquido Zefer − líquido do corretor. */
  lucroLiquido: number;
}

/**
 * Calcula toda a cadeia financeira de uma venda, do bruto ao lucro líquido.
 * Base de cálculo da imobiliária e do corretor respeita a parceria. Único ponto
 * onde essa matemática existe — reusado por formulários, actions e resumos.
 */
export function calcularVenda(input: VendaCalcInput): VendaCalcResultado {
  const {
    vgv,
    percentualComissao,
    possuiParceria = false,
    percentualParceria = 0,
    percentualImpostoImobiliaria,
    percentualCorretor,
    percentualDescontoParceiro = 0,
    percentualImpostoNf,
  } = input;

  // Cadeia da imobiliária (precisão total).
  const comissaoBrutaRaw = vgv * percentualComissao;
  const valorParceriaRaw = possuiParceria ? comissaoBrutaRaw * percentualParceria : 0;
  const liquidoPosParceriaRaw = comissaoBrutaRaw - valorParceriaRaw;
  const valorImpostoRaw = liquidoPosParceriaRaw * percentualImpostoImobiliaria;
  const liquidoZeferRaw = liquidoPosParceriaRaw - valorImpostoRaw;

  // Cadeia do corretor (comissão sobre o VGV; desconto opcional quando há parceria).
  const comissaoCorretorBrutoRaw = vgv * percentualCorretor;
  const descontoCorretorRaw = possuiParceria
    ? comissaoCorretorBrutoRaw * percentualDescontoParceiro
    : 0;
  const comissaoCorretorAjustadaRaw = comissaoCorretorBrutoRaw - descontoCorretorRaw;
  const valorImpostoNfRaw = comissaoCorretorAjustadaRaw * percentualImpostoNf;
  const liquidoCorretorRaw = comissaoCorretorAjustadaRaw - valorImpostoNfRaw;

  const lucroLiquidoRaw = liquidoZeferRaw - liquidoCorretorRaw;

  return {
    comissaoBruta: round2(comissaoBrutaRaw),
    valorParceria: round2(valorParceriaRaw),
    liquidoPosParceria: round2(liquidoPosParceriaRaw),
    valorImposto: round2(valorImpostoRaw),
    liquidoZefer: round2(liquidoZeferRaw),
    comissaoCorretorBruto: round2(comissaoCorretorBrutoRaw),
    descontoCorretor: round2(descontoCorretorRaw),
    comissaoCorretorAjustada: round2(comissaoCorretorAjustadaRaw),
    valorImpostoNf: round2(valorImpostoNfRaw),
    liquidoCorretor: round2(liquidoCorretorRaw),
    lucroLiquido: round2(lucroLiquidoRaw),
  };
}

/**
 * Wrapper retrocompatível (mantém a assinatura antiga usada em telas ainda não
 * migradas). Delega para `calcularVenda`.
 */
export function calcularComissao(input: ComissaoInput): ComissaoResultado {
  const r = calcularVenda({
    vgv: input.vgv,
    percentualComissao: input.percentualComissao,
    possuiParceria: (input.percentualParceiro ?? 0) > 0,
    percentualParceria: input.percentualParceiro ?? 0,
    percentualImpostoImobiliaria: input.percentualImpostoImobiliaria,
    percentualCorretor: input.percentualCorretor,
    percentualDescontoParceiro: 0,
    percentualImpostoNf: input.percentualImpostoNf,
  });
  return {
    comissaoBruta: r.comissaoBruta,
    valorParceiro: r.valorParceria,
    saldoPosParceiro: r.liquidoPosParceria,
    valorImposto: r.valorImposto,
    liquidoZefer: r.liquidoZefer,
    comissaoCorretorBruto: r.comissaoCorretorBruto,
    valorImpostoNf: r.valorImpostoNf,
    liquidoCorretor: r.liquidoCorretor,
    lucroLiquido: r.lucroLiquido,
  };
}

/** Líquido para pagamento do corretor = líquido do corretor − adiantamentos. */
export function resumoCorretor(
  liquidoCorretor: number,
  totalAdiantamentos: number,
): number {
  return round2(liquidoCorretor - totalAdiantamentos);
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
