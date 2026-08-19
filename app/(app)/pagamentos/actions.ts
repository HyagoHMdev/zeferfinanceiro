"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { round2 } from "@/lib/calculos";
import { listarPagamentosPendentes } from "@/lib/data/pagamentos";

type ActionResult = { error?: string; pagamentoId?: string };

function revalidar() {
  revalidatePath("/pagamentos");
  revalidatePath("/corretores", "layout");
  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/meu-extrato");
}

const registrarSchema = z.object({
  corretorId: z.string().uuid(),
  // Comissões a pagar, pela CHAVE da linha: id da venda quando à vista, id da
  // parcela quando a construtora libera parcelado. Ausente = todas as pendentes.
  chaves: z.array(z.string().uuid()).optional(),
  // Adiantamentos a descontar. Ausente = descontar todos os elegíveis.
  adiantamentoIds: z.array(z.string().uuid()).optional(),
});

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

  // Fonte única do que está liberado: a MESMA função que monta a tela. Em
  // venda parcelada, cada linha é uma parcela já recebida da construtora, com
  // a fatia da comissão dela. Nada do que veio do cliente vira dinheiro sem
  // passar por aqui.
  const pendentes = await listarPagamentosPendentes();
  const doCorretor = pendentes.find((c) => c.corretorId === corretorId);
  if (!doCorretor || doCorretor.comissoes.length === 0) {
    return { error: "Nenhuma comissão aguardando liberação para este corretor." };
  }
  const comissoes = parsed.data.chaves
    ? doCorretor.comissoes.filter((c) => parsed.data.chaves!.includes(c.chave))
    : doCorretor.comissoes;
  if (comissoes.length === 0) {
    return { error: "Selecione ao menos uma comissão válida para pagar." };
  }
  const parcelaIds = comissoes.map((c) => c.parcelaId).filter((id): id is string => !!id);
  // Venda entra como "paga" só quando não sobra parcela dela para pagar depois.
  const vendaIds = [
    ...new Set(
      comissoes
        .filter((c) => !c.parcelaId)
        .map((c) => c.vendaId),
    ),
  ];
  const vendasParciais = [...new Set(comissoes.filter((c) => c.parcelaId).map((c) => c.vendaId))];

  // Adiantamentos ainda não vinculados a descontar: os das vendas que serão
  // pagas (por venda_id) + os vales avulsos do corretor (venda_id nulo).
  const [adiVendaRes, adiAvulsoRes] = await Promise.all([
    supabase
      .from("adiantamentos")
      .select("id, valor")
      .in("venda_id", [...vendaIds, ...vendasParciais])
      .is("pagamento_id", null),
    supabase
      .from("adiantamentos")
      .select("id, valor")
      .eq("corretor_id", corretorId)
      .is("venda_id", null)
      .is("pagamento_id", null),
  ]);
  if (adiVendaRes.error) return { error: adiVendaRes.error.message };
  if (adiAvulsoRes.error) return { error: adiAvulsoRes.error.message };
  let adiantamentos = [
    ...((adiVendaRes.data ?? []) as { id: string; valor: number }[]),
    ...((adiAvulsoRes.data ?? []) as { id: string; valor: number }[]),
  ];
  // Descontar só os adiantamentos escolhidos (validados contra os elegíveis).
  if (parsed.data.adiantamentoIds) {
    const escolhidos = new Set(parsed.data.adiantamentoIds);
    adiantamentos = adiantamentos.filter((a) => escolhidos.has(a.id));
  }

  const valorBruto = round2(comissoes.reduce((s, c) => s + c.liquidoCorretor, 0));
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

  // 2) Marca as vendas quitadas e vincula ao pagamento.
  if (vendaIds.length > 0) {
    const { error: uvErr } = await supabase
      .from("vendas")
      .update({ status_pagamento_corretor: "pago", pagamento_id: pag.id })
      .in("id", vendaIds);
    if (uvErr) return { error: uvErr.message };
  }

  // 2b) Parcelas pagas nesta rodada. A venda parcelada só vira "pago" quando a
  // última cair; até lá ela continua aguardando liberação, com as parcelas que
  // faltam aparecendo na fila conforme a construtora libera.
  if (parcelaIds.length > 0) {
    const { error: upErr } = await supabase
      .from("venda_parcelas")
      .update({ pagamento_id: pag.id })
      .in("id", parcelaIds);
    if (upErr) return { error: upErr.message };

    for (const vendaId of vendasParciais) {
      const { count } = await supabase
        .from("venda_parcelas")
        .select("id", { count: "exact", head: true })
        .eq("venda_id", vendaId)
        .is("pagamento_id", null);
      if ((count ?? 0) === 0) {
        const { error } = await supabase
          .from("vendas")
          .update({ status_pagamento_corretor: "pago", pagamento_id: pag.id })
          .eq("id", vendaId);
        if (error) return { error: error.message };
      }
    }
  }

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

  // Nome do corretor (para as descrições dos lançamentos/entradas abaixo).
  const { data: nomeRow } = await supabase
    .from("corretores")
    .select("nome")
    .eq("id", corretorId)
    .maybeSingle();
  const nomeCorretor = (nomeRow as { nome?: string } | null)?.nome ?? "corretor";

  // 4) Reconciliação: os adiantamentos descontados voltam ao CAIXA como entrada
  // (100% empresa). O adiantamento saiu como despesa variável quando foi dado;
  // ao pagar a comissão (que já desconta o adiantamento), esse valor retorna.
  // Junto com a saída do passo 5, o efeito líquido no caixa da data é o valor
  // realmente desembolsado. Ligada ao pagamento -> some junto no estorno (cascade).
  if (totalAdiantamentos > 0) {
    const { data: ent, error: eErr } = await supabase
      .from("entradas")
      .insert({
        data: hoje,
        tipo: "outras",
        descricao: `Reconciliação de adiantamentos, pagamento de ${nomeCorretor}`,
        valor: totalAdiantamentos,
        percentual_dizimo: 0,
        valor_dizimo: 0,
        liquido: totalAdiantamentos,
        venda_id: null,
        pagamento_id: pag.id,
      })
      .select("id")
      .single();
    if (eErr || !ent) return { error: eErr?.message ?? "Falha ao reconciliar os adiantamentos." };
    const { error: dErr } = await supabase.from("distribuicoes").insert({
      entrada_id: ent.id,
      destino: "empresa",
      percentual: 1,
      valor: totalAdiantamentos,
    });
    if (dErr) return { error: dErr.message };
  }

  // Obs.: o pagamento da comissão NÃO gera saída no caixa. A entrada da venda
  // já entra pelo LUCRO líquido (pós corretor), então o corretor já saiu ali;
  // debitar aqui de novo contaria o corretor duas vezes.
  revalidar();
  return { pagamentoId: pag.id };
}

