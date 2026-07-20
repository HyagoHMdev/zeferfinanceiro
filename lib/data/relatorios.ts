import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/calculos";
import type { StatusPagamentoCorretor } from "@/lib/types";

interface VendaRelatorio {
  vgv: number;
  comissao_bruta: number;
  liquido_zefer: number;
  valor_parceria: number;
  valor_imposto: number;
  liquido_corretor: number;
  lucro_liquido: number;
  status_pagamento_corretor: StatusPagamentoCorretor;
  data_venda: string;
  corretores: { nome: string } | null;
  construtoras: { nome: string } | null;
  empreendimentos: { nome: string } | null;
}

async function fetchVendas(): Promise<VendaRelatorio[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendas")
    .select(
      "vgv, comissao_bruta, liquido_zefer, valor_parceria, valor_imposto, liquido_corretor, lucro_liquido, status_pagamento_corretor, data_venda, corretores(nome), construtoras(nome), empreendimentos(nome)",
    );
  return (data ?? []) as unknown as VendaRelatorio[];
}

export interface LinhaCorretor {
  nome: string;
  vendas: number;
  vgv: number;
  comissao: number;
  pago: number;
  pendencias: number;
}

export async function relatorioPorCorretor(): Promise<LinhaCorretor[]> {
  const vendas = await fetchVendas();
  const map = new Map<string, LinhaCorretor>();
  for (const v of vendas) {
    const nome = v.corretores?.nome ?? "Sem corretor";
    const l = map.get(nome) ?? { nome, vendas: 0, vgv: 0, comissao: 0, pago: 0, pendencias: 0 };
    l.vendas += 1;
    l.vgv += Number(v.vgv);
    l.comissao += Number(v.liquido_corretor);
    if (v.status_pagamento_corretor === "pago")
      l.pago += Number(v.liquido_corretor);
    else l.pendencias += Number(v.liquido_corretor);
    map.set(nome, l);
  }
  return [...map.values()]
    .map((l) => ({
      ...l,
      vgv: round2(l.vgv),
      comissao: round2(l.comissao),
      pago: round2(l.pago),
      pendencias: round2(l.pendencias),
    }))
    .sort((a, b) => b.comissao - a.comissao);
}

export interface LinhaConstrutora {
  nome: string;
  vendas: number;
  vgv: number;
  comissao: number;
}

export async function relatorioPorConstrutora(): Promise<LinhaConstrutora[]> {
  const vendas = await fetchVendas();
  const map = new Map<string, LinhaConstrutora>();
  for (const v of vendas) {
    const nome = v.construtoras?.nome ?? "Sem construtora";
    const l = map.get(nome) ?? { nome, vendas: 0, vgv: 0, comissao: 0 };
    l.vendas += 1;
    l.vgv += Number(v.vgv);
    l.comissao += Number(v.comissao_bruta);
    map.set(nome, l);
  }
  return [...map.values()]
    .map((l) => ({ ...l, vgv: round2(l.vgv), comissao: round2(l.comissao) }))
    .sort((a, b) => b.vgv - a.vgv);
}

export interface LinhaEmpreendimento {
  nome: string;
  unidades: number;
  vgv: number;
  comissao: number;
  ticketMedio: number;
}

export async function relatorioPorEmpreendimento(): Promise<LinhaEmpreendimento[]> {
  const vendas = await fetchVendas();
  const map = new Map<string, { nome: string; unidades: number; vgv: number; comissao: number }>();
  for (const v of vendas) {
    const nome = v.empreendimentos?.nome ?? "Sem empreendimento";
    const l = map.get(nome) ?? { nome, unidades: 0, vgv: 0, comissao: 0 };
    l.unidades += 1;
    l.vgv += Number(v.vgv);
    l.comissao += Number(v.comissao_bruta);
    map.set(nome, l);
  }
  return [...map.values()]
    .map((l) => ({
      nome: l.nome,
      unidades: l.unidades,
      vgv: round2(l.vgv),
      comissao: round2(l.comissao),
      ticketMedio: round2(l.unidades > 0 ? l.vgv / l.unidades : 0),
    }))
    .sort((a, b) => b.comissao - a.comissao);
}

export interface DRE {
  ano: number;
  receitaBruta: number;
  parceiros: number;
  impostos: number;
  receitaLiquida: number;
  comissaoCorretores: number;
  lucroBruto: number;
  /** Entradas que não são comissão (bonificação, premiação, investidor, outras). */
  outrasEntradas: number;
  despesasFixas: number;
  despesasVariaveis: number;
  investimentos: number;
  lucroLiquido: number;
}

export async function relatorioDRE(ano: number): Promise<DRE> {
  const supabase = await createClient();
  const vendas = await fetchVendas();
  const doAno = vendas.filter((v) => new Date(v.data_venda).getUTCFullYear() === ano);

  const receitaBruta = round2(doAno.reduce((s, v) => s + Number(v.comissao_bruta), 0));
  const parceiros = round2(doAno.reduce((s, v) => s + Number(v.valor_parceria), 0));
  const impostos = round2(doAno.reduce((s, v) => s + Number(v.valor_imposto), 0));
  const receitaLiquida = round2(doAno.reduce((s, v) => s + Number(v.liquido_zefer), 0));
  const comissaoCorretores = round2(
    doAno.reduce((s, v) => s + Number(v.liquido_corretor), 0),
  );
  const lucroBruto = round2(doAno.reduce((s, v) => s + Number(v.lucro_liquido), 0));

  const { data: lancData } = await supabase
    .from("lancamentos")
    .select("natureza, valor, escopo, competencia")
    .eq("escopo", "empresa");
  const lancamentos = (lancData ?? []) as {
    natureza: string;
    valor: number;
    competencia: string;
  }[];
  const noAno = (c: string) => new Date(c).getUTCFullYear() === ano;

  const despesasFixas = round2(
    lancamentos
      .filter((l) => l.natureza === "custo_fixo" && noAno(l.competencia))
      .reduce((s, l) => s + Number(l.valor), 0),
  );
  const despesasVariaveis = round2(
    lancamentos
      .filter((l) => l.natureza === "despesa_variavel" && noAno(l.competencia))
      .reduce((s, l) => s + Number(l.valor), 0),
  );
  const investimentos = round2(
    lancamentos
      .filter((l) => l.natureza === "investimento" && noAno(l.competencia))
      .reduce((s, l) => s + Number(l.valor), 0),
  );

  // Demais entradas do ano (todas menos comissão, que já entra pela cadeia das
  // vendas acima — evita dupla contagem).
  const { data: entradasData } = await supabase
    .from("entradas")
    // Zefer Joinville é carteira separada: fora do DRE da Zefer.
    .select("data, valor, tipo")
    .neq("escopo", "joinville");
  const outrasEntradas = round2(
    ((entradasData ?? []) as { data: string; valor: number; tipo: string }[])
      .filter((e) => e.tipo !== "comissao" && noAno(e.data))
      .reduce((s, e) => s + Number(e.valor), 0),
  );

  return {
    ano,
    receitaBruta,
    parceiros,
    impostos,
    receitaLiquida,
    comissaoCorretores,
    lucroBruto,
    outrasEntradas,
    despesasFixas,
    despesasVariaveis,
    investimentos,
    lucroLiquido: round2(
      lucroBruto +
        outrasEntradas -
        despesasFixas -
        despesasVariaveis -
        investimentos,
    ),
  };
}
