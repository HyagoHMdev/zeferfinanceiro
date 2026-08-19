import { createClient } from "@/lib/supabase/server";
import { ratearPorParcelas, round2, resumoCorretor } from "@/lib/calculos";
import type {
  Adiantamento,
  StatusPagamentoCorretor,
  Venda,
  VendaStatus,
} from "@/lib/types";

export interface ComissaoLinha {
  /** Chave única da linha: a venda, ou a parcela quando o recebimento é parcelado. */
  chave: string;
  vendaId: string;
  corretorNome: string | null;
  empreendimento: string | null;
  dataVenda: string;
  liquidoCorretor: number;
  statusVenda: VendaStatus;
  statusPagamento: StatusPagamentoCorretor;
  /** Só em venda parcelada. `liberada` = a construtora já pagou esta parcela. */
  parcela?: { numero: number; total: number; liberada: boolean };
  /** Metade da parceria que saiu desta comissão. 0 quando não há parceria. */
  descontoParceria: number;
}

interface ComissaoRow {
  id: string;
  data_venda: string;
  liquido_corretor: number;
  status: VendaStatus;
  status_pagamento_corretor: StatusPagamentoCorretor;
  corretores: { nome: string } | null;
  empreendimentos: { nome: string } | null;
}

/**
 * Lista as comissões de venda. Uma linha por venda, EXCETO quando a
 * construtora libera parcelado: aí é uma linha por parcela, com a fatia da
 * comissão que aquela parcela carrega. Sem isso o corretor via o valor cheio
 * como "a receber" mesmo já tendo recebido parte, e a venda só mudava de
 * status quando a última parcela caísse.
 */
export async function listarComissoesCorretor(
  corretorId?: string,
): Promise<ComissaoLinha[]> {
  const supabase = await createClient();
  let q = supabase
    .from("vendas")
    .select(
      "id, data_venda, liquido_corretor, desconto_parceiro_valor, status, status_pagamento_corretor, recebimento_parcelado, corretores(nome), empreendimentos(nome)",
    )
    .not("corretor_id", "is", null)
    .order("data_venda", { ascending: false });
  if (corretorId) q = q.eq("corretor_id", corretorId);

  const { data } = await q;
  const rows = (data ?? []) as unknown as (ComissaoRow & {
    recebimento_parcelado: boolean;
    desconto_parceiro_valor: number | null;
  })[];

  const idsParceladas = rows.filter((v) => v.recebimento_parcelado).map((v) => v.id);
  const porVenda = new Map<
    string,
    { id: string; numero: number; valor: number; recebido: boolean; pago: boolean }[]
  >();
  if (idsParceladas.length > 0) {
    const { data: parc } = await supabase
      .from("venda_parcelas")
      .select("id, venda_id, numero, valor, recebido_em, pagamento_id")
      .in("venda_id", idsParceladas)
      .order("numero");
    for (const p of (parc ?? []) as {
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

  const linhas: ComissaoLinha[] = [];
  for (const v of rows) {
    const parcelas = porVenda.get(v.id) ?? [];
    const base = {
      vendaId: v.id,
      corretorNome: v.corretores?.nome ?? null,
      empreendimento: v.empreendimentos?.nome ?? null,
      dataVenda: v.data_venda,
      statusVenda: v.status,
    };
    const desconto = Number(v.desconto_parceiro_valor ?? 0);
    if (v.recebimento_parcelado && parcelas.length > 0) {
      const fatias = ratearPorParcelas(
        Number(v.liquido_corretor),
        parcelas.map((p) => p.valor),
      );
      // O desconto de parceria acompanha as parcelas pelo mesmo peso, senão a
      // soma das linhas não bateria com o desconto da venda.
      const descontos = ratearPorParcelas(desconto, parcelas.map((p) => p.valor));
      parcelas.forEach((p, i) => {
        linhas.push({
          ...base,
          chave: p.id,
          liquidoCorretor: fatias[i],
          descontoParceria: descontos[i],
          statusPagamento: p.pago ? "pago" : "aguardando_liberacao",
          parcela: { numero: p.numero, total: parcelas.length, liberada: p.recebido },
        });
      });
    } else {
      linhas.push({
        ...base,
        chave: v.id,
        liquidoCorretor: Number(v.liquido_corretor),
        descontoParceria: desconto,
        statusPagamento: v.status_pagamento_corretor,
      });
    }
  }
  return linhas;
}

export interface VendaComNomes extends Venda {
  corretores: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  construtoras: { nome: string } | null;
}

export interface ProcessamentoVenda {
  venda: VendaComNomes;
  adiantamentos: Adiantamento[];
  /** Vales avulsos do corretor (não vinculados a venda, ainda não descontados). */
  adiantamentosDisponiveis: Adiantamento[];
  totalAdiantamentos: number;
  liquidoParaPagamento: number;
}

export async function carregarProcessamentoVenda(
  vendaId: string,
): Promise<ProcessamentoVenda | null> {
  const supabase = await createClient();
  const [vRes, aRes] = await Promise.all([
    supabase
      .from("vendas")
      .select(
        "*, corretores(nome), empreendimentos(nome), construtoras(nome)",
      )
      .eq("id", vendaId)
      .single(),
    supabase
      .from("adiantamentos")
      .select("*")
      .eq("venda_id", vendaId)
      .order("data", { ascending: false }),
  ]);

  if (!vRes.data) return null;
  const venda = vRes.data as unknown as VendaComNomes;
  const adiantamentos = (aRes.data ?? []) as Adiantamento[];

  // Vales avulsos do corretor (venda_id nulo, ainda não descontados), para
  // o usuário incluir ou não nesta venda.
  let adiantamentosDisponiveis: Adiantamento[] = [];
  if (venda.corretor_id) {
    const { data } = await supabase
      .from("adiantamentos")
      .select("*")
      .eq("corretor_id", venda.corretor_id)
      .is("venda_id", null)
      .is("pagamento_id", null)
      .order("data", { ascending: false });
    adiantamentosDisponiveis = (data ?? []) as Adiantamento[];
  }

  const totalAdiantamentos = round2(
    adiantamentos.reduce((s, a) => s + Number(a.valor), 0),
  );
  const liquidoParaPagamento = resumoCorretor(
    Number(venda.liquido_corretor),
    totalAdiantamentos,
  );

  return {
    venda,
    adiantamentos,
    adiantamentosDisponiveis,
    totalAdiantamentos,
    liquidoParaPagamento,
  };
}
