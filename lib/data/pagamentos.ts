import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/calculos";

/** Uma venda cuja comissão está aguardando liberação (a pagar). */
export interface ComissaoAPagar {
  vendaId: string;
  empreendimento: string | null;
  cliente: string | null;
  dataVenda: string;
  liquidoCorretor: number;
}

/** Um adiantamento a descontar no pagamento. */
export interface AdiantamentoAPagar {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
}

/** Agregado de tudo que um corretor tem a receber, pronto para virar um pagamento. */
export interface CorretorPendente {
  corretorId: string;
  corretorNome: string | null;
  comissoes: ComissaoAPagar[];
  adiantamentos: AdiantamentoAPagar[];
  totalBruto: number;
  totalAdiantamentos: number;
  liquido: number;
}

/**
 * Lista, por corretor, as comissões aguardando liberação e os adiantamentos
 * (ainda não vinculados a um pagamento) dessas vendas. Base para registrar o
 * pagamento consolidado.
 */
export async function listarPagamentosPendentes(): Promise<CorretorPendente[]> {
  const supabase = await createClient();

  const { data: vendasData } = await supabase
    .from("vendas")
    .select(
      "id, cliente, data_venda, liquido_corretor, corretor_id, corretores(nome), empreendimentos(nome)",
    )
    .eq("status_pagamento_corretor", "aguardando_liberacao")
    .not("corretor_id", "is", null)
    .order("data_venda", { ascending: true });

  const vendas = (vendasData ?? []) as unknown as {
    id: string;
    cliente: string | null;
    data_venda: string;
    liquido_corretor: number;
    corretor_id: string;
    corretores: { nome: string } | null;
    empreendimentos: { nome: string } | null;
  }[];

  if (vendas.length === 0) return [];

  const vendaIds = vendas.map((v) => v.id);
  const { data: adiData } = await supabase
    .from("adiantamentos")
    .select("id, corretor_id, venda_id, data, descricao, valor")
    .in("venda_id", vendaIds)
    .is("pagamento_id", null);

  const adiantamentos = (adiData ?? []) as {
    id: string;
    corretor_id: string;
    venda_id: string;
    data: string;
    descricao: string | null;
    valor: number;
  }[];

  // Agrupa por corretor.
  const mapa = new Map<string, CorretorPendente>();
  for (const v of vendas) {
    const atual =
      mapa.get(v.corretor_id) ??
      ({
        corretorId: v.corretor_id,
        corretorNome: v.corretores?.nome ?? null,
        comissoes: [],
        adiantamentos: [],
        totalBruto: 0,
        totalAdiantamentos: 0,
        liquido: 0,
      } satisfies CorretorPendente);
    atual.comissoes.push({
      vendaId: v.id,
      empreendimento: v.empreendimentos?.nome ?? null,
      cliente: v.cliente,
      dataVenda: v.data_venda,
      liquidoCorretor: Number(v.liquido_corretor),
    });
    mapa.set(v.corretor_id, atual);
  }
  for (const a of adiantamentos) {
    const atual = mapa.get(a.corretor_id);
    if (!atual) continue; // adiantamento de venda que não está pendente
    atual.adiantamentos.push({
      id: a.id,
      data: a.data,
      descricao: a.descricao,
      valor: Number(a.valor),
    });
  }

  // Vales avulsos (venda_id nulo) do corretor, ainda não descontados.
  const corretorIds = [...mapa.keys()];
  if (corretorIds.length > 0) {
    const { data: avulsoData } = await supabase
      .from("adiantamentos")
      .select("id, corretor_id, data, descricao, valor")
      .is("venda_id", null)
      .is("pagamento_id", null)
      .in("corretor_id", corretorIds);
    const avulsos = (avulsoData ?? []) as {
      id: string;
      corretor_id: string;
      data: string;
      descricao: string | null;
      valor: number;
    }[];
    for (const a of avulsos) {
      const atual = mapa.get(a.corretor_id);
      if (!atual) continue;
      atual.adiantamentos.push({
        id: a.id,
        data: a.data,
        descricao: a.descricao ?? "Adiantamento",
        valor: Number(a.valor),
      });
    }
  }

  const lista = [...mapa.values()];
  for (const c of lista) {
    c.totalBruto = round2(c.comissoes.reduce((s, x) => s + x.liquidoCorretor, 0));
    c.totalAdiantamentos = round2(
      c.adiantamentos.reduce((s, x) => s + x.valor, 0),
    );
    c.liquido = round2(c.totalBruto - c.totalAdiantamentos);
  }
  lista.sort((a, b) => (a.corretorNome ?? "").localeCompare(b.corretorNome ?? ""));
  return lista;
}

/** Um pagamento já registrado (histórico). */
export interface PagamentoRealizado {
  id: string;
  data: string;
  corretorNome: string | null;
  valorBruto: number;
  totalBonificacoes: number;
  totalAdiantamentos: number;
  valorLiquido: number;
  /** Arquivo do recibo assinado (upload), se houver. */
  reciboUrl: string | null;
}

/** Histórico de pagamentos registrados, mais recentes primeiro. */
export async function listarPagamentosRealizados(): Promise<PagamentoRealizado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pagamentos_corretor")
    .select(
      "id, data, valor_bruto, total_bonificacoes, total_adiantamentos, valor_liquido, recibo_url, corretores(nome)",
    )
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as {
    id: string;
    data: string;
    valor_bruto: number;
    total_bonificacoes: number;
    total_adiantamentos: number;
    valor_liquido: number;
    recibo_url: string | null;
    corretores: { nome: string } | null;
  }[];

  return rows.map((p) => ({
    id: p.id,
    data: p.data,
    corretorNome: p.corretores?.nome ?? null,
    valorBruto: Number(p.valor_bruto),
    totalBonificacoes: Number(p.total_bonificacoes),
    totalAdiantamentos: Number(p.total_adiantamentos),
    valorLiquido: Number(p.valor_liquido),
    reciboUrl: p.recibo_url,
  }));
}
