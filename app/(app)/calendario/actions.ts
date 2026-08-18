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
  repeticao: z.enum(["nenhuma", "semanal", "quinzenal", "mensal"]).optional(),
});

export type AtividadeInput = z.infer<typeof atividadeSchema>;

/**
 * Quantas ocorrências criar para cada repetição. Semanal e quinzenal cobrem
 * meio ano; mensal, um ano. Materializar exige um teto: sem ele, ou a agenda
 * viraria infinita ou alguém teria que rodar um processo mensal para esticá-la.
 */
const OCORRENCIAS: Record<string, number> = { semanal: 26, quinzenal: 13, mensal: 12 };

/**
 * Datas da série a partir da primeira, sem passar por fuso: a conta é feita em
 * UTC e a data volta como texto.
 *
 * No mensal, dia 31 em mês que não tem 31 cai no último dia do mês (e o mês
 * seguinte volta ao 31), senão "todo dia 31" viraria dia 1º do mês seguinte.
 */
function datasDaSerie(inicio: string, repeticao: string): string[] {
  const total = OCORRENCIAS[repeticao];
  if (!total) return [inicio];

  const [ano, mes, dia] = inicio.split("-").map(Number);
  const datas: string[] = [];
  for (let i = 0; i < total; i++) {
    if (repeticao === "mensal") {
      const alvo = new Date(Date.UTC(ano, mes - 1 + i, 1));
      const ultimoDia = new Date(
        Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
      ).getUTCDate();
      alvo.setUTCDate(Math.min(dia, ultimoDia));
      datas.push(alvo.toISOString().slice(0, 10));
      continue;
    }
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    d.setUTCDate(d.getUTCDate() + i * (repeticao === "semanal" ? 7 : 14));
    datas.push(d.toISOString().slice(0, 10));
  }
  return datas;
}

export async function criarAtividade(input: AtividadeInput): Promise<ActionResult> {
  const { userId } = await requireRole(ADMIN_FIN_ROLES);
  const parsed = atividadeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { repeticao = "nenhuma", ...campos } = parsed.data;
  const base = {
    ...campos,
    descricao: campos.descricao || null,
    hora: campos.hora || null,
    criado_por: userId,
  };

  const supabase = await createClient();
  if (repeticao === "nenhuma") {
    const { error } = await supabase.from("agenda").insert(base);
    if (error) return { error: error.message };
  } else {
    // serie_id liga as ocorrências: é o que permite apagar a série inteira
    // depois sem caçar atividade por atividade.
    const serie = crypto.randomUUID();
    const linhas = datasDaSerie(campos.data, repeticao).map((data) => ({
      ...base,
      data,
      repeticao,
      serie_id: serie,
    }));
    const { error } = await supabase.from("agenda").insert(linhas);
    if (error) return { error: error.message };
  }

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

  // A edição vale só para a ocorrência aberta: mudar a série inteira a partir
  // de um dia é outra operação, e fazer isso sem querer bagunçaria meses.
  const { repeticao: _serie, ...campos } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({
      ...campos,
      descricao: campos.descricao || null,
      hora: campos.hora || null,
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

/** Apaga a série a partir desta atividade (ela e as futuras). */
export async function excluirSerie(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { data: alvo } = await supabase
    .from("agenda")
    .select("serie_id, data")
    .eq("id", id)
    .maybeSingle();
  if (!alvo) return { error: "Atividade não encontrada." };
  if (!alvo.serie_id) return await excluirAtividade(id);

  // Só daqui para frente: o que já passou é histórico do que foi feito.
  const { error } = await supabase
    .from("agenda")
    .delete()
    .eq("serie_id", alvo.serie_id)
    .gte("data", alvo.data);
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