const funcionarioSchema = z.object({
  corretorId: z.string().uuid(),
  // Quanto é o pagamento (salário, pró-labore, freela). Funcionário não tem
  // comissão de venda, então o valor não pode ser deduzido: é informado.
  valorBruto: z.number().positive('Informe o valor do pagamento.'),
  adiantamentoIds: z.array(z.string().uuid()).optional(),
  // Contas a pagar que este pagamento quita (o salário do mês, tipicamente).
  lancamentoIds: z.array(z.string().uuid()).optional(),
  observacoes: z.string().trim().max(300).nullable().optional(),
})

/**
 * Pagamento de FUNCIONÁRIO (não corretor): informa o valor, desconta os
 * adiantamentos e gera o recibo.
 *
 * O caixa se comporta diferente do corretor, e é de propósito:
 *  - Corretor: a comissão NÃO debita o caixa, porque a entrada da venda já
 *    entra pelo lucro líquido (pós corretor). Debitar de novo contaria duas vezes.
 *  - Funcionário: o pagamento é desembolso de verdade, então SAI do caixa.
 *
 * Como o adiantamento já saiu quando foi dado, ele volta como entrada de
 * reconciliação. O efeito líquido no caixa é (bruto - adiantamentos), que é o
 * que de fato sai da conta hoje, e as duas pontas ficam visíveis no extrato.
 */
