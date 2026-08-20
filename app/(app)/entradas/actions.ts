"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { round2 } from "@/lib/calculos";
import { entradaSchema, type EntradaInput } from "@/lib/schemas/entrada";

type ActionResult = { error?: string };

export async function criarEntrada(input: EntradaInput): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos. Revise o formulário." };
  const e = parsed.data;

  // Sem rateio: o líquido é o valor menos o dízimo, e é todo da empresa.
  const valorDizimo = round2(e.valor * e.percentual_dizimo);
  const liquido = round2(e.valor - valorDizimo);

  const supabase = await createClient();
  const { data: entrada, error } = await supabase
    .from("entradas")
    .insert({
      data: e.data,
      tipo: e.tipo,
      descricao: e.descricao,
      valor: e.valor,
      percentual_dizimo: e.percentual_dizimo,
      valor_dizimo: valorDizimo,
      liquido,
      venda_id: e.venda_id,
      escopo: "empresa",
    })
    .select("id")
    .single();
  if (error || !entrada) return { error: error?.message ?? "Falha ao salvar" };

  // Recebimento de comissão liga a entrada à venda e a marca como "recebido".
  // Em venda PARCELADA quem decide o status é a parcela (gatilho no banco):
  // marcar "recebido" aqui apagaria o "parcialmente recebido" no meio do
  // caminho, dizendo que entrou dinheiro que ainda está com a construtora.
  if (e.venda_id) {
    await supabase
      .from("vendas")
      .update({ status: "recebido" })
      .eq("id", e.venda_id)
      .eq("recebimento_parcelado", false)
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

  const valorDizimo = round2(e.valor * e.percentual_dizimo);
  const liquido = round2(e.valor - valorDizimo);

  const supabase = await createClient();
  const { error } = await supabase
    .from("entradas")
    .update({
      data: e.data,
      tipo: e.tipo,
      descricao: e.descricao,
      valor: e.valor,
      percentual_dizimo: e.percentual_dizimo,
      valor_dizimo: valorDizimo,
      liquido,
      venda_id: e.venda_id,
      escopo: "empresa",
    })
    .eq("id", id);
  if (error) return { error: error.message };

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
