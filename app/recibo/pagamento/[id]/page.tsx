import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL, formatData } from "@/lib/format";
import { ratearPorParcelas } from "@/lib/calculos";
import { PrintButton } from "@/components/recibo/print-button";
import { WhatsappButton } from "@/components/recibo/whatsapp-button";
import { AssinaturaRecibo } from "@/components/recibo/assinatura-recibo";

interface PagamentoRecibo {
  id: string;
  corretor_id: string;
  data: string;
  valor_bruto: number;
  total_bonificacoes: number;
  total_adiantamentos: number;
  valor_liquido: number;
  observacoes: string | null;
  /** Texto próprio do recibo; quando preenchido, substitui o parágrafo padrão. */
  descricao_recibo: string | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  corretores: { nome: string; telefone: string | null } | null;
}

export default async function ReciboPagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Público (link do WhatsApp): cliente admin busca só este recibo pelo UUID.
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("pagamentos_corretor")
    .select("*, corretores(nome, telefone)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const pagamento = data as unknown as PagamentoRecibo;

  const [vendasRes, parcelasRes, adiRes, bonRes] = await Promise.all([
    supabase
      .from("vendas")
      .select(
        "id, cliente, liquido_corretor, comissao_corretor_bruto, valor_imposto_nf, desconto_parceiro_valor, possui_parceria, empreendimentos(nome)",
      )
      .eq("pagamento_id", id),
    // Pagamento de venda parcelada não marca a VENDA como paga (ela só fecha na
    // última parcela), então sem isto o recibo saía sem dizer de que venda era.
    supabase
      .from("venda_parcelas")
      .select(
        "id, numero, valor, venda_id, vendas(cliente, liquido_corretor, comissao_corretor_bruto, valor_imposto_nf, desconto_parceiro_valor, empreendimentos(nome))",
      )
      .eq("pagamento_id", id)
      .order("numero"),
    supabase.from("adiantamentos").select("id, data, descricao, valor").eq("pagamento_id", id),
    supabase.from("bonificacoes").select("id, data, motivo, valor").eq("pagamento_id", id),
  ]);

  const vendas = (vendasRes.data ?? []) as unknown as {
    id: string;
    cliente: string | null;
    liquido_corretor: number;
    comissao_corretor_bruto: number;
    valor_imposto_nf: number;
    desconto_parceiro_valor: number | null;
    possui_parceria: boolean;
    empreendimentos: { nome: string } | null;
  }[];
  // Cada parcela paga vira uma linha da tabela, com a FATIA dela da comissão:
  // é o mesmo rateio da fila de pagamento (peso da parcela sobre o total).
  type ParcelaRecibo = {
    id: string;
    numero: number;
    valor: number;
    venda_id: string;
    vendas: {
      cliente: string | null;
      liquido_corretor: number;
      comissao_corretor_bruto: number;
      valor_imposto_nf: number;
      desconto_parceiro_valor: number | null;
      empreendimentos: { nome: string } | null;
    } | null;
  };
  const parcelasPagas = (parcelasRes.data ?? []) as unknown as ParcelaRecibo[];

  const linhasParcela = await (async () => {
    if (parcelasPagas.length === 0) return [];
    const vendaIds = [...new Set(parcelasPagas.map((p) => p.venda_id))];
    const { data: todas } = await supabase
      .from("venda_parcelas")
      .select("id, venda_id, valor")
      .in("venda_id", vendaIds)
      .order("numero");
    const porVenda = new Map<string, { id: string; valor: number }[]>();
    for (const p of (todas ?? []) as { id: string; venda_id: string; valor: number }[]) {
      const lista = porVenda.get(p.venda_id) ?? [];
      lista.push({ id: p.id, valor: Number(p.valor) });
      porVenda.set(p.venda_id, lista);
    }

    return parcelasPagas.map((p) => {
      const lista = porVenda.get(p.venda_id) ?? [];
      const total = lista.length;
      const fatia = (base: number) => {
        const valores = lista.map((x) => x.valor);
        const idx = lista.findIndex((x) => x.id === p.id);
        return ratearPorParcelas(base, valores)[idx] ?? 0;
      };
      const v = p.vendas;
      return {
        id: p.id,
        cliente: v?.cliente ?? null,
        empreendimento: v?.empreendimentos?.nome ?? null,
        parcela: `${p.numero}/${total}`,
        comissao_corretor_bruto: fatia(Number(v?.comissao_corretor_bruto ?? 0)),
        desconto_parceiro_valor: fatia(Number(v?.desconto_parceiro_valor ?? 0)),
        valor_imposto_nf: fatia(Number(v?.valor_imposto_nf ?? 0)),
        liquido_corretor: fatia(Number(v?.liquido_corretor ?? 0)),
      };
    });
  })();

  const totalComissaoBruta =
    vendas.reduce((s, v) => s + Number(v.comissao_corretor_bruto), 0) +
    linhasParcela.reduce((s, l) => s + l.comissao_corretor_bruto, 0);
  const totalImposto =
    vendas.reduce((s, v) => s + Number(v.valor_imposto_nf), 0) +
    linhasParcela.reduce((s, l) => s + l.valor_imposto_nf, 0);
  // Sem esta coluna o recibo não fechava: comissão menos imposto não dava o
  // líquido pago, e a diferença (a metade da parceria que sai do corretor)
  // ficava sem explicação nenhuma no papel.
  const totalDescontoParceria =
    vendas.reduce((s, v) => s + Number(v.desconto_parceiro_valor ?? 0), 0) +
    linhasParcela.reduce((s, l) => s + l.desconto_parceiro_valor, 0);
  const temParceria = totalDescontoParceria > 0;
  const adiantamentos = (adiRes.data ?? []) as {
    id: string;
    data: string;
    descricao: string | null;
    valor: number;
  }[];
  const bonificacoes = (bonRes.data ?? []) as {
    id: string;
    data: string;
    motivo: string | null;
    valor: number;
  }[];

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10 print:p-0">
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-end gap-2">
          <WhatsappButton
            corretorNome={pagamento.corretores?.nome ?? ""}
            telefone={pagamento.corretores?.telefone ?? null}
            valor={pagamento.valor_liquido}
          />
          <PrintButton />
        </div>
        <p className="mt-2 text-right text-xs text-muted-foreground">
          Para anexar o recibo em PDF, gere-o com &quot;Imprimir / Salvar PDF&quot;
          e anexe na conversa do WhatsApp.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-8 text-zinc-900 print:border-0 print:p-0">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <div className="text-xl font-bold">Zefer Imóveis</div>
            <div className="text-sm text-zinc-500">Recibo de Pagamento</div>
          </div>
          <div className="text-right text-sm">
            <div>Data: {formatData(pagamento.data)}</div>
            <div className="text-zinc-500">Recibo nº {pagamento.id.slice(0, 8)}</div>
          </div>
        </div>

        {/* Descrição própria substitui o parágrafo inteiro. Existe porque
            alguns pagamentos precisam de redação específica (dias
            trabalhados, valor dividido entre PIX e dinheiro), e forçar isso
            no texto genérico mudaria o recibo de todo mundo por causa de um. */}
        {pagamento.descricao_recibo ? (
          <p className="mb-6 whitespace-pre-line text-sm leading-relaxed">
            {pagamento.descricao_recibo}
          </p>
        ) : (
          <p className="mb-6 text-sm leading-relaxed">
            Recebi da <strong>Zefer Imóveis</strong> a importância de{" "}
            <strong>{formatBRL(pagamento.valor_liquido)}</strong>, referente{" "}
            {/* Sem comissão o texto muda: pagamento de funcionário não tem venda,
                e "referente às comissões" seria falso no documento assinado. */}
            {vendas.length > 0 || linhasParcela.length > 0
            ? "às comissões e valores discriminados abaixo"
              : "aos valores discriminados abaixo"}
            {pagamento.observacoes ? ` (${pagamento.observacoes})` : ""}, dando
            plena e geral quitação.
          </p>
        )}

        <div className="mb-4">
          <div className="text-sm font-semibold">
            {vendas.length > 0 || linhasParcela.length > 0 ? "Corretor" : "Colaborador"}
          </div>
          <div>{pagamento.corretores?.nome ?? "—"}</div>
        </div>


        {vendas.length > 0 || linhasParcela.length > 0 ? (
          <section className="mb-4">
            <div className="mb-1 text-sm font-semibold">Comissões</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-zinc-500">
                  <th className="py-1 text-left font-medium">Venda</th>
                  <th className="py-1 text-right font-medium">Comissão</th>
                  {temParceria ? (
                    <th className="py-1 text-right font-medium">Parceria</th>
                  ) : null}
                  <th className="py-1 text-right font-medium">Imposto</th>
                  <th className="py-1 text-right font-medium">Líquida</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="py-1">
                      {v.empreendimentos?.nome ?? "Venda"}
                      {v.cliente ? ` — ${v.cliente}` : ""}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatBRL(v.comissao_corretor_bruto)}
                    </td>
                    {temParceria ? (
                      <td className="py-1 text-right tabular-nums text-zinc-500">
                        {Number(v.desconto_parceiro_valor ?? 0) > 0
                          ? `- ${formatBRL(Number(v.desconto_parceiro_valor))}`
                          : "—"}
                      </td>
                    ) : null}
                    <td className="py-1 text-right tabular-nums text-zinc-500">
                      - {formatBRL(v.valor_imposto_nf)}
                    </td>
                    <td className="py-1 text-right font-medium tabular-nums">
                      {formatBRL(v.liquido_corretor)}
                    </td>
                  </tr>
                ))}
                {linhasParcela.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-1">
                      {l.empreendimento ?? "Venda"}
                      {l.cliente ? ` — ${l.cliente}` : ""}
                      <span className="text-zinc-500"> · parcela {l.parcela}</span>
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatBRL(l.comissao_corretor_bruto)}
                    </td>
                    {temParceria ? (
                      <td className="py-1 text-right tabular-nums text-zinc-500">
                        {l.desconto_parceiro_valor > 0
                          ? `- ${formatBRL(l.desconto_parceiro_valor)}`
                          : "—"}
                      </td>
                    ) : null}
                    <td className="py-1 text-right tabular-nums text-zinc-500">
                      - {formatBRL(l.valor_imposto_nf)}
                    </td>
                    <td className="py-1 text-right font-medium tabular-nums">
                      {formatBRL(l.liquido_corretor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {bonificacoes.length > 0 ? (
          <section className="mb-4">
            <div className="mb-1 text-sm font-semibold">Bonificações</div>
            <table className="w-full text-sm">
              <tbody>
                {bonificacoes.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-1">{b.motivo ?? "Bonificação"}</td>
                    <td className="py-1 text-right tabular-nums">{formatBRL(b.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {adiantamentos.length > 0 ? (
          <section className="mb-4">
            <div className="mb-1 text-sm font-semibold">Adiantamentos (descontados)</div>
            <table className="w-full text-sm">
              <tbody>
                {adiantamentos.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-1">{a.descricao ?? "Adiantamento"}</td>
                    <td className="py-1 text-right tabular-nums">- {formatBRL(a.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <div className="mt-6 space-y-1 border-t pt-4 text-sm">
          {/* Funcionário não tem comissão nem imposto de NF: as linhas viriam
              zeradas e o rótulo "Comissão" seria falso num documento assinado.
              Nesse caso o recibo mostra só o valor do pagamento. */}
          {vendas.length > 0 || linhasParcela.length > 0 ? (
            <>
              <div className="flex justify-between">
                <span>Comissão bruta</span>
                <span className="tabular-nums">{formatBRL(totalComissaoBruta)}</span>
              </div>
              {temParceria ? (
                <div className="flex justify-between text-zinc-500">
                  <span>(−) Desconto de parceria</span>
                  <span className="tabular-nums">- {formatBRL(totalDescontoParceria)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-zinc-500">
                <span>(−) Imposto (NF)</span>
                <span className="tabular-nums">- {formatBRL(totalImposto)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Comissão líquida</span>
                <span className="tabular-nums">{formatBRL(pagamento.valor_bruto)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span>Pagamento</span>
              <span className="tabular-nums">{formatBRL(pagamento.valor_bruto)}</span>
            </div>
          )}
          {pagamento.total_bonificacoes > 0 ? (
            <div className="flex justify-between">
              <span>(+) Bonificações</span>
              <span className="tabular-nums">{formatBRL(pagamento.total_bonificacoes)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>(−) Adiantamentos</span>
            <span className="tabular-nums">- {formatBRL(pagamento.total_adiantamentos)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Valor líquido</span>
            <span className="tabular-nums">{formatBRL(pagamento.valor_liquido)}</span>
          </div>
        </div>

        <AssinaturaRecibo
          tipo="pagamento"
          id={pagamento.id}
          nome={pagamento.corretores?.nome ?? "Corretor"}
          assinaturaUrl={pagamento.assinatura_url}
          assinadoEm={pagamento.assinado_em}
        />
      </div>
    </div>
  );
}