export async function registrarPagamentoFuncionario(
  input: z.infer<typeof funcionarioSchema>,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES)
  const parsed = funcionarioSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  const { corretorId, valorBruto } = parsed.data
  const quitarIds = parsed.data.lancamentoIds ?? []

  const supabase = await createClient()

  const { data: pessoa } = await supabase
    .from('corretores')
    .select('nome, tipo')
    .eq('id', corretorId)
    .maybeSingle<{ nome: string; tipo: string }>()
  if (!pessoa) return { error: 'Colaborador não encontrado.' }
  if (pessoa.tipo !== 'funcionario') {
    return { error: 'Este fluxo é para funcionários. Corretor recebe pela comissão da venda.' }
  }

  // Adiantamentos avulsos ainda não descontados (funcionário não tem venda).
  const { data: adiData, error: adiErr } = await supabase
    .from('adiantamentos')
    .select('id, valor')
    .eq('corretor_id', corretorId)
    .is('pagamento_id', null)
  if (adiErr) return { error: adiErr.message }

  let adiantamentos = (adiData ?? []) as { id: string; valor: number }[]
  if (parsed.data.adiantamentoIds) {
    const escolhidos = new Set(parsed.data.adiantamentoIds)
    adiantamentos = adiantamentos.filter((a) => escolhidos.has(a.id))
  }

  const totalAdiantamentos = round2(adiantamentos.reduce((s, a) => s + Number(a.valor), 0))
  const valorLiquido = round2(valorBruto - totalAdiantamentos)
  if (valorLiquido < 0) {
    return {
      error: `Os adiantamentos (${totalAdiantamentos}) passam do valor do pagamento. Desmarque algum ou aumente o valor.`,
    }
  }
  const hoje = new Date().toISOString().slice(0, 10)

  // 1) Pagamento (reaproveita a tabela e, com ela, o recibo já existente).
  const { data: pag, error: pErr } = await supabase
    .from('pagamentos_corretor')
    .insert({
      corretor_id: corretorId,
      data: hoje,
      valor_bruto: valorBruto,
      total_bonificacoes: 0,
      total_adiantamentos: totalAdiantamentos,
      valor_liquido: valorLiquido,
      status: 'pago',
      observacoes: parsed.data.observacoes ?? null,
    })
    .select('id')
    .single()
  if (pErr || !pag) return { error: pErr?.message ?? 'Falha ao criar o pagamento.' }

  // 2) Vincula os adiantamentos (some do "a descontar" e entra no recibo).
  if (adiantamentos.length > 0) {
    const { error: uaErr } = await supabase
      .from('adiantamentos')
      .update({ pagamento_id: pag.id })
      .in(
        'id',
        adiantamentos.map((a) => a.id),
      )
    if (uaErr) return { error: uaErr.message }

    // 3) Os adiantamentos voltam ao caixa (saíram como despesa quando dados).
    const { data: ent, error: eErr } = await supabase
      .from('entradas')
      .insert({
        data: hoje,
        tipo: 'outras',
        descricao: `Reconciliação de adiantamentos, pagamento de ${pessoa.nome}`,
        valor: totalAdiantamentos,
        percentual_dizimo: 0,
        valor_dizimo: 0,
        liquido: totalAdiantamentos,
        venda_id: null,
        pagamento_id: pag.id,
      })
      .select('id')
      .single()
    if (eErr || !ent) return { error: eErr?.message ?? 'Falha ao reconciliar os adiantamentos.' }
    const { error: dErr } = await supabase.from('distribuicoes').insert({
      entrada_id: ent.id,
      destino: 'empresa',
      percentual: 1,
      valor: totalAdiantamentos,
    })
    if (dErr) return { error: dErr.message }
  }

  // 4) O pagamento sai do caixa pelo BRUTO. Com a entrada do passo 3, o líquido
  // do dia fecha no que realmente saiu da conta.
  //
  // Esse bruto pode já estar previsto em contas a pagar (o salário do mês).
  // Nesse caso o certo é QUITAR aquele lançamento, não criar outro: criar um
  // novo contava a despesa duas vezes e deixava a conta pendente para sempre.
  let quitado = 0
  if (quitarIds.length > 0) {
    const { data: contas, error: cErr } = await supabase
      .from('lancamentos')
      .select('id, valor')
      .in('id', quitarIds)
      .eq('colaborador_id', corretorId)
      .neq('status', 'pago')
    if (cErr) return { error: cErr.message }

    const validos = (contas ?? []) as { id: string; valor: number }[]
    quitado = round2(validos.reduce((s, c) => s + Number(c.valor), 0))
    if (quitado > valorBruto) {
      return {
        error:
          'As contas selecionadas somam mais que o valor do pagamento. Desmarque alguma ou aumente o valor.',
      }
    }

    if (validos.length > 0) {
      const { error: qErr } = await supabase
        .from('lancamentos')
        .update({ status: 'pago', data_pagamento: hoje, pagamento_id: pag.id })
        .in(
          'id',
          validos.map((c) => c.id),
        )
      if (qErr) return { error: qErr.message }
    }
  }

  // Só o que sobrou do bruto vira lançamento novo. Se o pagamento cobriu
  // exatamente as contas quitadas, nada é criado e o caixa continua batendo.
  const resto = round2(valorBruto - quitado)
  if (resto > 0) {
    const { data: cat } = await supabase
      .from('categorias_financeiras')
      .select('id')
      .eq('nome', 'Pessoal')
      .eq('tipo', 'despesa_variavel')
      .limit(1)
      .maybeSingle<{ id: string }>()

    const { error: lErr } = await supabase.from('lancamentos').insert({
      escopo: 'empresa',
      natureza: 'despesa_variavel',
      categoria_id: cat?.id ?? null,
      colaborador_id: corretorId,
      descricao: `Pagamento de ${pessoa.nome}`,
      valor: resto,
      competencia: `${hoje.slice(0, 7)}-01`,
      data_vencimento: hoje,
      data_pagamento: hoje,
      status: 'pago',
      pagamento_id: pag.id,
      criado_pelo_pagamento: true,
    })
    if (lErr) return { error: lErr.message }
  }

  revalidar()
  revalidatePath('/financeiro', 'layout')
  revalidatePath('/adiantamentos')
  return { pagamentoId: pag.id }
}

