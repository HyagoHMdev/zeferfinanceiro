import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/calculos";
import { MESES } from "@/lib/format";
import type { VendaStatus, LancamentoEscopo } from "@/lib/types";

export interface ResumoMensal {
  mes: string;
  receita: number;
  despesa: number;
  lucro: number;
}

export interface DashboardData {
  /** Anos com movimento, em ordem decrescente. */
  anos: number[];
  ano: number;
  /** Mês selecionado (1-12) ou null = ano todo. */
  mes: number | null;
  receita: number;
  investimentos: number;
  comissoesRecebidas: number;
  comissoesPendentes: number;
  pagoCorretores: number;
  despesasFixas: number;
  despesasVariaveis: number;
  resultadoLiquido: number;
  saldoCaixaEmpresa: number;
  /** Sempre o ano inteiro (Jan–Dez) para o gráfico. */
  mensal: ResumoMensal[];
}

export async function carregarDashboard(opts?: {
  ano?: number;
  /** 1-12; ausente = ano todo. */
  mes?: number;
}): Promise<DashboardData> {
  const supabase = await createClient();
  const anoAtual = new Date().getUTCFullYear();

  const [entradasRes, vendasRes, lancamentosRes, distRes] = await Promise.all([
    supabase.from("entradas").select("data, valor"),
    supabase
      .from("vendas")
      .select(
        "data_venda, liquido_zefer, lucro_liquido, status, liquido_corretor, status_pagamento_corretor",
      ),
    supabase
      .from("lancamentos")
      .select("escopo, natureza, valor, status, competencia"),
    supabase.from("distribuicoes").select("destino, valor, entradas(data)"),
  ]);

  const entradas = (entradasRes.data ?? []) as { data: string; valor: number }[];
  const vendas = (vendasRes.data ?? []) as {
    data_venda: string;
    liquido_zefer: number;
    lucro_liquido: number;
    status: VendaStatus;
    liquido_corretor: number;
    status_pagamento_corretor: "aguardando_liberacao" | "pago";
  }[];
  const lancamentos = (lancamentosRes.data ?? []) as {
    escopo: LancamentoEscopo;
    natureza: string;
    valor: number;
    status: string;
    competencia: string;
  }[];
  const distribuicoes = (distRes.data ?? []) as unknown as {
    destino: "empresa" | "pessoal";
    valor: number;
    entradas: { data: string } | null;
  }[];

  // Anos disponíveis (união de entradas, vendas e lançamentos).
  const anosSet = new Set<number>();
  for (const e of entradas) anosSet.add(Number(e.data.slice(0, 4)));
  for (const v of vendas) anosSet.add(Number(v.data_venda.slice(0, 4)));
  for (const l of lancamentos) anosSet.add(Number(l.competencia.slice(0, 4)));
  if (anosSet.size === 0) anosSet.add(anoAtual);
  const anos = [...anosSet].sort((a, b) => b - a);

  const ano =
    opts?.ano && anos.includes(opts.ano)
      ? opts.ano
      : anos.includes(anoAtual)
        ? anoAtual
        : anos[0];
  const mes = opts?.mes && opts.mes >= 1 && opts.mes <= 12 ? opts.mes : null;

  const anoStr = String(ano);
  const mesKey = mes ? `${anoStr}-${String(mes).padStart(2, "0")}` : null;

  // Dentro do período selecionado (ano, ou ano+mês).
  const noPeriodo = (data: string) => {
    if (data.slice(0, 4) !== anoStr) return false;
    if (mesKey && data.slice(0, 7) !== mesKey) return false;
    return true;
  };
  // Acumulado até o fim do período (para o saldo em caixa, que é corrente).
  const fimPeriodo = mesKey ?? `${anoStr}-12`;
  const ateFimPeriodo = (data: string) => data.slice(0, 7) <= fimPeriodo;

  const somar = <T,>(arr: T[], pred: (x: T) => boolean, val: (x: T) => number) =>
    round2(arr.reduce((s, x) => s + (pred(x) ? val(x) : 0), 0));

  // Gráfico: sempre o ano inteiro, mês a mês.
  const receitaPorMes = new Array(12).fill(0);
  const despesaPorMes = new Array(12).fill(0);
  for (const e of entradas) {
    if (e.data.slice(0, 4) === anoStr) {
      receitaPorMes[Number(e.data.slice(5, 7)) - 1] += Number(e.valor);
    }
  }
  for (const l of lancamentos) {
    if (l.competencia.slice(0, 4) === anoStr) {
      despesaPorMes[Number(l.competencia.slice(5, 7)) - 1] += Number(l.valor);
    }
  }
  const mensal: ResumoMensal[] = MESES.map((mesNome, i) => ({
    mes: mesNome,
    receita: round2(receitaPorMes[i]),
    despesa: round2(despesaPorMes[i]),
    lucro: round2(receitaPorMes[i] - despesaPorMes[i]),
  }));

  const receita = somar(entradas, (e) => noPeriodo(e.data), (e) => Number(e.valor));
  // Investimentos: lançamentos do cadastro de Investimentos (Financeiro).
  const investimentos = somar(
    lancamentos,
    (l) =>
      l.escopo === "empresa" &&
      l.natureza === "investimento" &&
      noPeriodo(l.competencia),
    (l) => Number(l.valor),
  );

  const comissoesRecebidas = somar(
    vendas,
    (v) => (v.status === "recebido" || v.status === "pago") && noPeriodo(v.data_venda),
    (v) => Number(v.liquido_zefer),
  );
  const comissoesPendentes = somar(
    vendas,
    (v) => v.status === "aguardando_recebimento" && noPeriodo(v.data_venda),
    (v) => Number(v.liquido_zefer),
  );
  const pagoCorretores = somar(
    vendas,
    (v) => v.status_pagamento_corretor === "pago" && noPeriodo(v.data_venda),
    (v) => Number(v.liquido_corretor),
  );

  const despesasFixas = somar(
    lancamentos,
    (l) => l.escopo === "empresa" && l.natureza === "custo_fixo" && noPeriodo(l.competencia),
    (l) => Number(l.valor),
  );
  const despesasVariaveis = somar(
    lancamentos,
    (l) =>
      l.escopo === "empresa" && l.natureza === "despesa_variavel" && noPeriodo(l.competencia),
    (l) => Number(l.valor),
  );
  const despesasEmpresa = somar(
    lancamentos,
    (l) => l.escopo === "empresa" && noPeriodo(l.competencia),
    (l) => Number(l.valor),
  );

  // Saldo em caixa: corrente, acumulado até o fim do período.
  const entradasEmpresa = somar(
    distribuicoes,
    (d) => d.destino === "empresa" && !!d.entradas?.data && ateFimPeriodo(d.entradas.data),
    (d) => Number(d.valor),
  );
  const saidasEmpresaPagas = somar(
    lancamentos,
    (l) => l.escopo === "empresa" && l.status === "pago" && ateFimPeriodo(l.competencia),
    (l) => Number(l.valor),
  );

  return {
    anos,
    ano,
    mes,
    receita,
    investimentos,
    comissoesRecebidas,
    comissoesPendentes,
    pagoCorretores,
    despesasFixas,
    despesasVariaveis,
    resultadoLiquido: round2(receita - despesasEmpresa),
    saldoCaixaEmpresa: round2(entradasEmpresa - saidasEmpresaPagas),
    mensal,
  };
}
