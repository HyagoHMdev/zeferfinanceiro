import { createClient } from "@/lib/supabase/server";
import { ratearPorParcelas, round2, resumoCorretor } from "@/lib/calculos";
import type {
  Adiantamento,
  StatusPagamentoCorretor,
  Venda,
  VendaStatus,
} from "@/lib/types";

export interface ComissaoLinha {
  /** Chave única da linha: a venda, ou a parcela quando o recebimento é parcelado. */
  chave: string;
  vendaId: string;
  corretorNome: string | null;
  empreendimento: string | null;
  /** Unidade (e torre) da venda: "Zaya · 1204" identifica melhor que só o nome. */
  unidade: string | null;
  dataVenda: string;
  liquidoCorretor: number;
  statusVenda: VendaStatus;
  statusPagamento: StatusPagamentoCorretor;
  /**
   * Só em venda parcelada. Resume as parcelas para a lista mostrar UMA linha
   * por venda; o detalhe parcela a parcela fica na tela de processamento.
   */
  parcelas?: { total: number; liberadas: number; pagas: number };
  /** Da comissão, quanto já foi pago ao corretor (parcelas quitadas). */
  liquidoPago: number;
  /** O que falta pagar. Em venda à vista é tudo ou nada. */
  liquidoPendente: number;
  /** Metade da parceria que saiu desta comissão. 0 quando não há parceria. */
  descontoParceria: number;
}

interface ComissaoRow {
  id: string;
  data_venda: string;
  liquido_corretor: number;
  status: VendaStatus;
  status_pagamento_corretor: StatusPagamentoCorretor;
  corretores: { nome: string } | null;
  empreendimentos: { nome: string } | null;
}

/**
 * Lista as comissões de venda. Uma linha por venda, EXCETO quando a
 * construtora libera parcelado: aí é uma linha por parcela, com a fatia da
 * comissão que aquela parcela carrega. Sem isso o corretor via o valor cheio
 * como "a receber" mesmo já tendo recebido parte, e a venda só mudava de
 * status quando a última parcela caísse.
 */
export async function listarComissoesCorretor(
  corretorId?: string,
): Promise<ComissaoLinha[]> {
  const supabase = await createClient();
  let q = supabase
    .from("vendas")
    .select(
      "id, data_venda, unidade, torre, liquido_corretor, desconto_parceiro_valor, status, status_pagamento_corretor, recebimento_parcelado, corretores(nome), empreendimentos(nome)",
    )
    .not("corretor_id", "is", null)
    .order("data_venda", { ascending: false });
  if (corretorId) q = q.eq("corretor_id", corretorId);

  const { data } = await q;
  const rows = (data ?? []) as unknown as (ComissaoRow & {
    recebimento_parcelado: boolean;
    desconto_parceiro_valor: number | null;
    unidade: string | null;
    torre: string | null;
  })[];

  const idsParceladas = rows.filter((v) => v.recebimento_parcelado).map((v) => v.id);
  const porVenda = new Map<
    string,
    { id: string; numero: number; valor: number; recebido: boolean; pago: boolean }[]
  >();
  if (idsParceladas.length > 0) {
    const { data: parc } = await supabase
      .from("venda_parcelas")
      .select("id, venda_id, numero, valor, recebido_em, pagamento_id")
      .in("venda_id", idsParceladas)
      .order("numero");
    for (const p of (parc ?? []) as {
      id: string;
      venda_id: string;
      numero: number;
      valor: number;
      recebido_em: string | null;
      pagamento_id: string | null;
    }[]) {
      const lista = porVenda.get(p.venda_id) ?? [];
      lista.push({
        id: p.id,
        numero: p.numero,
        valor: Number(p.valor),
        recebido: p.recebido_em != null,
        pago: p.pagamento_id != null,
      });
      porVenda.set(p.venda_id, lista);
    }
  }

  const linhas: ComissaoLinha[] = [];
  for (const v of rows) {
    const parcelas = porVenda.get(v.id) ?? [];
    const base = {
      vendaId: v.id,
      corretorNome: v.corretores?.nome ?? null,
      empreendimento: v.empreendimentos?.nome ?? null,
      unidade: [v.torre, v.unidade].filter(Boolean).join(" ") || null,
      dataVenda: v.data_venda,
      statusVenda: v.status,
    };
    const desconto = Number(v.desconto_parceiro_valor ?? 0);
    const total = Number(v.liquido_corretor);

    if (v.recebimento_parcelado && parcelas.length > 0) {
      // A venda parcelada é UMA linha, como qualquer outra: espalhar cinco
      // linhas da mesma venda enchia a lista e escondia quantas vendas o
      // corretor tem. O que muda é o rodapé da linha, que conta as parcelas,
      // e a tela de processamento, onde elas aparecem uma a uma.
      const fatias = ratearPorParcelas(total, parcelas.map((p) => p.valor));
      const pago = parcelas.reduce((s, p, i) => (p.pago ? s + fatias[i] : s), 0);
      linhas.push({
        ...base,
        chave: v.id,
        liquidoCorretor: total,
        liquidoPago: round2(pago),
        liquidoPendente: round2(total - pago),
        descontoParceria: desconto,
        statusPagamento: v.status_pagamento_corretor,
        parcelas: {
          total: parcelas.length,
          liberadas: parcelas.filter((p) => p.recebido).length,
          pagas: parcelas.filter((p) => p.pago).length,
        },
      });
    } else {
      const pago = v.status_pagamento_corretor === "pago" ? total : 0;
      linhas.push({
        ...base,
        chave: v.id,
        liquidoCorretor: total,
        liquidoPago: pago,
        liquidoPendente: round2(total - pago),
        descontoParceria: desconto,
        statusPagamento: v.status_pagamento_corretor,
      });
    }
  }
  return linhas;
}

