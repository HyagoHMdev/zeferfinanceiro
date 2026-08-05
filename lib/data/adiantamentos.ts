import { createClient } from "@/lib/supabase/server";

/** Um vale/adiantamento, avulso ou amarrado a uma venda. */
export interface AdiantamentoAvulsoRow {
  id: string;
  corretorId: string;
  corretorNome: string | null;
  data: string;
  valor: number;
  descricao: string | null;
  reciboOk: boolean;
  /** Arquivo do recibo assinado (upload), se houver. */
  reciboUrl: string | null;
  /** Assinado digitalmente pelo corretor (pelo link do recibo). */
  assinado: boolean;
  /** Já foi descontado num pagamento (pagamento_id preenchido). */
  descontado: boolean;
  /** Venda a que o adiantamento está amarrado. Null = vale avulso. */
  vendaId: string | null;
  /** Cliente da venda de origem, para a lista dizer de onde ele veio. */
  vendaCliente: string | null;
}

/**
 * Lista TODOS os adiantamentos, mais recentes primeiro.
 *
 * Antes trazia só os avulsos (venda_id nulo). O resultado é que adiantamento
 * amarrado a uma venda não aparecia em lugar nenhum além da própria venda:
 * numa tela chamada "Adiantamentos", metade deles ficava invisível e parecia
 * ter sumido. O vínculo com a venda agora vem junto, como coluna, em vez de
 * virar critério de exclusão.
 */
export async function listarAdiantamentosAvulsos(): Promise<AdiantamentoAvulsoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("adiantamentos")
    .select(
      "id, corretor_id, data, valor, descricao, recibo_ok, recibo_url, assinado_em, pagamento_id, venda_id, corretores(nome), vendas(cliente)",
    )
    .order("data", { ascending: false });

  const rows = (data ?? []) as unknown as {
    id: string;
    corretor_id: string;
    data: string;
    valor: number;
    descricao: string | null;
    recibo_ok: boolean;
    recibo_url: string | null;
    assinado_em: string | null;
    pagamento_id: string | null;
    venda_id: string | null;
    corretores: { nome: string } | null;
    vendas: { cliente: string | null } | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    corretorId: r.corretor_id,
    corretorNome: r.corretores?.nome ?? null,
    data: r.data,
    valor: Number(r.valor),
    descricao: r.descricao,
    reciboOk: r.recibo_ok,
    reciboUrl: r.recibo_url,
    assinado: r.assinado_em != null,
    descontado: r.pagamento_id != null,
    vendaId: r.venda_id,
    vendaCliente: r.vendas?.cliente ?? null,
  }));
}

export interface CorretorOpcao {
  id: string;
  nome: string;
  tipo: "corretor" | "funcionario";
}

/** Pessoas ativas (corretores E funcionários) para o seletor de adiantamento. */
export async function listarCorretoresAtivos(): Promise<CorretorOpcao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("corretores")
    .select("id, nome, tipo")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((c) => ({
    id: (c as { id: string }).id,
    nome: (c as { nome: string }).nome,
    tipo: (c as { tipo?: string }).tipo === "funcionario" ? "funcionario" : "corretor",
  }));
}
