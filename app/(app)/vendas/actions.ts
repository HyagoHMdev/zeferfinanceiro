"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { getConfig } from "@/lib/data/cadastros";
import { calcularVenda, calcularDistribuicao } from "@/lib/calculos";
import { vendaSchema, type VendaInput } from "@/lib/schemas/venda";
import type { Configuracoes, VendaStatus } from "@/lib/types";

type ActionResult = { error?: string };

interface CorretorDefaults {
  corretorPct: number;
  impostoNfPct: number;
  descontoPct: number;
}

/** Percentuais do corretor (comissão / imposto NF) a partir do cadastro + config. */
async function defaultsCorretor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string | null,
  config: Configuracoes,
): Promise<CorretorDefaults> {
  let corretorPct = config.percentual_comissao_corretor_padrao;
  let impostoNfPct = config.percentual_imposto_nf_corretor;
  if (corretorId) {
    const { data } = await supabase
      .from("corretores")
      .select("percentual_comissao_padrao, percentual_imposto_nf")
      .eq("id", corretorId)
      .single();
    corretorPct = data?.percentual_comissao_padrao ?? corretorPct;
    impostoNfPct = data?.percentual_imposto_nf ?? impostoNfPct;
  }
  return { corretorPct, impostoNfPct, descontoPct: 0 };
}

/** Monta a linha completa da venda recalculando toda a cadeia via calcularVenda. */
function montarLinha(input: VendaInput, corr: CorretorDefaults) {
  const possui = input.possui_parceria;
  const percParceria = possui ? input.percentual_parceria : 0;

  const r = calcularVenda({
    vgv: input.vgv,
    percentualComissao: input.percentual_comissao,
    possuiParceria: possui,
    percentualParceria: percParceria,
    percentualImpostoImobiliaria: input.percentual_imposto_imobiliaria,
    percentualCorretor: corr.corretorPct,
    percentualDescontoParceiro: corr.descontoPct,
    percentualImpostoNf: corr.impostoNfPct,
  });

  return {
    data_venda: input.data_venda,
    construtora_id: input.construtora_id,
    empreendimento_id: input.empreendimento_id,
    unidade: input.unidade,
    torre: input.torre,
    cliente: input.cliente,
    cliente_nascimento: input.cliente_nascimento || null,
    cliente_telefone: input.cliente_telefone,
    cliente_cpf: input.cliente_cpf,
    origem: input.origem,
    origem_detalhe: input.origem_detalhe,
    cliente_finalidade: input.cliente_finalidade,
    cliente_profissao: input.cliente_profissao,
    cliente_cidade: input.cliente_cidade,
    cliente_estado: input.cliente_estado,
    cliente_email: input.cliente_email,
    corretor_id: input.corretor_id,
    // Parceria (modelo novo)
    possui_parceria: possui,
    empresa_parceira: possui ? input.empresa_parceira : null,
    percentual_parceria: percParceria,
    valor_parceria: r.valorParceria,
    liquido_pos_parceria: r.liquidoPosParceria,
    parceiro_id: possui ? input.parceiro_id : null,
    // Colunas legadas sincronizadas (compatibilidade)
    percentual_parceiro: percParceria,
    valor_parceiro: r.valorParceria,
    saldo_pos_parceiro: r.liquidoPosParceria,
    // Valores
    vgv: input.vgv,
    percentual_comissao: input.percentual_comissao,
    comissao_bruta: r.comissaoBruta,
    percentual_imposto_imobiliaria: input.percentual_imposto_imobiliaria,
    valor_imposto: r.valorImposto,
    liquido_zefer: r.liquidoZefer,
    // Corretor (geridos no módulo Corretores; aqui só o snapshot)
    percentual_corretor: corr.corretorPct,
    comissao_corretor_bruto: r.comissaoCorretorBruto,
    percentual_desconto_parceiro: corr.descontoPct,
    percentual_imposto_nf: corr.impostoNfPct,
    valor_imposto_nf: r.valorImpostoNf,
    liquido_corretor: r.liquidoCorretor,
    lucro_liquido: r.lucroLiquido,
    observacoes: input.observacoes,
    contrato_path: input.contrato_path ?? null,
    documentos: input.documentos ?? [],
  };
}

/**
 * Diz QUAL campo reprovou, em vez de "Dados inválidos". Sem isto, um campo
 * recusado vira um erro genérico e não há como saber onde está o problema.
 */
function erroDeValidacao(erro: z.ZodError): string {
  const p = erro.issues[0]
  if (!p) return "Dados inválidos. Revise o formulário."
  const campo = p.path.join(".") || "formulário"
  return `Campo "${campo}": ${p.message}`
}

