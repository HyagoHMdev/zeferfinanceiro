import { createClient } from "@/lib/supabase/server";

/** Um vale/adiantamento avulso (não amarrado a uma venda). */
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
}

/** Lista os adiantamentos avulsos (venda_id nulo), mais recentes primeiro. */
export async function listarAdiantamentosAvulsos(): Promise<AdiantamentoAvulsoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("adiantamentos")
    .select(
      "id, corretor_id, data, valor, descricao, recibo_ok, recibo_url, assinado_em, pagamento_id, corretores(nome)",
    )
    .is("venda_id", null)
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
    corretores: { nome: string } | null;
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
  }));
}

export interface CorretorOpcao {
  id: string;
  nome: string;
}

/** Corretores ativos, para o seletor de novo adiantamento. */
export async function listarCorretoresAtivos(): Promise<CorretorOpcao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("corretores")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as CorretorOpcao[];
}
