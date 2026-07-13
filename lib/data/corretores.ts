import { createClient } from "@/lib/supabase/server";
import { round2, resumoCorretor } from "@/lib/calculos";
import type {
  Adiantamento,
  StatusPagamentoCorretor,
  Venda,
  VendaStatus,
} from "@/lib/types";

export interface ComissaoLinha {
  vendaId: string;
  corretorNome: string | null;
  empreendimento: string | null;
  dataVenda: string;
  liquidoCorretor: number;
  statusVenda: VendaStatus;
  statusPagamento: StatusPagamentoCorretor;
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

/** Lista as comissões (uma por venda com corretor). Opcionalmente por corretor. */
export async function listarComissoesCorretor(
  corretorId?: string,
): Promise<ComissaoLinha[]> {
  const supabase = await createClient();
  let q = supabase
    .from("vendas")
    .select(
      "id, data_venda, liquido_corretor, status, status_pagamento_corretor, corretores(nome), empreendimentos(nome)",
    )
    .not("corretor_id", "is", null)
    .order("data_venda", { ascending: false });
  if (corretorId) q = q.eq("corretor_id", corretorId);

  const { data } = await q;
  const rows = (data ?? []) as unknown as ComissaoRow[];
  return rows.map((v) => ({
    vendaId: v.id,
    corretorNome: v.corretores?.nome ?? null,
    empreendimento: v.empreendimentos?.nome ?? null,
    dataVenda: v.data_venda,
    liquidoCorretor: Number(v.liquido_corretor),
    statusVenda: v.status,
    statusPagamento: v.status_pagamento_corretor,
  }));
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
