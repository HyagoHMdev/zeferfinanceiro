"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { calcularVenda } from "@/lib/calculos";
import type { StatusPagamentoCorretor } from "@/lib/types";

type ActionResult = { error?: string };

function revalidar(vendaId?: string) {
  revalidatePath("/corretores", "layout");
  if (vendaId) revalidatePath(`/corretores/${vendaId}`);
  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/meu-extrato");
}

const corretorVendaSchema = z.object({
  percentual_corretor: z.number().min(0).max(1),
  percentual_desconto_parceiro: z.number().min(0).max(1),
  percentual_imposto_nf: z.number().min(0).max(1),
});

/**
 * Salva os percentuais do corretor de uma venda e recalcula a cadeia do corretor
 * (fonte única: calcularVenda). Atualiza o snapshot na própria venda.
 */
export async function salvarCorretorVenda(
  vendaId: string,
  input: z.infer<typeof corretorVendaSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = corretorVendaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: v } = await supabase
    .from("vendas")
    .select(
      "vgv, percentual_comissao, possui_parceria, percentual_parceria, percentual_imposto_imobiliaria",
    )
    .eq("id", vendaId)
    .single();
  if (!v) return { error: "Venda não encontrada." };

  const r = calcularVenda({
    vgv: Number(v.vgv),
    percentualComissao: Number(v.percentual_comissao),
    possuiParceria: v.possui_parceria,
    percentualParceria: Number(v.percentual_parceria),
    percentualImpostoImobiliaria: Number(v.percentual_imposto_imobiliaria),
    percentualCorretor: parsed.data.percentual_corretor,
    percentualDescontoParceiro: parsed.data.percentual_desconto_parceiro,
    percentualImpostoNf: parsed.data.percentual_imposto_nf,
  });

  const { error } = await supabase
    .from("vendas")
    .update({
      percentual_corretor: parsed.data.percentual_corretor,
      percentual_desconto_parceiro: parsed.data.percentual_desconto_parceiro,
      percentual_imposto_nf: parsed.data.percentual_imposto_nf,
      comissao_corretor_bruto: r.comissaoCorretorBruto,
      valor_imposto_nf: r.valorImpostoNf,
      liquido_corretor: r.liquidoCorretor,
      lucro_liquido: r.lucroLiquido,
    })
    .eq("id", vendaId);
  if (error) return { error: error.message };

  revalidar(vendaId);
  return {};
}

export async function alterarStatusPagamentoCorretor(
  vendaId: string,
  status: StatusPagamentoCorretor,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("vendas")
    .update({ status_pagamento_corretor: status })
    .eq("id", vendaId);
  if (error) return { error: error.message };

  revalidar(vendaId);
  return {};
}

const adiantamentoSchema = z.object({
  corretor_id: z.string().uuid(),
  venda_id: z.string().uuid(),
  data: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().trim().max(200).nullable(),
  observacoes: z.string().trim().max(500).nullable(),
});

export async function registrarAdiantamento(
  input: z.infer<typeof adiantamentoSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = adiantamentoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("adiantamentos").insert(parsed.data);
  if (error) return { error: error.message };

  revalidar(parsed.data.venda_id);
  return {};
}

export async function excluirAdiantamento(
  id: string,
  vendaId: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("adiantamentos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidar(vendaId);
  return {};
}
