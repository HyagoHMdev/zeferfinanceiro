"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { round2 } from "@/lib/calculos";

type ActionResult = { error?: string; pagamentoId?: string };

const adiantamentoSchema = z.object({
  corretor_id: z.string().uuid(),
  data: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().trim().max(200).nullable(),
  recibo_url: z.string().nullable(),
});

const bonificacaoSchema = z.object({
  corretor_id: z.string().uuid(),
  data: z.string().min(1),
  valor: z.number().positive(),
  motivo: z.string().trim().max(200).nullable(),
});

export async function registrarAdiantamento(
  input: z.infer<typeof adiantamentoSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = adiantamentoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("adiantamentos").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath(`/corretores/${parsed.data.corretor_id}`);
  revalidatePath("/corretores");
  return {};
}

export async function registrarBonificacao(
  input: z.infer<typeof bonificacaoSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = bonificacaoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("bonificacoes").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath(`/corretores/${parsed.data.corretor_id}`);
  revalidatePath("/corretores");
  return {};
}

export async function excluirAdiantamento(
  id: string,
  corretorId: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  // Só permite excluir adiantamentos ainda não incluídos em um pagamento.
  const { error } = await supabase
    .from("adiantamentos")
    .delete()
    .eq("id", id)
    .is("pagamento_id", null);
  if (error) return { error: error.message };

  revalidatePath(`/corretores/${corretorId}`);
  return {};
}

export async function excluirBonificacao(
  id: string,
  corretorId: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("bonificacoes")
    .delete()
    .eq("id", id)
    .is("pagamento_id", null);
  if (error) return { error: error.message };

  revalidatePath(`/corretores/${corretorId}`);
  return {};
}

/**
 * Registra o pagamento de um corretor, agrupando TODAS as pendências:
 * comissões recebidas e não pagas, bonificações e adiantamentos em aberto.
 */
export async function registrarPagamento(
  corretorId: string,
  data: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();

  const [vendasRes, adiRes, bonRes] = await Promise.all([
    supabase
      .from("vendas")
      .select("id, liquido_corretor")
      .eq("corretor_id", corretorId)
      .eq("status", "recebido")
      .is("pagamento_id", null),
    supabase
      .from("adiantamentos")
      .select("id, valor")
      .eq("corretor_id", corretorId)
      .is("pagamento_id", null),
    supabase
      .from("bonificacoes")
      .select("id, valor")
      .eq("corretor_id", corretorId)
      .is("pagamento_id", null),
  ]);

  const vendas = (vendasRes.data ?? []) as { id: string; liquido_corretor: number }[];
  const adiantamentos = (adiRes.data ?? []) as { id: string; valor: number }[];
  const bonificacoes = (bonRes.data ?? []) as { id: string; valor: number }[];

  if (vendas.length === 0 && adiantamentos.length === 0 && bonificacoes.length === 0) {
    return { error: "Não há pendências para pagar." };
  }

  const valorBruto = round2(
    vendas.reduce((s, v) => s + Number(v.liquido_corretor), 0),
  );
  const totalBonificacoes = round2(
    bonificacoes.reduce((s, b) => s + Number(b.valor), 0),
  );
  const totalAdiantamentos = round2(
    adiantamentos.reduce((s, a) => s + Number(a.valor), 0),
  );
  const valorLiquido = round2(valorBruto + totalBonificacoes - totalAdiantamentos);

  const { data: pagamento, error } = await supabase
    .from("pagamentos_corretor")
    .insert({
      corretor_id: corretorId,
      data,
      valor_bruto: valorBruto,
      total_bonificacoes: totalBonificacoes,
      total_adiantamentos: totalAdiantamentos,
      valor_liquido: valorLiquido,
      status: "pago",
    })
    .select("id")
    .single();
  if (error || !pagamento) return { error: error?.message ?? "Falha ao pagar" };

  if (vendas.length > 0) {
    await supabase
      .from("vendas")
      .update({ pagamento_id: pagamento.id, status: "pago" })
      .in(
        "id",
        vendas.map((v) => v.id),
      );
  }
  if (adiantamentos.length > 0) {
    await supabase
      .from("adiantamentos")
      .update({ pagamento_id: pagamento.id })
      .in(
        "id",
        adiantamentos.map((a) => a.id),
      );
  }
  if (bonificacoes.length > 0) {
    await supabase
      .from("bonificacoes")
      .update({ pagamento_id: pagamento.id })
      .in(
        "id",
        bonificacoes.map((b) => b.id),
      );
  }

  revalidatePath(`/corretores/${corretorId}`);
  revalidatePath("/corretores");
  revalidatePath("/dashboard");
  return { pagamentoId: pagamento.id };
}
