"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";

type ActionResult = { error?: string };

function revalidar() {
  revalidatePath("/adiantamentos");
  revalidatePath("/pagamentos");
  revalidatePath("/corretores", "layout");
  revalidatePath("/meu-extrato");
}

const baseSchema = z.object({
  corretor_id: z.string().uuid(),
  data: z.string().min(1),
  valor: z.number().positive("Valor inválido"),
  descricao: z.string().trim().max(200).nullable(),
  recibo_ok: z.boolean(),
});

export async function criarAdiantamento(
  input: z.infer<typeof baseSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("adiantamentos")
    .insert({ ...parsed.data, venda_id: null });
  if (error) return { error: error.message };

  revalidar();
  return {};
}

const editarSchema = baseSchema.extend({ id: z.string().uuid() });

export async function atualizarAdiantamento(
  input: z.infer<typeof editarSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = editarSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("adiantamentos")
    .update(dados)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  return {};
}

export async function alternarReciboOk(
  id: string,
  reciboOk: boolean,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("adiantamentos")
    .update({ recibo_ok: reciboOk })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  return {};
}

export async function excluirAdiantamentoAvulso(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("adiantamentos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  return {};
}
