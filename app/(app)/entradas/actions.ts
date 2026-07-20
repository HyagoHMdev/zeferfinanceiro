"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { calcularDistribuicao } from "@/lib/calculos";
import { entradaSchema, type EntradaInput } from "@/lib/schemas/entrada";

type ActionResult = { error?: string };

/**
 * Insere as linhas de distribuição de uma entrada.
 * escopo "empresa": 2 linhas (empresa/pessoal). escopo "joinville": 1 linha que
 * manda 100% do líquido para a Zefer Joinville (carteira separada).
 */
async function inserirDistribuicoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entradaId: string,
  escopo: "empresa" | "joinville",
  valor: number,
  percentualDizimo: number,
  percEmpresa: number,
  percPessoal: number,
) {
  const dist = calcularDistribuicao({
    valor,
    percentualDizimo,
    percentualEmpresa: percEmpresa,
  });
  if (escopo === "joinville") {
    return supabase.from("distribuicoes").insert([
      { entrada_id: entradaId, destino: "joinville", percentual: 1, valor: dist.liquido },
    ]);
  }
  return supabase.from("distribuicoes").insert([
    {
      entrada_id: entradaId,
      destino: "empresa",
      percentual: percEmpresa,
      valor: dist.valorEmpresa,
    },
    {
      entrada_id: entradaId,
      destino: "pessoal",
      percentual: percPessoal,
      valor: dist.valorPessoal,
    },
  ]);
}

export async function criarEntrada(input: EntradaInput): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };
  const e = parsed.data;

  const dist = calcularDistribuicao({
    valor: e.valor,
    percentualDizimo: e.percentual_dizimo,
    percentualEmpresa: e.percentual_empresa,
  });

  const supabase = await createClient();
  const { data: entrada, error } = await supabase
    .from("entradas")
    .insert({
      data: e.data,
      tipo: e.tipo,
      descricao: e.descricao,
      valor: e.valor,
      percentual_dizimo: e.percentual_dizimo,
      valor_dizimo: dist.valorDizimo,
      liquido: dist.liquido,
      venda_id: e.venda_id,
      escopo: e.escopo,
    })
    .select("id")
    .single();
  if (error || !entrada) return { error: error?.message ?? "Falha ao salvar" };

  const { error: distErr } = await inserirDistribuicoes(
    supabase,
    entrada.id,
    e.escopo,
    e.valor,
    e.percentual_dizimo,
    e.percentual_empresa,
    e.percentual_pessoal,
  );
  if (distErr) return { error: distErr.message };

  // Recebimento de comissão liga a entrada à venda e a marca como "recebido".
  if (e.venda_id) {
    await supabase
      .from("vendas")
      .update({ status: "recebido" })
      .eq("id", e.venda_id)
      .eq("status", "aguardando_recebimento");
  }

  revalidatePath("/entradas");
  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  return {};
}

export async function atualizarEntrada(
  id: string,
  input: EntradaInput,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };
  const e = parsed.data;

  const dist = calcularDistribuicao({
    valor: e.valor,
    percentualDizimo: e.percentual_dizimo,
    percentualEmpresa: e.percentual_empresa,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("entradas")
    .update({
      data: e.data,
      tipo: e.tipo,
      descricao: e.descricao,
      valor: e.valor,
      percentual_dizimo: e.percentual_dizimo,
      valor_dizimo: dist.valorDizimo,
      liquido: dist.liquido,
      venda_id: e.venda_id,
      escopo: e.escopo,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Recria as distribuições com os valores atualizados.
  await supabase.from("distribuicoes").delete().eq("entrada_id", id);
  const { error: distErr } = await inserirDistribuicoes(
    supabase,
    id,
    e.escopo,
    e.valor,
    e.percentual_dizimo,
    e.percentual_empresa,
    e.percentual_pessoal,
  );
  if (distErr) return { error: distErr.message };

  revalidatePath("/entradas");
  revalidatePath("/dashboard");
  return {};
}

export async function excluirEntrada(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("entradas").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/entradas");
  revalidatePath("/dashboard");
  return {};
}
