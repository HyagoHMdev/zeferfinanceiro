import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface DadosEspelho {
  corretor_id: string;
  data: string; // YYYY-MM-DD
  valor: number;
  descricao: string | null;
}

/** Descrição do lançamento espelho: "Adiantamento — {corretor} (rótulo)". */
function descricaoEspelho(corretorNome: string, descricao: string | null): string {
  const rotulo = descricao?.trim();
  const extra =
    rotulo && rotulo.toLowerCase() !== "adiantamento" ? ` (${rotulo})` : "";
  return `Adiantamento — ${corretorNome}${extra}`;
}

/** Campos do lançamento derivados do adiantamento (o espelho é uma despesa paga). */
async function camposEspelho(supabase: Supabase, a: DadosEspelho) {
  const [corretorRes, categoriaRes] = await Promise.all([
    supabase.from("corretores").select("nome").eq("id", a.corretor_id).single(),
    supabase
      .from("categorias_financeiras")
      .select("id")
      .eq("nome", "Adiantamentos")
      .eq("tipo", "despesa_variavel")
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    descricao: descricaoEspelho(corretorRes.data?.nome ?? "corretor", a.descricao),
    categoria_id: categoriaRes.data?.id ?? null,
    valor: a.valor,
    competencia: `${a.data.slice(0, 7)}-01`,
    data_vencimento: a.data,
    data_pagamento: a.data,
    status: "pago" as const,
  };
}

/**
 * Cria o lançamento-espelho (despesa variável paga da empresa) e devolve o id,
 * para ser gravado em adiantamentos.lancamento_id. Não grava o vínculo aqui —
 * o chamador insere o adiantamento já com lancamento_id, mantendo tudo atômico
 * (se o adiantamento falhar, o chamador apaga este lançamento).
 */
export async function criarLancamentoEspelho(
  supabase: Supabase,
  a: DadosEspelho,
): Promise<{ id?: string; error?: string }> {
  const campos = await camposEspelho(supabase, a);
  const { data: lanc, error } = await supabase
    .from("lancamentos")
    .insert({ escopo: "empresa", natureza: "despesa_variavel", ...campos })
    .select("id")
    .single();
  if (error || !lanc)
    return { error: error?.message ?? "Falha ao criar a despesa do adiantamento." };
  return { id: lanc.id };
}

/**
 * Mantém o espelho em dia após editar o adiantamento. Se o vínculo não existir
 * (adiantamento antigo, ou espelho apagado manualmente no Financeiro), recria e
 * revincula.
 */
export async function sincronizarDespesaDoAdiantamento(
  supabase: Supabase,
  a: DadosEspelho & { id: string; lancamento_id: string | null },
): Promise<{ error?: string }> {
  if (a.lancamento_id) {
    const campos = await camposEspelho(supabase, a);
    const { data, error } = await supabase
      .from("lancamentos")
      .update(campos)
      .eq("id", a.lancamento_id)
      .select("id");
    if (error) return { error: error.message };
    if (data && data.length > 0) return {}; // atualizado com sucesso
    // Espelho não existe mais: cai para recriar abaixo.
  }

  const espelho = await criarLancamentoEspelho(supabase, a);
  if (espelho.error) return { error: espelho.error };
  const { error: linkErr } = await supabase
    .from("adiantamentos")
    .update({ lancamento_id: espelho.id })
    .eq("id", a.id);
  if (linkErr) return { error: linkErr.message };
  return {};
}
