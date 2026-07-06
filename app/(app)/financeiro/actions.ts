"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { vencimentoDaCompetencia } from "@/lib/format";
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

  // Dia base do vencimento (para replicar em cada mês da recorrência).
  const diaBase = e.data_vencimento
    ? new Date(e.data_vencimento).getUTCDate()
    : null;

  const rows = Array.from({ length: reps }, (_, i) => {
    const offset = e.recorrencia === "anual" ? i * 12 : i;
    const competencia = competenciaISO(e.competencia, offset);
    // Recorrente: cada ocorrência tem seu próprio vencimento (dia base,
    // clampado ao último dia do mês). Único (reps=1): respeita a data digitada.
    const dataVencimento =
      reps > 1
        ? vencimentoDaCompetencia(diaBase ?? 1, competencia)
        : e.data_vencimento;
    return {
      escopo: e.escopo,
      natureza: e.natureza,
      categoria_id: e.categoria_id,
      descricao: e.descricao,
      valor: e.valor,
      competencia,
      data_vencimento: dataVencimento,
      status: e.status,
      recorrencia: e.recorrencia,
      recorrencia_grupo: grupo,
      conta_id: e.conta_id,
      centro_custo_id: e.centro_custo_id,
      fornecedor_id: e.fornecedor_id,
      anexo_url: e.anexo_url,
      observacoes: e.observacoes,
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
  escopo: "este" | "grupo" = "este",
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };
  const e = parsed.data;

  const supabase = await createClient();

  // Campos compartilhados (não incluem competência/vencimento, que são por mês).
  const comuns = {
    escopo: e.escopo,
    natureza: e.natureza,
    categoria_id: e.categoria_id,
    descricao: e.descricao,
    valor: e.valor,
    status: e.status,
    conta_id: e.conta_id,
    centro_custo_id: e.centro_custo_id,
    fornecedor_id: e.fornecedor_id,
    anexo_url: e.anexo_url,
    observacoes: e.observacoes,
  };

  // Descobre o grupo (se houver) para o escopo "grupo".
  let grupo: string | null = null;
  if (escopo === "grupo") {
    const { data: base } = await supabase
      .from("lancamentos")
      .select("recorrencia_grupo")
      .eq("id", id)
      .single();
    grupo = (base?.recorrencia_grupo as string | null) ?? null;
  }

  if (escopo === "grupo" && grupo) {
    // Atualiza os campos comuns em todas as ocorrências do grupo.
    const { error } = await supabase
      .from("lancamentos")
      .update(comuns)
      .eq("recorrencia_grupo", grupo);
    if (error) return { error: error.message };

    // Se um vencimento foi informado, propaga o dia para cada mês (clampado).
    if (e.data_vencimento) {
      const dia = new Date(e.data_vencimento).getUTCDate();
      const { data: rows } = await supabase
        .from("lancamentos")
        .select("id, competencia")
        .eq("recorrencia_grupo", grupo);
      await Promise.all(
        (rows ?? []).map((r) =>
          supabase
            .from("lancamentos")
            .update({
              data_vencimento: vencimentoDaCompetencia(dia, r.competencia as string),
            })
            .eq("id", r.id as string),
        ),
      );
    }
  } else {
    // Somente este lançamento (inclui competência e vencimento).
    const { error } = await supabase
      .from("lancamentos")
      .update({
        ...comuns,
        competencia: competenciaISO(e.competencia, 0),
        data_vencimento: e.data_vencimento,
      })
      .eq("id", id);
    if (error) return { error: error.message };
  }

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

export async function excluirLancamento(
  id: string,
  escopo: "este" | "grupo" = "este",
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();

  if (escopo === "grupo") {
    const { data: base } = await supabase
      .from("lancamentos")
      .select("recorrencia_grupo")
      .eq("id", id)
      .single();
    const grupo = (base?.recorrencia_grupo as string | null) ?? null;
    if (grupo) {
      const { error } = await supabase
        .from("lancamentos")
        .delete()
        .eq("recorrencia_grupo", grupo);
      if (error) return { error: error.message };
      revalidarFinanceiro();
      return {};
    }
  }

  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidarFinanceiro();
  return {};
}
