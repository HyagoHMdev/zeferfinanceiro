"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { getConfig } from "@/lib/data/cadastros";
import { calcularVenda } from "@/lib/calculos";
import { vendaSchema, type VendaInput } from "@/lib/schemas/venda";
import type { Configuracoes, VendaStatus } from "@/lib/types";

type ActionResult = { error?: string };

interface CorretorDefaults {
  corretorPct: number;
  impostoNfPct: number;
  descontoPct: number;
}

/** Percentuais do corretor (comissão / imposto NF) a partir do cadastro + config. */
async function defaultsCorretor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string | null,
  config: Configuracoes,
): Promise<CorretorDefaults> {
  let corretorPct = config.percentual_comissao_corretor_padrao;
  let impostoNfPct = config.percentual_imposto_nf_corretor;
  if (corretorId) {
    const { data } = await supabase
      .from("corretores")
      .select("percentual_comissao_padrao, percentual_imposto_nf")
      .eq("id", corretorId)
      .single();
    corretorPct = data?.percentual_comissao_padrao ?? corretorPct;
    impostoNfPct = data?.percentual_imposto_nf ?? impostoNfPct;
  }
  return { corretorPct, impostoNfPct, descontoPct: 0 };
}

/** Monta a linha completa da venda recalculando toda a cadeia via calcularVenda. */
function montarLinha(input: VendaInput, corr: CorretorDefaults) {
  const possui = input.possui_parceria;
  const percParceria = possui ? input.percentual_parceria : 0;

  const r = calcularVenda({
    vgv: input.vgv,
    percentualComissao: input.percentual_comissao,
    possuiParceria: possui,
    percentualParceria: percParceria,
    percentualImpostoImobiliaria: input.percentual_imposto_imobiliaria,
    percentualCorretor: corr.corretorPct,
    percentualDescontoParceiro: corr.descontoPct,
    percentualImpostoNf: corr.impostoNfPct,
  });

  return {
    data_venda: input.data_venda,
    construtora_id: input.construtora_id,
    empreendimento_id: input.empreendimento_id,
    unidade: input.unidade,
    torre: input.torre,
    cliente: input.cliente,
    cliente_nascimento: input.cliente_nascimento || null,
    cliente_telefone: input.cliente_telefone,
    corretor_id: input.corretor_id,
    // Parceria (modelo novo)
    possui_parceria: possui,
    empresa_parceira: possui ? input.empresa_parceira : null,
    percentual_parceria: percParceria,
    valor_parceria: r.valorParceria,
    liquido_pos_parceria: r.liquidoPosParceria,
    parceiro_id: possui ? input.parceiro_id : null,
    // Colunas legadas sincronizadas (compatibilidade)
    percentual_parceiro: percParceria,
    valor_parceiro: r.valorParceria,
    saldo_pos_parceiro: r.liquidoPosParceria,
    // Valores
    vgv: input.vgv,
    percentual_comissao: input.percentual_comissao,
    comissao_bruta: r.comissaoBruta,
    percentual_imposto_imobiliaria: input.percentual_imposto_imobiliaria,
    valor_imposto: r.valorImposto,
    liquido_zefer: r.liquidoZefer,
    // Corretor (geridos no módulo Corretores; aqui só o snapshot)
    percentual_corretor: corr.corretorPct,
    comissao_corretor_bruto: r.comissaoCorretorBruto,
    percentual_desconto_parceiro: corr.descontoPct,
    percentual_imposto_nf: corr.impostoNfPct,
    valor_imposto_nf: r.valorImpostoNf,
    liquido_corretor: r.liquidoCorretor,
    lucro_liquido: r.lucroLiquido,
    observacoes: input.observacoes,
  };
}

function revalidar(id?: string) {
  revalidatePath("/vendas");
  if (id) revalidatePath(`/vendas/${id}`);
  revalidatePath("/corretores", "layout");
  revalidatePath("/dashboard");
}

export async function criarVenda(input: VendaInput): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = vendaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };

  const supabase = await createClient();
  const config = await getConfig();
  const corr = await defaultsCorretor(supabase, parsed.data.corretor_id, config);

  const { error } = await supabase.from("vendas").insert(montarLinha(parsed.data, corr));
  if (error) return { error: error.message };

  revalidar();
  redirect("/vendas");
}

export async function atualizarVenda(
  id: string,
  input: VendaInput,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = vendaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };

  const supabase = await createClient();
  const config = await getConfig();

  // Preserva os percentuais do corretor definidos no módulo Corretores, a menos
  // que o corretor tenha sido trocado.
  const { data: atual } = await supabase
    .from("vendas")
    .select(
      "corretor_id, percentual_corretor, percentual_imposto_nf, percentual_desconto_parceiro",
    )
    .eq("id", id)
    .single();

  let corr: CorretorDefaults;
  if (atual && atual.corretor_id === parsed.data.corretor_id) {
    corr = {
      corretorPct: Number(atual.percentual_corretor),
      impostoNfPct: Number(atual.percentual_imposto_nf),
      descontoPct: Number(atual.percentual_desconto_parceiro),
    };
  } else {
    corr = await defaultsCorretor(supabase, parsed.data.corretor_id, config);
  }

  const { error } = await supabase
    .from("vendas")
    .update(montarLinha(parsed.data, corr))
    .eq("id", id);
  if (error) return { error: error.message };

  revalidar(id);
  redirect("/vendas");
}

export async function alterarStatusVenda(
  id: string,
  status: VendaStatus,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("vendas").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidar(id);
  return {};
}

export async function excluirVenda(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("vendas").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  redirect("/vendas");
}
