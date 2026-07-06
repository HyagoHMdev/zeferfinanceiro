"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { round2 } from "@/lib/calculos";

type ActionResult = { error?: string; pagamentoId?: string };

function revalidar() {
  revalidatePath("/pagamentos");
  revalidatePath("/corretores", "layout");
  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/meu-extrato");
}

const registrarSchema = z.object({ corretorId: z.string().uuid() });

/**
 * Registra um pagamento consolidado a um corretor: junta as comissões
 * aguardando liberação e os adiantamentos (ainda não vinculados) daquelas
 * vendas, grava um `pagamentos_corretor`, marca as vendas como pagas e vincula
 * comissões e adiantamentos ao pagamento (para o recibo). Os valores são
 * recalculados no servidor — não se confia no que veio do cliente.
 */
export async function registrarPagamento(
  input: z.infer<typeof registrarSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = registrarSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { corretorId } = parsed.data;

  const supabase = await createClient();

  // Comissões aguardando liberação deste corretor.
  const { data: vendasData, error: vErr } = await supabase
    .from("vendas")
    .select("id, liquido_corretor, data_venda")
    .eq("corretor_id", corretorId)
    .eq("status_pagamento_corretor", "aguardando_liberacao");
  if (vErr) return { error: vErr.message };
  const vendas = (vendasData ?? []) as { id: string; liquido_corretor: number; data_venda: string }[];
  if (vendas.length === 0) {
    return { error: "Nenhuma comissão aguardando liberação para este corretor." };
  }
  const vendaIds = vendas.map((v) => v.id);

  // Adiantamentos ainda não vinculados, das vendas que serão pagas.
  const { data: adiData, error: aErr } = await supabase
    .from("adiantamentos")
    .select("id, valor")
    .in("venda_id", vendaIds)
    .is("pagamento_id", null);
  if (aErr) return { error: aErr.message };
  const adiantamentos = (adiData ?? []) as { id: string; valor: number }[];

  const valorBruto = round2(vendas.reduce((s, v) => s + Number(v.liquido_corretor), 0));
  const totalAdiantamentos = round2(
    adiantamentos.reduce((s, a) => s + Number(a.valor), 0),
  );
  const valorLiquido = round2(valorBruto - totalAdiantamentos);
  const hoje = new Date().toISOString().slice(0, 10);

  // 1) Cria o pagamento.
  const { data: pag, error: pErr } = await supabase
    .from("pagamentos_corretor")
    .insert({
      corretor_id: corretorId,
      data: hoje,
      valor_bruto: valorBruto,
      total_bonificacoes: 0,
      total_adiantamentos: totalAdiantamentos,
      valor_liquido: valorLiquido,
      status: "pago",
    })
    .select("id")
    .single();
  if (pErr || !pag) return { error: pErr?.message ?? "Falha ao criar o pagamento." };

  // 2) Marca as vendas como pagas e vincula ao pagamento.
  const { error: uvErr } = await supabase
    .from("vendas")
    .update({ status_pagamento_corretor: "pago", pagamento_id: pag.id })
    .in("id", vendaIds);
  if (uvErr) return { error: uvErr.message };

  // 3) Vincula os adiantamentos descontados ao pagamento (para o recibo).
  if (adiantamentos.length > 0) {
    const { error: uaErr } = await supabase
      .from("adiantamentos")
      .update({ pagamento_id: pag.id })
      .in(
        "id",
        adiantamentos.map((a) => a.id),
      );
    if (uaErr) return { error: uaErr.message };
  }

  revalidar();
  return { pagamentoId: pag.id };
}

const estornarSchema = z.object({ pagamentoId: z.string().uuid() });

/**
 * Estorna um pagamento: devolve as comissões para "aguardando liberação",
 * desvincula comissões e adiantamentos, e remove o registro do pagamento.
 */
export async function estornarPagamento(
  input: z.infer<typeof estornarSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = estornarSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { pagamentoId } = parsed.data;

  const supabase = await createClient();

  const { error: uvErr } = await supabase
    .from("vendas")
    .update({ status_pagamento_corretor: "aguardando_liberacao", pagamento_id: null })
    .eq("pagamento_id", pagamentoId);
  if (uvErr) return { error: uvErr.message };

  const { error: uaErr } = await supabase
    .from("adiantamentos")
    .update({ pagamento_id: null })
    .eq("pagamento_id", pagamentoId);
  if (uaErr) return { error: uaErr.message };

  const { error: dErr } = await supabase
    .from("pagamentos_corretor")
    .delete()
    .eq("id", pagamentoId);
  if (dErr) return { error: dErr.message };

  revalidar();
  return {};
}