export interface VendaComNomes extends Venda {
  corretores: { nome: string } | null;
  empreendimentos: { nome: string } | null;
  construtoras: { nome: string } | null;
}

export interface ProcessamentoVenda {
  venda: VendaComNomes;
  adiantamentos: Adiantamento[];
  /** Vales avulsos do corretor (não vinculados a venda, ainda não descontados). */
  adiantamentosDisponiveis: Adiantamento[];
  totalAdiantamentos: number;
  liquidoParaPagamento: number;
  /**
   * O que dá para pagar desta venda AGORA. Em venda à vista é a comissão
   * inteira, quando ainda não foi paga; em parcelada, só as parcelas que a
   * construtora já liberou e que ainda não entraram em nenhum pagamento.
   */
  pagavel: { chaves: string[]; bruto: number };
  /**
   * Recibos dos pagamentos que já quitaram esta venda (ou parcelas dela).
   * Sem isto, o recibo só aparecia no instante do pagamento e depois sumia da
   * tela, justamente quando alguém precisa reimprimir.
   */
  recibos: { id: string; data: string; valor: number; parcelas: number[] }[];
  /** Parcelas da construtora com a fatia da comissao. Vazio em venda a vista. */
  parcelas: {
    id: string;
    numero: number;
    total: number;
    vencimento: string;
    valorParcela: number;
    liquidoCorretor: number;
    recebidoEm: string | null;
    pago: boolean;
  }[];
}

