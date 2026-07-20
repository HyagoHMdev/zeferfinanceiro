"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";

export type AniversarioInput = {
  nome: string;
  dia: number | null;
  mes: number | null;
  telefone: string | null;
};

type ActionResult = { error?: string };

function normaliza(
  input: AniversarioInput,
): { nome: string; dia: number | null; mes: number | null; telefone: string | null } | { error: string } {
  const nome = String(input.nome ?? "").trim().slice(0, 120);
  if (!nome) return { error: "Informe o nome." };
  const dia = input.dia == null || Number.isNaN(input.dia) ? null : Math.round(Number(input.dia));
  const mes = input.mes == null || Number.isNaN(input.mes) ? null : Math.round(Number(input.mes));
  if (dia != null && (dia < 1 || dia > 31)) return { error: "Dia inválido (1 a 31)." };
  if (mes != null && (mes < 1 || mes > 12)) return { error: "Mês inválido." };
  const telefone = String(input.telefone ?? "").trim().slice(0, 30) || null;
  return { nome, dia, mes, telefone };
}

export async function criarAniversario(input: AniversarioInput): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const n = normaliza(input);
  if ("error" in n) return n;
  const admin = createAdminClient();
  const { error } = await admin.schema("public").from("aniversariantes").insert(n);
  if (error) return { error: "Falha ao salvar." };
  revalidatePath("/aniversarios");
  return {};
}

export async function atualizarAniversario(id: string, input: AniversarioInput): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const n = normaliza(input);
  if ("error" in n) return n;
  const admin = createAdminClient();
  const { error } = await admin.schema("public").from("aniversariantes").update(n).eq("id", id);
  if (error) return { error: "Falha ao salvar." };
  revalidatePath("/aniversarios");
  return {};
}

export async function excluirAniversario(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const admin = createAdminClient();
  const { error } = await admin.schema("public").from("aniversariantes").delete().eq("id", id);
  if (error) return { error: "Falha ao excluir." };
  revalidatePath("/aniversarios");
  return {};
}
