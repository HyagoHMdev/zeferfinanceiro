import { createClient } from "@/lib/supabase/server";
import { ratearPorParcelas, round2 } from "@/lib/calculos";

/** Uma comissão aguardando liberação (a pagar). */
export interface ComissaoAPagar {
  /** Identifica a linha na seleção: id da venda, ou da parcela quando parcelada. */
  chave: string;
  vendaId: string;
  /** Preenchido quando a venda é parcelada: a parcela que liberou esta fatia. */
  parcelaId?: string;
  parcela?: { numero: number; total: number };
  empreendimento: string | null;
  cliente: string | null;
  dataVenda: string;
  comissaoBruta: number;
  imposto: number;
  liquidoCorretor: number;
}

/** Um adiantamento a descontar no pagamento. */
export interface AdiantamentoAPagar {
  id: string;
  /** Venda a que o adiantamento está atrelado (null = vale avulso). */
  vendaId: string | null;
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
      "id, cliente, data_venda, liquido_corretor, comissao_corretor_bruto, valor_imposto_nf, corretor_id, recebimento_parcelado, corretores(nome), empreendimentos(nome)",
    )
    .eq("status_pagamento_corretor", "aguardando_liberacao")
    .not("corretor_id", "is", null)
    .order("data_venda", { ascending: true });

  const vendas = (vendasData ?? []) as unknown as {
    id: string;
    cliente: string | null;
    data_venda: string;
    liquido_corretor: number;
    comissao_corretor_bruto: number;
    valor_imposto_nf: number;
    corretor_id: string;
    recebimento_parcelado: boolean;
    corretores: { nome: string } | null;
    empreendimentos: { nome: string } | null;
  }[];

  if (vendas.length === 0) return [];

  // Venda parcelada não libera a comissão inteira de uma vez: só a fatia das
  // parcelas que a construtora JÁ pagou (recebido_em preenchido) e que ainda
  // não entraram em nenhum pagamento.
  const idsParceladas = vendas.filter((v) => v.recebimento_parcelado).map((v) => v.id);
  const porVenda = new Map<
    string,
    { id: string; numero: number; valor: number; recebido: boolean; pago: boolean }[]
  >();
  if (idsParceladas.length > 0) {
    const { data: parcData } = await supabase
      .from("venda_parcelas")
      .select("id, venda_id, numero, valor, recebido_em, pagamento_id")
      .in("venda_id", idsParceladas)
      .order("numero");
    for (const p of (parcData ?? []) as {
      id: string;
      venda_id: string;
      numero: number;
      valor: number;
      recebido_em: string | null;
      pagamento_id: string | null;
    }[]) {
      const lista = porVenda.get(p.venda_id) ?? [];
      lista.push({
        id: p.id,
        numero: p.numero,
        valor: Number(p.valor),
        recebido: p.recebido_em != null,
        pago: p.pagamento_id != null,
      });
      porVenda.set(p.venda_id, lista);
    }
  }

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
    const parcelas = porVenda.get(v.id) ?? [];
    if (v.recebimento_parcelado && parcelas.length > 0) {
      // Rateia sobre TODAS as parcelas (o peso de cada uma no total não muda
      // por já ter sido paga) e só oferece as liberadas e ainda não pagas.
      const liquidos = ratearPorParcelas(Number(v.liquido_corretor), parcelas.map((p) => p.valor));
      const brutos = ratearPorParcelas(Number(v.comissao_corretor_bruto), parcelas.map((p) => p.valor));
      const impostos = ratearPorParcelas(Number(v.valor_imposto_nf), parcelas.map((p) => p.valor));
      parcelas.forEach((p, i) => {
        if (!p.recebido || p.pago) return;
        atual.comissoes.push({
          chave: p.id,
          vendaId: v.id,
          parcelaId: p.id,
          parcela: { numero: p.numero, total: parcelas.length },
          empreendimento: v.empreendimentos?.nome ?? null,
          cliente: v.cliente,
          dataVenda: v.data_venda,
          comissaoBruta: brutos[i],
          imposto: impostos[i],
          liquidoCorretor: liquidos[i],
        });
      });
    } else {
      atual.comissoes.push({
        chave: v.id,
        vendaId: v.id,
        empreendimento: v.empreendimentos?.nome ?? null,
        cliente: v.cliente,
        dataVenda: v.data_venda,
        comissaoBruta: Number(v.comissao_corretor_bruto),
        imposto: Number(v.valor_imposto_nf),
        liquidoCorretor: Number(v.liquido_corretor),
      });
    }
    mapa.set(v.corretor_id, atual);
  }
  for (const a of adiantamentos) {
    const atual = mapa.get(a.corretor_id);
    if (!atual) continue; // adiantamento de venda que não está pendente
    atual.adiantamentos.push({
      id: a.id,
      vendaId: a.venda_id,
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
        vendaId: null,
        data: a.data,
        descricao: a.descricao ?? "Adiantamento",
        valor: Number(a.valor),
      });
    }
  }

  // Corretor cuja unica venda e parcelada e ainda nao teve parcela liberada
  // some da fila: nao ha o que pagar hoje, e mostrar linha zerada convida a
  // registrar pagamento de nada.
  const lista = [...mapa.values()].filter((c) => c.comissoes.length > 0);
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
  /** Assinado digitalmente pelo corretor (pelo link do recibo). */
  assinado: boolean;
}

/** Histórico de pagamentos registrados, mais recentes primeiro. */
/**
 * Pagamentos já registrados.
 *
 * O `tipo` separa as duas telas: comissão de corretor mora em Corretores,
 * pagamento de colaborador mora em Pagamentos. As duas gravam na mesma tabela,
 * então sem o recorte cada uma mostraria os pagamentos da outra.
 */
export async function listarPagamentosRealizados(
  tipo?: "corretor" | "funcionario",
): Promise<PagamentoRealizado[]> {
  const supabase = await createClient();
  let q = supabase
    .from("pagamentos_corretor")
    .select(
      "id, data, valor_bruto, total_bonificacoes, total_adiantamentos, valor_liquido, recibo_url, assinado_em, corretores!inner(nome, tipo)",
    );
  if (tipo === "funcionario") q = q.eq("corretores.tipo", "funcionario");
  if (tipo === "corretor") q = q.neq("corretores.tipo", "funcionario");
  const { data } = await q
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
    assinado_em: string | null;
    corretores: { nome: string; tipo: string } | null;
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
    assinado: p.assinado_em != null,
  }));
}