/**
 * Grava quais investidores participam da venda. Usa o cliente admin porque
 * public.investidor_vendas é fechada por RLS; quem chama já passou pelo
 * requireRole. O repasse na despesa variável não é criado aqui: um gatilho no
 * banco cuida disso, então o valor acompanha a venda em qualquer alteração.
 */
async function sincronizarInvestidores(vendaId: string, ids: string[]) {
  const pub = createAdminClient().schema("public");

  let del = pub.from("investidor_vendas").delete().eq("venda_id", vendaId);
  // Sem ids, remove todos; com ids, remove só quem foi desmarcado.
  if (ids.length > 0) del = del.not("investidor_id", "in", `(${ids.join(",")})`);
  await del;

  if (ids.length > 0) {
    await pub.from("investidor_vendas").upsert(
      ids.map((investidor_id) => ({ investidor_id, venda_id: vendaId })),
      { onConflict: "investidor_id,venda_id", ignoreDuplicates: true },
    );
  }
}

function revalidar(id?: string) {
  revalidatePath("/vendas");
  if (id) revalidatePath(`/vendas/${id}`);
  revalidatePath("/corretores", "layout");
  revalidatePath("/dashboard");
}

/**
 * `checklistId` chega quando a venda nasceu de uma submissão do corretor.
 * O fechamento do checklist acontece AQUI dentro, e não na tela, porque esta
 * action termina em redirect: quem chama nunca recebe o retorno para fazer o
 * segundo passo.
 */
export async function criarVenda(
  input: VendaInput,
  checklistId?: string,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = vendaSchema.safeParse(input);
  if (!parsed.success) return { error: erroDeValidacao(parsed.error) };

  // Documentação conferida ANTES de gravar: se a venda nascesse primeiro e o
  // aceite fosse barrado depois, sobraria venda criada com a submissão ainda
  // na fila, e a próxima tentativa criaria uma segunda venda do mesmo negócio.
  if (checklistId) {
    const falta = await documentacaoFaltante(checklistId);
    if (falta) return { error: falta };
  }

  const supabase = await createClient();
  const config = await getConfig();
  const corr = await defaultsCorretor(supabase, parsed.data.corretor_id, config);

  const row = montarLinha(parsed.data, corr);
  const { data: nova, error } = await supabase
    .from("vendas")
    .insert(row)
    .select("id")
    .single();
  if (error || !nova) return { error: error?.message ?? "Falha ao salvar a venda." };

  // A venda NÃO gera mais entrada: o lançamento em Entradas é manual.
  // (O gatilho que fazia isso foi removido; a função ficou no banco, desligada,
  // caso um dia se queira religar.)
  //
  // A marcação de "recebido" segue aqui, como sempre foi.
  if (Number(row.lucro_liquido) > 0) {
    await supabase.from("vendas").update({ status: "recebido" }).eq("id", nova.id);
  }

  await sincronizarInvestidores(nova.id, parsed.data.investidores ?? []);

  // Aprovar é criar a venda. Se este passo falhar, a venda existe e a submissão
  // continua pendente: reaparece na fila em vez de sumir, que é o erro seguro.
  if (checklistId) await aprovarChecklist(checklistId, nova.id);

  revalidar();
  redirect("/vendas");
}

export async function atualizarVenda(
  id: string,
  input: VendaInput,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const parsed = vendaSchema.safeParse(input);
  if (!parsed.success) return { error: erroDeValidacao(parsed.error) };

  const supabase = await createClient();
  const config = await getConfig();

  // Preserva os percentuais do corretor definidos no módulo Corretores, a menos
  // que o corretor tenha sido trocado.
  const { data: atual } = await supabase
    .from("vendas")
    .select(
      "corretor_id, percentual_corretor, percentual_imposto_nf, percentual_desconto_parceiro",
    )
    .eq("id", id)
    .single();

  let corr: CorretorDefaults;
  if (atual && atual.corretor_id === parsed.data.corretor_id) {
    corr = {
      corretorPct: Number(atual.percentual_corretor),
      impostoNfPct: Number(atual.percentual_imposto_nf),
      descontoPct: Number(atual.percentual_desconto_parceiro),
    };
  } else {
    corr = await defaultsCorretor(supabase, parsed.data.corretor_id, config);
  }

  const { error } = await supabase
    .from("vendas")
    .update(montarLinha(parsed.data, corr))
    .eq("id", id);
  if (error) return { error: error.message };

  await sincronizarInvestidores(id, parsed.data.investidores ?? []);

  revalidar(id);
  redirect("/vendas");
}