export async function carregarProcessamentoVenda(
  vendaId: string,
): Promise<ProcessamentoVenda | null> {
  const supabase = await createClient();
  const [vRes, aRes, pRes] = await Promise.all([
    supabase
      .from("vendas")
      .select(
        "*, corretores(nome), empreendimentos(nome), construtoras(nome)",
      )
      .eq("id", vendaId)
      .single(),
    supabase
      .from("adiantamentos")
      .select("*")
      .eq("venda_id", vendaId)
      .order("data", { ascending: false }),
    supabase
      .from("venda_parcelas")
      .select("id, numero, vencimento, valor, recebido_em, pagamento_id")
      .eq("venda_id", vendaId)
      .order("numero"),
  ]);

  if (!vRes.data) return null;
  const venda = vRes.data as unknown as VendaComNomes;
  const adiantamentos = (aRes.data ?? []) as Adiantamento[];

  // Vales avulsos do corretor (venda_id nulo, ainda não descontados), para
  // o usuário incluir ou não nesta venda.
  let adiantamentosDisponiveis: Adiantamento[] = [];
  if (venda.corretor_id) {
    const { data } = await supabase
      .from("adiantamentos")
      .select("*")
      .eq("corretor_id", venda.corretor_id)
      .is("venda_id", null)
      .is("pagamento_id", null)
      .order("data", { ascending: false });
    adiantamentosDisponiveis = (data ?? []) as Adiantamento[];
  }

  // Em venda parcelada a comissão não é paga de uma vez: cada parcela
  // liberada pela construtora libera a fatia dela. Sem esta lista, a tela de
  // processamento mostrava só o total e não dizia de onde ele vinha nem o que
  // já tinha sido pago.
  const linhas = (pRes.data ?? []) as {
    id: string;
    numero: number;
    vencimento: string;
    valor: number;
    recebido_em: string | null;
    pagamento_id: string | null;
  }[];
  const fatias = ratearPorParcelas(
    Number(venda.liquido_corretor),
    linhas.map((p) => Number(p.valor)),
  );
  const parcelas = linhas.map((p, i) => ({
    id: p.id,
    numero: p.numero,
    total: linhas.length,
    vencimento: p.vencimento,
    valorParcela: Number(p.valor),
    liquidoCorretor: fatias[i],
    recebidoEm: p.recebido_em,
    pago: p.pagamento_id != null,
  }));

  // As mesmas chaves que a fila de pagamento usa: venda quando à vista,
  // parcela quando parcelada. Assim o botão daqui e a tela de pagamento
  // pagam exatamente a mesma coisa.
  const pagavel = venda.recebimento_parcelado && parcelas.length > 0
    ? {
        chaves: parcelas.filter((p) => p.recebidoEm && !p.pago).map((p) => p.id),
        bruto: round2(
          parcelas
            .filter((p) => p.recebidoEm && !p.pago)
            .reduce((s, p) => s + p.liquidoCorretor, 0),
        ),
      }
    : venda.status_pagamento_corretor === "aguardando_liberacao"
      ? { chaves: [venda.id], bruto: round2(Number(venda.liquido_corretor)) }
      : { chaves: [], bruto: 0 };

  // Um recibo por pagamento envolvido: o da venda inteira, e/ou o das parcelas.
  const idsPagamento = new Map<string, number[]>();
  if (venda.pagamento_id) idsPagamento.set(venda.pagamento_id, []);
  for (const p of parcelas) {
    if (!p.pago) continue;
    const linha = linhas.find((x) => x.id === p.id);
    const pid = linha?.pagamento_id;
    if (!pid) continue;
    idsPagamento.set(pid, [...(idsPagamento.get(pid) ?? []), p.numero]);
  }

  let recibos: ProcessamentoVenda["recibos"] = [];
  if (idsPagamento.size > 0) {
    const { data: pags } = await supabase
      .from("pagamentos_corretor")
      .select("id, data, valor_liquido")
      .in("id", [...idsPagamento.keys()])
      .order("data", { ascending: false });
    recibos = ((pags ?? []) as { id: string; data: string; valor_liquido: number }[]).map((x) => ({
      id: x.id,
      data: x.data,
      valor: Number(x.valor_liquido),
      parcelas: idsPagamento.get(x.id) ?? [],
    }));
  }

  const totalAdiantamentos = round2(
    adiantamentos.reduce((s, a) => s + Number(a.valor), 0),
  );
  const liquidoParaPagamento = resumoCorretor(
    Number(venda.liquido_corretor),
    totalAdiantamentos,
  );

  return {
    venda,
    adiantamentos,
    adiantamentosDisponiveis,
    totalAdiantamentos,
    liquidoParaPagamento,
    parcelas,
    pagavel,
    recibos,
  };
}
