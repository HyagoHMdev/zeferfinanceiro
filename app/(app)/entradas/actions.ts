"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { calcularDistribuicao, round2 } from "@/lib/calculos";
import { entradaSchema, type EntradaInput } from "@/lib/schemas/entrada";

type ActionResult = { error?: string };

// 100% de Joinville => escopo 'joinville' (entrada só da carteira Joinville);
// qualquer outra combinação é uma entrada da Zefer (escopo 'empresa').
function escopoDe(percJoinville: number): "empresa" | "joinville" {
  return percJoinville >= 0.9999 ? "joinville" : "empresa";
}

/**
 * Insere as linhas de distribuição de uma entrada: Empresa, Pessoal e Zefer
 * Joinville, cada uma como % do líquido. O pessoal fica com o resto para não
 * sobrar/faltar centavo no arredondamento. Linhas com 0% são omitidas.
 */
async function inserirDistribuicoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entradaId: string,
  liquido: number,
  percEmpresa: number,
  percPessoal: number,
  percJoinville: number,
) {
  const vEmpresa = round2(liquido * percEmpresa);
  const vJoinville = round2(liquido * percJoinville);
  const vPessoal = round2(liquido - vEmpresa - vJoinville);
  const linhas = [
    { entrada_id: entradaId, destino: "empresa", percentual: percEmpresa, valor: vEmpresa },
    { entrada_id: entradaId, destino: "pessoal", percentual: percPessoal, valor: vPessoal },
    { entrada_id: entradaId, destino: "joinville", percentual: percJoinville, valor: vJoinville },
  ].filter((l) => l.percentual > 0);
  return supabase.from("distribuicoes").insert(linhas);
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
      escopo: escopoDe(e.percentual_joinville),
    })
    .select("id")
    .single();
  if (error || !entrada) return { error: error?.message ?? "Falha ao salvar" };

  const { error: distErr } = await inserirDistribuicoes(
    supabase,
    entrada.id,
    dist.liquido,
    e.percentual_empresa,
    e.percentual_pessoal,
    e.percentual_joinville,
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
      escopo: escopoDe(e.percentual_joinville),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Recria as distribuições com os valores atualizados.
  await supabase.from("distribuicoes").delete().eq("entrada_id", id);
  const { error: distErr } = await inserirDistribuicoes(
    supabase,
    id,
    dist.liquido,
    e.percentual_empresa,
    e.percentual_pessoal,
    e.percentual_joinville,
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
