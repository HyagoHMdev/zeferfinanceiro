"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { calcularVenda } from "@/lib/calculos";
import { criarLancamentoEspelho } from "@/lib/adiantamento-despesa";
import type { StatusPagamentoCorretor } from "@/lib/types";

type ActionResult = { error?: string };

function revalidar(vendaId?: string) {
  revalidatePath("/corretores", "layout");
  if (vendaId) revalidatePath(`/corretores/${vendaId}`);
  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/meu-extrato");
}

const corretorVendaSchema = z.object({
  percentual_corretor: z.number().min(0).max(1),
  /** Desconto de parceria em reais (o percentual vira só espelho legado). */
  desconto_parceiro_valor: z.number().nonnegative(),
  percentual_imposto_nf: z.number().min(0).max(1),
});

/**
 * Salva os percentuais do corretor de uma venda e recalcula a cadeia do corretor
 * (fonte única: calcularVenda). Atualiza o snapshot na própria venda.
 */
export async function salvarCorretorVenda(
  vendaId: string,
  input: z.infer<typeof corretorVendaSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = corretorVendaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: v } = await supabase
    .from("vendas")
    .select(
      "vgv, percentual_comissao, possui_parceria, percentual_parceria, percentual_imposto_imobiliaria",
    )
    .eq("id", vendaId)
    .single();
  if (!v) return { error: "Venda não encontrada." };

  const r = calcularVenda({
    vgv: Number(v.vgv),
    percentualComissao: Number(v.percentual_comissao),
    possuiParceria: v.possui_parceria,
    percentualParceria: Number(v.percentual_parceria),
    percentualImpostoImobiliaria: Number(v.percentual_imposto_imobiliaria),
    percentualCorretor: parsed.data.percentual_corretor,
    descontoParceiroValor: parsed.data.desconto_parceiro_valor,
    percentualImpostoNf: parsed.data.percentual_imposto_nf,
  });

  // Mantém o percentual legado em sincronia com o valor, para relatório antigo
  // que ainda lê a coluna não passar a mentir.
  const pctEquivalente =
    r.comissaoCorretorBruto > 0 ? r.descontoCorretor / r.comissaoCorretorBruto : 0;

  const { error } = await supabase
    .from("vendas")
    .update({
      percentual_corretor: parsed.data.percentual_corretor,
      desconto_parceiro_valor: r.descontoCorretor,
      percentual_desconto_parceiro: pctEquivalente,
      percentual_imposto_nf: parsed.data.percentual_imposto_nf,
      comissao_corretor_bruto: r.comissaoCorretorBruto,
      valor_imposto_nf: r.valorImpostoNf,
      liquido_corretor: r.liquidoCorretor,
      lucro_liquido: r.lucroLiquido,
    })
    .eq("id", vendaId);
  if (error) return { error: error.message };

  revalidar(vendaId);
  return {};
}

export async function alterarStatusPagamentoCorretor(
  vendaId: string,
  status: StatusPagamentoCorretor,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("vendas")
    .update({ status_pagamento_corretor: status })
    .eq("id", vendaId);
  if (error) return { error: error.message };

  revalidar(vendaId);
  return {};
}

const adiantamentoSchema = z.object({
  corretor_id: z.string().uuid(),
  venda_id: z.string().uuid(),
  data: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().trim().max(200).nullable(),
  observacoes: z.string().trim().max(500).nullable(),
});

export async function registrarAdiantamento(
  input: z.infer<typeof adiantamentoSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = adiantamentoSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();

  // Espelha como despesa variável da empresa (atômico: lançamento primeiro,
  // adiantamento já vinculado; compensa se o adiantamento falhar).
  const espelho = await criarLancamentoEspelho(supabase, parsed.data);
  if (espelho.error) return { error: espelho.error };

  const { error } = await supabase
    .from("adiantamentos")
    .insert({ ...parsed.data, lancamento_id: espelho.id });
  if (error) {
    await supabase.from("lancamentos").delete().eq("id", espelho.id!);
    return { error: error.message };
  }

  revalidar(parsed.data.venda_id);
  revalidatePath("/financeiro", "layout");
  return {};
}

export async function excluirAdiantamento(
  id: string,
  vendaId: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();

  // Adiantamento já descontado faz parte de um pagamento fechado: o total e o
  // recibo daquele pagamento foram calculados com ele. Apagar aqui deixaria o
  // pagamento afirmando um desconto que não existe mais, e nada avisaria.
  // Para desfazer, o caminho é estornar o pagamento, que devolve o vínculo.
  const { data: atual } = await supabase
    .from("adiantamentos")
    .select("pagamento_id")
    .eq("id", id)
    .maybeSingle<{ pagamento_id: string | null }>();
  if (atual?.pagamento_id) {
    return {
      error:
        "Este adiantamento já foi descontado num pagamento. Estorne o pagamento antes de excluí-lo.",
    };
  }

  // O trigger no banco apaga o lançamento-espelho junto.
  const { error } = await supabase.from("adiantamentos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidar(vendaId);
  revalidatePath("/financeiro", "layout");
  return {};
}

/** Inclui um vale avulso nesta venda (passa a descontar da comissão). */
export async function vincularAdiantamento(
  id: string,
  vendaId: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("adiantamentos")
    .update({ venda_id: vendaId })
    .eq("id", id)
    .is("pagamento_id", null);
  if (error) return { error: error.message };

  revalidar(vendaId);
  revalidatePath("/adiantamentos");
  return {};
}

/** Remove o vale desta venda (volta a ser um vale avulso do corretor). */
export async function desvincularAdiantamento(
  id: string,
  vendaId: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("adiantamentos")
    .update({ venda_id: null })
    .eq("id", id)
    .is("pagamento_id", null);
  if (error) return { error: error.message };

  revalidar(vendaId);
  revalidatePath("/adiantamentos");
  return {};
}

const parcelaSchema = z.object({
  parcelaId: z.string().uuid(),
  /** null = desmarcar (a construtora não liberou, ou foi marcado por engano). */
  recebidoEm: z.string().min(1).nullable(),
});

/**
 * Marca (ou desmarca) que a construtora liberou uma parcela.
 *
 * É o que "processar a parcela" significa: enquanto ela não caiu, a fatia da
 * comissão não entra na fila de pagamento do corretor. Antes disto, só dava
 * para mexer nisso reabrindo o formulário da venda inteira.
 *
 * Parcela já paga ao corretor não se mexe: desfazer aqui deixaria um pagamento
 * apontando para uma parcela que voltou a não existir. Para isso existe o
 * estorno do pagamento.
 */
export async function marcarParcelaRecebida(
  input: z.infer<typeof parcelaSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = parcelaSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("venda_parcelas")
    .select("venda_id, pagamento_id")
    .eq("id", parsed.data.parcelaId)
    .maybeSingle<{ venda_id: string; pagamento_id: string | null }>();
  if (!atual) return { error: "Parcela não encontrada." };
  if (atual.pagamento_id) {
    return { error: "Esta parcela já foi paga ao corretor. Estorne o pagamento antes." };
  }

  const { error } = await supabase
    .from("venda_parcelas")
    .update({ recebido_em: parsed.data.recebidoEm })
    .eq("id", parsed.data.parcelaId);
  if (error) return { error: error.message };

  // O gatilho no banco cuida do resto: status da venda e datas do repasse do
  // investidor acompanham a parcela.
  revalidar(atual.venda_id);
  revalidatePath("/pagamentos");
  return {};
}
