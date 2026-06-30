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
  ano: number;
  receitaMes: number;
  receitaAno: number;
  comissoesRecebidas: number;
  comissoesPendentes: number;
  pagoCorretores: number;
  despesasFixas: number;
  despesasVariaveis: number;
  lucroVendas: number;
  resultadoLiquido: number;
  saldoCaixaEmpresa: number;
  mensal: ResumoMensal[];
}

export async function carregarDashboard(): Promise<DashboardData> {
  const supabase = await createClient();
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth();

  const [entradasRes, vendasRes, pagamentosRes, lancamentosRes, distRes] =
    await Promise.all([
      supabase.from("entradas").select("data, valor"),
      supabase.from("vendas").select("liquido_zefer, lucro_liquido, status"),
      supabase.from("pagamentos_corretor").select("valor_liquido"),
      supabase
        .from("lancamentos")
        .select("escopo, natureza, valor, status, competencia"),
      supabase.from("distribuicoes").select("destino, valor"),
    ]);

  const entradas = (entradasRes.data ?? []) as { data: string; valor: number }[];
  const vendas = (vendasRes.data ?? []) as {
    liquido_zefer: number;
    lucro_liquido: number;
    status: VendaStatus;
  }[];
  const pagamentos = (pagamentosRes.data ?? []) as { valor_liquido: number }[];
  const lancamentos = (lancamentosRes.data ?? []) as {
    escopo: LancamentoEscopo;
    natureza: string;
    valor: number;
    status: string;
    competencia: string;
  }[];
  const distribuicoes = (distRes.data ?? []) as {
    destino: "empresa" | "pessoal";
    valor: number;
  }[];

  // Receita por mês (entradas) e despesa por mês (todos os lançamentos do ano).
  const receitaPorMes = new Array(12).fill(0);
  const despesaPorMes = new Array(12).fill(0);
  let receitaMes = 0;
  let receitaAno = 0;

  for (const e of entradas) {
    const d = new Date(e.data);
    if (d.getUTCFullYear() === ano) {
      receitaPorMes[d.getUTCMonth()] += Number(e.valor);
      receitaAno += Number(e.valor);
      if (d.getUTCMonth() === mesAtual) receitaMes += Number(e.valor);
    }
  }
  for (const l of lancamentos) {
    const d = new Date(l.competencia);
    if (d.getUTCFullYear() === ano) despesaPorMes[d.getUTCMonth()] += Number(l.valor);
  }

  const mensal: ResumoMensal[] = MESES.map((mes, i) => ({
    mes,
    receita: round2(receitaPorMes[i]),
    despesa: round2(despesaPorMes[i]),
    lucro: round2(receitaPorMes[i] - despesaPorMes[i]),
  }));

  const comissoesRecebidas = round2(
    vendas
      .filter((v) => v.status === "recebido" || v.status === "pago")
      .reduce((s, v) => s + Number(v.liquido_zefer), 0),
  );
  const comissoesPendentes = round2(
    vendas
      .filter((v) => v.status === "aguardando_recebimento")
      .reduce((s, v) => s + Number(v.liquido_zefer), 0),
  );
  const pagoCorretores = round2(
    pagamentos.reduce((s, p) => s + Number(p.valor_liquido), 0),
  );
  const lucroVendas = round2(
    vendas.reduce((s, v) => s + Number(v.lucro_liquido), 0),
  );

  const noAno = (competencia: string) =>
    new Date(competencia).getUTCFullYear() === ano;

  const despesasFixas = round2(
    lancamentos
      .filter((l) => l.escopo === "empresa" && l.natureza === "custo_fixo" && noAno(l.competencia))
      .reduce((s, l) => s + Number(l.valor), 0),
  );
  const despesasVariaveis = round2(
    lancamentos
      .filter((l) => l.escopo === "empresa" && l.natureza === "despesa_variavel" && noAno(l.competencia))
      .reduce((s, l) => s + Number(l.valor), 0),
  );
  const despesasEmpresaAno = round2(
    lancamentos
      .filter((l) => l.escopo === "empresa" && noAno(l.competencia))
      .reduce((s, l) => s + Number(l.valor), 0),
  );

  const entradasEmpresa = round2(
    distribuicoes
      .filter((d) => d.destino === "empresa")
      .reduce((s, d) => s + Number(d.valor), 0),
  );
  const saidasEmpresaPagas = round2(
    lancamentos
      .filter((l) => l.escopo === "empresa" && l.status === "pago")
      .reduce((s, l) => s + Number(l.valor), 0),
  );

  return {
    ano,
    receitaMes: round2(receitaMes),
    receitaAno: round2(receitaAno),
    comissoesRecebidas,
    comissoesPendentes,
    pagoCorretores,
    despesasFixas,
    despesasVariaveis,
    lucroVendas,
    resultadoLiquido: round2(receitaAno - despesasEmpresaAno),
    saldoCaixaEmpresa: round2(entradasEmpresa - saidasEmpresaPagas),
    mensal,
  };
}
