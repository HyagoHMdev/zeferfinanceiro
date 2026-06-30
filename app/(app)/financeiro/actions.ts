"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { lancamentoSchema, type LancamentoInput } from "@/lib/schemas/lancamento";
import type { LancamentoStatus } from "@/lib/types";

type ActionResult = { error?: string };

/** Converte "YYYY-MM" + deslocamento de meses em data "YYYY-MM-01". */
function competenciaISO(yyyymm: string, offsetMeses: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMeses, 1));
  return d.toISOString().slice(0, 10);
}

function revalidarFinanceiro() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/dashboard");
}

export async function criarLancamento(
  input: LancamentoInput,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };
  const e = parsed.data;

  const reps = e.recorrencia === "nenhuma" ? 1 : e.repeticoes;
  const grupo = reps > 1 ? crypto.randomUUID() : null;

  const rows = Array.from({ length: reps }, (_, i) => {
    const offset = e.recorrencia === "anual" ? i * 12 : i;
    return {
      escopo: e.escopo,
      natureza: e.natureza,
      categoria_id: e.categoria_id,
      descricao: e.descricao,
      valor: e.valor,
      competencia: competenciaISO(e.competencia, offset),
      data_vencimento: i === 0 ? e.data_vencimento : null,
      status: e.status,
      recorrencia: e.recorrencia,
      recorrencia_grupo: grupo,
      conta_id: e.conta_id,
      centro_custo_id: e.centro_custo_id,
      fornecedor_id: e.fornecedor_id,
      anexo_url: e.anexo_url,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").insert(rows);
  if (error) return { error: error.message };

  revalidarFinanceiro();
  return {};
}

export async function atualizarLancamento(
  id: string,
  input: LancamentoInput,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };
  const e = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update({
      escopo: e.escopo,
      natureza: e.natureza,
      categoria_id: e.categoria_id,
      descricao: e.descricao,
      valor: e.valor,
      competencia: competenciaISO(e.competencia, 0),
      data_vencimento: e.data_vencimento,
      status: e.status,
      conta_id: e.conta_id,
      centro_custo_id: e.centro_custo_id,
      fornecedor_id: e.fornecedor_id,
      anexo_url: e.anexo_url,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidarFinanceiro();
  return {};
}

export async function alterarStatusLancamento(
  id: string,
  status: LancamentoStatus,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const patch: { status: LancamentoStatus; data_pagamento?: string | null } = {
    status,
  };
  if (status === "pago") patch.data_pagamento = new Date().toISOString().slice(0, 10);
  if (status !== "pago") patch.data_pagamento = null;

  const { error } = await supabase.from("lancamentos").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidarFinanceiro();
  return {};
}

export async function excluirLancamento(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidarFinanceiro();
  return {};
}