/** Salva (ou remove) o arquivo do recibo assinado de um pagamento. */
export async function salvarReciboPagamento(
  id: string,
  url: string | null,
): Promise<ActionResult> {
  await requireRole(ADMIN_FIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_corretor")
    .update({ recibo_url: url })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidar();
  return {};
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

  // Captura os vínculos ANTES de mexer: apagar o pagamento zera
  // vendas.pagamento_id e adiantamentos.pagamento_id por cascata (ON DELETE SET
  // NULL). Se apagássemos antes de reverter, não haveria mais como achar as
  // vendas e elas ficariam presas em "pago", fora da lista de a pagar (e os
  // adiantamentos delas somem junto).
  const [vLig, aLig, pLig] = await Promise.all([
    supabase.from("vendas").select("id").eq("pagamento_id", pagamentoId),
    supabase.from("adiantamentos").select("id").eq("pagamento_id", pagamentoId),
    supabase.from("venda_parcelas").select("id").eq("pagamento_id", pagamentoId),
  ]);
  if (vLig.error) return { error: vLig.error.message };
  if (aLig.error) return { error: aLig.error.message };
  const vendaIds = (vLig.data ?? []).map((v) => (v as { id: string }).id);
  const adiIds = (aLig.data ?? []).map((a) => (a as { id: string }).id);
  if (pLig.error) return { error: pLig.error.message };
  const parcelaIds = (pLig.data ?? []).map((p) => (p as { id: string }).id);

  // 1) Reverte as comissões para "aguardando liberação". Confere o número de
  //    linhas: se não voltarem todas (ex.: permissão), ABORTA antes de apagar o
  //    pagamento — assim nunca se cria venda órfã.
  if (vendaIds.length > 0) {
    const { error, count } = await supabase
      .from("vendas")
      .update(
        { status_pagamento_corretor: "aguardando_liberacao", pagamento_id: null },
        { count: "exact" },
      )
      .in("id", vendaIds);
    if (error) return { error: error.message };
    if ((count ?? 0) < vendaIds.length) {
      return { error: "Não foi possível reverter todas as comissões. Nada foi estornado." };
    }
  }

  // 1b) Desvincula as parcelas: voltam a ser comissão a pagar.
  if (parcelaIds.length > 0) {
    const { error } = await supabase
      .from("venda_parcelas")
      .update({ pagamento_id: null })
      .in("id", parcelaIds);
    if (error) return { error: error.message };
  }

  // 2) Desvincula os adiantamentos (continuam existindo, voltam a ser descontáveis).
  if (adiIds.length > 0) {
    const { error: uaErr } = await supabase
      .from("adiantamentos")
      .update({ pagamento_id: null })
      .in("id", adiIds);
    if (uaErr) return { error: uaErr.message };
  }

  // 3) Devolve para "pendente" as contas a pagar que este pagamento apenas
  //    quitou. Elas existiam antes e precisam continuar existindo depois; sem
  //    isto o cascade do passo 4 apagaria o salário do mês junto.
  const { error: qErr } = await supabase
    .from("lancamentos")
    .update({ status: "pendente", data_pagamento: null, pagamento_id: null })
    .eq("pagamento_id", pagamentoId)
    .eq("criado_pelo_pagamento", false);
  if (qErr) return { error: qErr.message };

  // 4) Só agora apaga o pagamento. A cascata leva a entrada de reconciliação e
  //    os lançamentos que o próprio pagamento criou.
  const { error: dErr } = await supabase
    .from("pagamentos_corretor")
    .delete()
    .eq("id", pagamentoId);
  if (dErr) return { error: dErr.message };

  revalidar();
  return {};
}