export async function alterarStatusVenda(
  id: string,
  status: VendaStatus,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("vendas").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidar(id);
  return {};
}

export async function excluirVenda(id: string): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("vendas").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  redirect("/vendas");
}

/**
 * Gera uma URL assinada para ver um arquivo da venda: o contrato ou um
 * documento do cliente.
 *
 * O bucket é privado, então não existe link fixo: cada visualização pede um
 * link com validade curta. É o que impede o arquivo de circular por URL solta
 * depois que alguém abriu uma vez.
 */
export async function abrirArquivoVenda(
  path: string,
): Promise<{ erro?: string; url?: string }> {
  await requireRole(ADMIN_FIN_ROLES);
  if (!path.trim()) return { erro: "Arquivo sem caminho." };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("contratos")
    .createSignedUrl(path, 300); // 5 minutos: tempo de abrir, não de compartilhar
  if (error || !data?.signedUrl) {
    return { erro: error?.message ?? "Não foi possível gerar o link." };
  }
  return { url: data.signedUrl };
}

/**
 * Devolve a mensagem do que falta anexar, ou null se a papelada está completa.
 *
 * O corretor agora envia a venda assim que ela fecha e junta contrato e
 * comprovante conforme chegam, então a exigência mora aqui, no aceite. Sem
 * isto ela teria simplesmente deixado de existir quando o envio foi liberado.
 */
async function documentacaoFaltante(checklistId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .schema("public")
    .from("vendas_checklist")
    .select("doc_contrato, doc_pagamento")
    .eq("id", checklistId)
    .maybeSingle<{ doc_contrato: unknown[] | null; doc_pagamento: unknown[] | null }>();
  if (!data) return "Submissão não encontrada.";

  const falta = [
    (data.doc_contrato ?? []).length === 0 && "o contrato",
    (data.doc_pagamento ?? []).length === 0 && "o comprovante de pagamento",
  ].filter(Boolean);
  return falta.length
    ? `Não dá para aprovar: falta ${falta.join(" e ")}. Peça ao corretor para anexar.`
    : null;
}

/**
 * Marca a submissão do corretor como aprovada e a liga à venda criada.
 *
 * Chamada depois que a venda foi gravada: aprovar é criar a venda, não mudar
 * um status solto. Se falhar aqui, a venda existe e a submissão fica pendente,
 * o que é o erro seguro (aparece de novo na fila em vez de sumir).
 */
export async function aprovarChecklist(
  checklistId: string,
  vendaId: string,
): Promise<ActionResult> {
  const sessao = await requireRole(ADMIN_FIN_ROLES);
  const pub = createAdminClient().schema("public");

  // Rede de segurança: `criarVenda` já barrou antes de gravar, mas esta action
  // é exportada e pode ser chamada por outro caminho amanhã.
  const falta = await documentacaoFaltante(checklistId);
  if (falta) return { error: falta };

  const { error } = await pub
    .from("vendas_checklist")
    .update({
      status: "aprovada",
      venda_id: vendaId,
      avaliado_por: sessao.profile.id,
      avaliado_em: new Date().toISOString(),
    })
    .eq("id", checklistId)
    .eq("status", "aguardando_aprovacao");
  if (error) return { error: error.message };
  revalidatePath("/vendas");
  return {};
}

/** Recusa a submissão. O motivo volta para o corretor corrigir e reenviar. */
export async function recusarChecklist(
  checklistId: string,
  motivo: string,
): Promise<ActionResult> {
  const sessao = await requireRole(ADMIN_FIN_ROLES);
  if (!motivo.trim()) return { error: "Diga o motivo: sem ele o corretor não sabe o que corrigir." };

  const pub = createAdminClient().schema("public");
  const { error } = await pub
    .from("vendas_checklist")
    .update({
      status: "recusada",
      motivo_recusa: motivo.trim().slice(0, 500),
      avaliado_por: sessao.profile.id,
      avaliado_em: new Date().toISOString(),
    })
    .eq("id", checklistId)
    .eq("status", "aguardando_aprovacao");
  if (error) return { error: error.message };
  revalidatePath("/vendas");
  return {};
}

/** URL assinada para o financeiro abrir um anexo do checklist. */
export async function abrirAnexoChecklist(
  path: string,
): Promise<{ erro?: string; url?: string }> {
  await requireRole(ADMIN_FIN_ROLES);
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("contratos").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return { erro: error?.message ?? "Falha ao gerar o link." };
  return { url: data.signedUrl };
}
