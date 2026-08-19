"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";

type ActionResult = { error?: string };

function revalidar() {
  revalidatePath("/bonificacoes");
  revalidatePath("/corretores", "layout");
  revalidatePath("/meu-extrato");
}

const decisaoSchema = z.object({
  id: z.string().uuid(),
  observacao: z.string().trim().max(500).optional(),
});

/**
 * Cria a bonificação a partir da submissão do corretor, na aprovação da venda.
 *
 * Nasce "pendente" de propósito: aprovar a VENDA não é aprovar o bônus. O
 * financeiro ainda vai conferir a campanha contra o print antes de assumir o
 * valor, e a construtora ainda vai pagar.
 *
 * Falhar aqui não derruba a venda: o índice único por venda deixa criar depois
 * sem risco de duplicar.
 */
export async function criarBonificacaoDaVenda(
  vendaId: string,
  checklistId: string,
): Promise<ActionResult> {
  const pub = createAdminClient().schema("public");
  const { data: c } = await pub
    .from("vendas_checklist")
    .select("tem_bonificacao, bonificacao_campanha, bonificacao_valor, bonificacao_print")
    .eq("id", checklistId)
    .maybeSingle<{
      tem_bonificacao: boolean | null;
      bonificacao_campanha: string | null;
      bonificacao_valor: number | null;
      bonificacao_print: { path: string; nome: string }[] | null;
    }>();
  if (!c?.tem_bonificacao || !c.bonificacao_campanha || !(Number(c.bonificacao_valor) > 0)) {
    return {};
  }

  const supabase = await createClient();
  const { data: venda } = await supabase
    .from("vendas")
    .select("corretor_id, data_venda")
    .eq("id", vendaId)
    .maybeSingle<{ corretor_id: string | null; data_venda: string }>();
  if (!venda?.corretor_id) return { error: "Venda sem corretor: bonificação não criada." };

  const { error } = await supabase.from("bonificacoes").insert({
    corretor_id: venda.corretor_id,
    venda_id: vendaId,
    campanha: c.bonificacao_campanha,
    valor: Number(c.bonificacao_valor),
    data: venda.data_venda,
    motivo: `Campanha ${c.bonificacao_campanha}`,
    anexos: c.bonificacao_print ?? [],
    status: "pendente",
  });
  // 23505 = já existe uma para esta venda. Não é erro: é a proteção agindo.
  if (error && error.code !== "23505") return { error: error.message };

  revalidar();
  return {};
}

/** Confere e aceita o bônus. Ainda não é pagamento: a construtora não pagou. */
export async function aprovarBonificacao(
  input: z.infer<typeof decisaoSchema>,
): Promise<ActionResult> {
  const sessao = await requireRole(ADMIN_FIN_ROLES);
  const parsed = decisaoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bonificacoes")
    .update({
      status: "aprovada",
      observacao: parsed.data.observacao || null,
      aprovado_por: sessao.profile.id,
      aprovado_em: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .in("status", ["pendente", "recusada"]);
  if (error) return { error: error.message };

  revalidar();
  return {};
}

/** Recusa o bônus (campanha não valia para esta venda, valor errado, etc.). */
export async function recusarBonificacao(
  input: z.infer<typeof decisaoSchema>,
): Promise<ActionResult> {
  const sessao = await requireRole(ADMIN_FIN_ROLES);
  const parsed = decisaoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  if (!parsed.data.observacao?.trim()) {
    return { error: "Diga o motivo da recusa: é o que o corretor vai ler." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bonificacoes")
    .update({
      status: "recusada",
      observacao: parsed.data.observacao,
      aprovado_por: sessao.profile.id,
      aprovado_em: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .neq("status", "paga");
  if (error) return { error: error.message };

  revalidar();
  return {};
}

const pagarSchema = z.object({
  id: z.string().uuid(),
  data: z.string().min(1, "Informe a data do pagamento."),
});

/**
 * Marca como paga: a construtora liberou o bônus e o corretor recebeu.
 *
 * Só sai de "aprovada": pagar sem conferir é justamente o que a aba existe
 * para impedir.
 */
export async function pagarBonificacao(
  input: z.infer<typeof pagarSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = pagarSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("bonificacoes")
    .update({ status: "paga", pago_em: parsed.data.data }, { count: "exact" })
    .eq("id", parsed.data.id)
    .eq("status", "aprovada");
  if (error) return { error: error.message };
  if (!count) return { error: "Só dá para pagar uma bonificação aprovada." };

  revalidar();
  return {};
}

/** Link curto para o financeiro abrir o print da campanha. */
export async function abrirAnexoBonificacao(
  path: string,
): Promise<{ erro?: string; url?: string }> {
  await requireRole(ADMIN_FIN_ROLES);
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("contratos").createSignedUrl(path, 300);
  if (error || !data) return { erro: error?.message ?? "Não foi possível abrir o arquivo." };
  return { url: data.signedUrl };
}
