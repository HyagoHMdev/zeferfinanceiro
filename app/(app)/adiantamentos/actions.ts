"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import {
  criarLancamentoEspelho,
  sincronizarDespesaDoAdiantamento,
} from "@/lib/adiantamento-despesa";

type ActionResult = { error?: string };

function revalidar() {
  revalidatePath("/adiantamentos");
  revalidatePath("/pagamentos");
  revalidatePath("/corretores", "layout");
  revalidatePath("/meu-extrato");
  // O lançamento espelho (despesa variável) afeta o Financeiro e o Dashboard.
  revalidatePath("/financeiro", "layout");
  revalidatePath("/dashboard");
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

  // Espelha como despesa variável da empresa. Cria o lançamento primeiro e
  // insere o adiantamento já vinculado — se o adiantamento falhar, compensa
  // apagando o lançamento (nada fica gravado, retry não duplica).
  const espelho = await criarLancamentoEspelho(supabase, parsed.data);
  if (espelho.error) return { error: espelho.error };

  const { error } = await supabase
    .from("adiantamentos")
    .insert({ ...parsed.data, venda_id: null, lancamento_id: espelho.id });
  if (error) {
    await supabase.from("lancamentos").delete().eq("id", espelho.id!);
    return { error: error.message };
  }

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
  const { data: atualizado, error } = await supabase
    .from("adiantamentos")
    .update(dados)
    .eq("id", id)
    .select("id, corretor_id, data, valor, descricao, lancamento_id")
    .single();
  if (error || !atualizado) return { error: error?.message ?? "Falha ao salvar." };

  // Mantém a despesa variável espelho em dia.
  const esp = await sincronizarDespesaDoAdiantamento(supabase, atualizado);
  if (esp.error) return { error: esp.error };

  revalidar();
  return {};
}

/** Salva (ou remove) o arquivo do recibo assinado do adiantamento. */
export async function salvarReciboAdiantamento(
  id: string,
  url: string | null,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const patch: { recibo_url: string | null; recibo_ok?: boolean } = {
    recibo_url: url,
  };
  if (url) patch.recibo_ok = true; // anexar o assinado marca como recebido
  const { error } = await supabase
    .from("adiantamentos")
    .update(patch)
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
  // O trigger no banco apaga o lançamento-espelho junto.
  const { error } = await supabase.from("adiantamentos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  return {};
}
