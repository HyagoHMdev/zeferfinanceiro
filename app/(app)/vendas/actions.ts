"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { calcularComissao } from "@/lib/calculos";
import { vendaSchema, type VendaInput } from "@/lib/schemas/venda";
import type { VendaStatus } from "@/lib/types";

type ActionResult = { error?: string };

/** Monta a linha completa da venda, recalculando toda a cadeia no servidor. */
function montarLinha(input: VendaInput) {
  const percentualParceiro = input.parceiro_id ? input.percentual_parceiro : 0;

  const calc = calcularComissao({
    vgv: input.vgv,
    percentualComissao: input.percentual_comissao,
    percentualParceiro,
    percentualImpostoImobiliaria: input.percentual_imposto_imobiliaria,
    percentualCorretor: input.percentual_corretor,
    percentualImpostoNf: input.percentual_imposto_nf,
  });

  return {
    data_venda: input.data_venda,
    construtora_id: input.construtora_id,
    empreendimento_id: input.empreendimento_id,
    unidade: input.unidade,
    cliente: input.cliente,
    corretor_id: input.corretor_id,
    parceiro_id: input.parceiro_id,
    vgv: input.vgv,
    percentual_comissao: input.percentual_comissao,
    comissao_bruta: calc.comissaoBruta,
    percentual_parceiro: percentualParceiro,
    valor_parceiro: calc.valorParceiro,
    saldo_pos_parceiro: calc.saldoPosParceiro,
    percentual_imposto_imobiliaria: input.percentual_imposto_imobiliaria,
    valor_imposto: calc.valorImposto,
    liquido_zefer: calc.liquidoZefer,
    percentual_corretor: input.percentual_corretor,
    comissao_corretor_bruto: calc.comissaoCorretorBruto,
    percentual_imposto_nf: input.percentual_imposto_nf,
    valor_imposto_nf: calc.valorImpostoNf,
    liquido_corretor: calc.liquidoCorretor,
    lucro_liquido: calc.lucroLiquido,
    observacoes: input.observacoes,
  };
}

export async function criarVenda(input: VendaInput): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = vendaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };

  const supabase = await createClient();
  const { error } = await supabase.from("vendas").insert(montarLinha(parsed.data));
  if (error) return { error: error.message };

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
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
  const { error } = await supabase
    .from("vendas")
    .update(montarLinha(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${id}`);
  revalidatePath("/dashboard");
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

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${id}`);
  revalidatePath("/dashboard");
  return {};
}

export async function excluirVenda(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("vendas").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  redirect("/vendas");
}
