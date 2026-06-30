import { createClient } from "@/lib/supabase/server";
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
  percentual_distribuicao_empresa: 0.1,
  percentual_distribuicao_pessoal: 0.9,
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

/** Carrega config + cadastros ativos necessários para o formulário de venda. */
export async function carregarCadastrosVenda() {
  const supabase = await createClient();
  const [config, construtoras, empreendimentos, corretores, parceiros, percentuais] =
    await Promise.all([
      supabase.from("configuracoes").select("*").eq("id", true).single(),
      supabase.from("construtoras").select("*").eq("ativo", true).order("nome"),
      supabase.from("empreendimentos").select("*").eq("ativo", true).order("nome"),
      supabase.from("corretores").select("*").eq("ativo", true).order("nome"),
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
