import { createClient } from "@/lib/supabase/server";
import type { BonificacaoLinha, BonificacaoStatus } from "@/lib/types";

type Linha = {
  id: string;
  corretor_id: string;
  venda_id: string | null;
  campanha: string | null;
  valor: number;
  data: string;
  status: BonificacaoStatus;
  observacao: string | null;
  pago_em: string | null;
  anexos: { path: string; nome: string }[] | null;
  corretores: { nome: string } | null;
  vendas: { cliente: string | null; empreendimentos: { nome: string } | null } | null;
};

/**
 * Bonificações de campanha, da mais recente para a mais antiga.
 *
 * A RLS já recorta: o financeiro vê todas, o corretor vê só as dele.
 */
export async function listarBonificacoes(): Promise<BonificacaoLinha[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bonificacoes")
    .select(
      "id, corretor_id, venda_id, campanha, valor, data, status, observacao, pago_em, anexos, corretores(nome), vendas(cliente, empreendimentos(nome))",
    )
    .order("data", { ascending: false });

  return ((data ?? []) as unknown as Linha[]).map((b) => ({
    id: b.id,
    corretorId: b.corretor_id,
    corretorNome: b.corretores?.nome ?? null,
    vendaId: b.venda_id,
    cliente: b.vendas?.cliente ?? null,
    empreendimento: b.vendas?.empreendimentos?.nome ?? null,
    campanha: b.campanha,
    valor: Number(b.valor),
    data: b.data,
    status: b.status,
    observacao: b.observacao,
    pagoEm: b.pago_em,
    anexos: b.anexos ?? [],
  }));
}
