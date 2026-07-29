import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Configuracoes,
  Construtora,
  Empreendimento,
  Corretor,
  Parceiro,
  PercentualMensal,
} from "@/lib/types";

/** Configuração padrão usada como fallback se a linha ainda não existir. */
export const CONFIG_PADRAO: Configuracoes = {
  id: true,
  percentual_comissao_padrao: 0.05,
  percentual_parceiro_padrao: 0.175,
  percentual_imposto_imobiliaria: 0.119,
  percentual_imposto_nf_corretor: 0.119,
  percentual_comissao_corretor_padrao: 0.0175,
  percentual_dizimo: 0,
  updated_at: new Date().toISOString(),
};

export async function getConfig(): Promise<Configuracoes> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracoes")
    .select("*")
    .eq("id", true)
    .single();
  return (data as Configuracoes | null) ?? CONFIG_PADRAO;
}

/**
 * Investidores ativos, já marcando quem participa da venda informada.
 * Vive em public (identidade compartilhada com o painel) e é fechado por RLS,
 * por isso a leitura usa o cliente admin. `vendaId` ausente = venda nova.
 */
export async function carregarInvestidoresDaVenda(vendaId?: string) {
  const pub = createAdminClient().schema("public");

  const [invRes, vinculosRes] = await Promise.all([
    pub.from("investidores").select("id,nome,percentual").eq("ativo", true).order("nome"),
    vendaId
      ? pub.from("investidor_vendas").select("investidor_id").eq("venda_id", vendaId)
      : Promise.resolve({ data: [] as { investidor_id: string }[] }),
  ]);

  const marcados = new Set(
    ((vinculosRes.data ?? []) as { investidor_id: string }[]).map((v) => v.investidor_id),
  );

  return ((invRes.data ?? []) as { id: string; nome: string; percentual: number }[]).map((i) => ({
    id: i.id,
    nome: i.nome,
    percentual: Number(i.percentual ?? 0),
    participa: marcados.has(i.id),
  }));
}

/** Carrega config + cadastros ativos necessários para o formulário de venda. */
export async function carregarCadastrosVenda() {
  const supabase = await createClient();
  const [config, construtoras, empreendimentos, corretores, parceiros, percentuais] =
    await Promise.all([
      supabase.from("configuracoes").select("*").eq("id", true).single(),
      supabase.from("construtoras").select("*").eq("ativo", true).order("nome"),
      supabase.from("empreendimentos").select("*").eq("ativo", true).order("nome"),
      // Só corretores viram vendedor da venda (funcionários não vendem).
      supabase.from("corretores").select("*").eq("ativo", true).eq("tipo", "corretor").order("nome"),
      supabase.from("parceiros").select("*").eq("ativo", true).order("nome"),
      supabase.from("percentuais_mensais").select("*"),
    ]);

  return {
    config: (config.data as Configuracoes | null) ?? CONFIG_PADRAO,
    construtoras: (construtoras.data ?? []) as Construtora[],
    empreendimentos: (empreendimentos.data ?? []) as Empreendimento[],
    corretores: (corretores.data ?? []) as Corretor[],
    parceiros: (parceiros.data ?? []) as Parceiro[],
    percentuaisMensais: (percentuais.data ?? []) as PercentualMensal[],
  };
}
