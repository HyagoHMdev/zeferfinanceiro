"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";

type ActionResult = { error?: string };

const atividadeSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  titulo: z.string().trim().min(1, "Escreva o que precisa ser feito").max(200),
  descricao: z.string().trim().max(2000).nullable().optional(),
  categoria: z.enum(["geral", "pagamento", "recebimento", "reuniao", "prazo"]),
  // "" vira null: input de hora vazio não pode virar time inválido no banco.
  hora: z.string().nullable().optional(),
});

export type AtividadeInput = z.infer<typeof atividadeSchema>;

export async function criarAtividade(input: AtividadeInput): Promise<ActionResult> {
  const { userId } = await requireRole(ADMIN_FIN_ROLES);
  const parsed = atividadeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("agenda").insert({
    ...parsed.data,
    descricao: parsed.data.descricao || null,
    hora: parsed.data.hora || null,
    criado_por: userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return {};
}

export async function atualizarAtividade(
  id: string,
  input: AtividadeInput,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = atividadeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({
      ...parsed.data,
      descricao: parsed.data.descricao || null,
      hora: parsed.data.hora || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return {};
}

/** Marca/desmarca como feita. Guarda quando foi concluída, para histórico. */
export async function alternarConcluida(id: string, concluida: boolean): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({ concluida, concluida_em: concluida ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return {};
}

/** Move a atividade para outro dia (arrastar no calendário). */
export async function moverAtividade(id: string, data: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { error: "Data inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("agenda").update({ data }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return {};
}

export async function excluirAtividade(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("agenda").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return {};
}
