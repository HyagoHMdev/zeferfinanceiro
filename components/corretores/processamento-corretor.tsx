"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Check } from "lucide-react";

import { calcularVenda, resumoCorretor, round2 } from "@/lib/calculos";
import {
  parseNumeroBR,
  formatBRL,
  formatData,
  fracaoParaInputPct,
  inputPctParaFracao,
} from "@/lib/format";
import {
  salvarCorretorVenda,
  registrarAdiantamento,
  vincularAdiantamento,
  desvincularAdiantamento,
  marcarParcelaRecebida,
} from "@/app/(app)/corretores/actions";
import { registrarPagamento } from "@/app/(app)/pagamentos/actions";
import type { ProcessamentoVenda } from "@/lib/data/corretores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumoLinha } from "@/components/resumo-linha";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProcessamentoCorretor({
  dados,
  podeEditar,
}: {
  dados: ProcessamentoVenda;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const { venda, adiantamentos, parcelas, pagavel } = dados;
  const [parcelaBusy, setParcelaBusy] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);

  // Adiantamentos DESTA venda que ainda não foram descontados. Os vales
  // avulsos ficam de fora: aqui se paga uma venda, não a conta inteira do
  // corretor (para isso existe a fila em Corretores).
  const adiAbertos = adiantamentos.filter((a) => !a.pagamento_id);
  const totalAdiAbertos = round2(adiAbertos.reduce((s, a) => s + Number(a.valor), 0));
  const liquidoAPagar = round2(pagavel.bruto - totalAdiAbertos);

  /**
   * Paga a comissão desta venda sem sair da tela.
   *
   * Usa a MESMA action da fila de pagamento, com as mesmas chaves (venda, ou
   * as parcelas liberadas): dois caminhos para o mesmo lugar, não duas regras.
   */
  async function pagarCorretor() {
    if (!venda.corretor_id) return toast.error("Venda sem corretor.");
    const rotulo = parcelas.length > 0
      ? `Pagar ${formatBRL(liquidoAPagar)} ao corretor (${pagavel.chaves.length} parcela(s) liberada(s))?`
      : `Pagar ${formatBRL(liquidoAPagar)} ao corretor?`;
    if (!confirm(rotulo)) return;

    setPagando(true);
    const res = await registrarPagamento({
      corretorId: venda.corretor_id,
      chaves: pagavel.chaves,
      adiantamentoIds: adiAbertos.map((a) => a.id),
    });
    setPagando(false);
    if (res?.error) return toast.error(res.error);
    toast.success("Pagamento registrado.");
    if (res?.pagamentoId) window.open(`/recibo/pagamento/${res.pagamentoId}`, "_blank");
    router.refresh();
  }

  /**
   * Liberar a parcela é o que solta a fatia da comissão para a fila de
   * pagamento. Fica aqui, e não só no formulário da venda, porque quem
   * acompanha o recebimento da construtora é quem abre esta tela.
   */
  async function alternarParcela(id: string, recebidoEm: string | null) {
    setParcelaBusy(id);
    const res = await marcarParcelaRecebida({
      parcelaId: id,
      recebidoEm: recebidoEm ? null : new Date().toISOString().slice(0, 10),
    });
    setParcelaBusy(null);
    if (res?.error) return toast.error(res.error);
    router.refresh();
  }

  // Vales do corretor: os desta venda (incluídos) + os avulsos disponíveis.
  const linhasAdiantamento = [
    ...adiantamentos.map((a) => ({ ...a, incluido: true })),
    ...dados.adiantamentosDisponiveis.map((a) => ({ ...a, incluido: false })),
  ];

  // Estado otimista: reflete o clique na hora, sem esperar o refresh.
  const [incluidoOverride, setIncluidoOverride] = useState<Record<string, boolean>>({});
  const [busyAdiantamento, setBusyAdiantamento] = useState<string | null>(null);
  const estaIncluido = (a: { id: string; incluido: boolean }) =>
    incluidoOverride[a.id] ?? a.incluido;

  async function toggleIncluir(id: string, incluir: boolean) {
    setIncluidoOverride((o) => ({ ...o, [id]: incluir })); // otimista
    setBusyAdiantamento(id);
    const res = incluir
      ? await vincularAdiantamento(id, venda.id)
      : await desvincularAdiantamento(id, venda.id);
    setBusyAdiantamento(null);
    if (res?.error) {
      toast.error("Erro ao atualizar", { description: res.error });
      setIncluidoOverride((o) => ({ ...o, [id]: !incluir })); // reverte
      return;
    }
    router.refresh();
  }

  const [pctCorretor, setPctCorretor] = useState(
    fracaoParaInputPct(Number(venda.percentual_corretor)),
  );
  // Desconto de parceria em reais. Vendas antigas guardavam só o percentual,
  // então o valor é derivado dele quando a coluna nova ainda está zerada.
  const [descontoValor, setDescontoValor] = useState(() => {
    const salvo = Number(venda.desconto_parceiro_valor ?? 0);
    const legado =
      Number(venda.comissao_corretor_bruto) * Number(venda.percentual_desconto_parceiro ?? 0);
    const v = salvo > 0 ? salvo : legado;
    return v > 0 ? String(v).replace(".", ",") : "";
  });
  const [pctImpostoNf, setPctImpostoNf] = useState(
    fracaoParaInputPct(Number(venda.percentual_imposto_nf)),
  );
  const [saving, setSaving] = useState(false);

  const calc = calcularVenda({
    vgv: Number(venda.vgv),
    percentualComissao: Number(venda.percentual_comissao),
    possuiParceria: venda.possui_parceria,
    percentualParceria: Number(venda.percentual_parceria),
    percentualImpostoImobiliaria: Number(venda.percentual_imposto_imobiliaria),
    percentualCorretor: inputPctParaFracao(pctCorretor),
    descontoParceiroValor: venda.possui_parceria ? parseNumeroBR(descontoValor) : 0,
    percentualImpostoNf: inputPctParaFracao(pctImpostoNf),
  });

  const totalAdiantamentos = round2(
    linhasAdiantamento
      .filter((a) => estaIncluido(a))
      .reduce((s, a) => s + Number(a.valor), 0),
  );
  const liquidoPagamento = resumoCorretor(calc.liquidoCorretor, totalAdiantamentos);

  async function salvar() {
    setSaving(true);
    const res = await salvarCorretorVenda(venda.id, {
      percentual_corretor: inputPctParaFracao(pctCorretor),
      desconto_parceiro_valor: venda.possui_parceria ? parseNumeroBR(descontoValor) : 0,
      percentual_imposto_nf: inputPctParaFracao(pctImpostoNf),
    });
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar", { description: res.error });
      return;
    }
    toast.success("Comissão do corretor salva");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Dados da venda (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da venda</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Campo label="Cliente" valor={venda.cliente ?? "—"} />
            <Campo label="Data" valor={formatData(venda.data_venda)} />
            <Campo label="Empreendimento" valor={venda.empreendimentos?.nome ?? "—"} />
            <Campo label="Unidade" valor={venda.unidade ?? "—"} />
            <Campo label="VGV" valor={formatBRL(venda.vgv)} />
            <Campo label="Comissão bruta" valor={formatBRL(venda.comissao_bruta)} />
            {venda.possui_parceria ? (
              <>
                <Campo label="Valor da parceria" valor={formatBRL(venda.valor_parceria)} />
                <Campo
                  label="Líquido pós-parceria"
                  valor={formatBRL(venda.liquido_pos_parceria)}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Comissão do corretor (manual) */}
        <Card>
          <CardHeader>
            <CardTitle>Comissão do corretor</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-corretor">% comissão corretor</Label>
              <Input
                id="pc-corretor"
                inputMode="decimal"
                value={pctCorretor}
                onChange={(e) => setPctCorretor(e.target.value)}
                disabled={!podeEditar}
                placeholder="1,75"
              />
            </div>
            {venda.possui_parceria ? (
              <div className="space-y-2">
                <Label htmlFor="pc-desc">R$ desconto (parceria)</Label>
                <Input
                  id="pc-desc"
                  inputMode="decimal"
                  value={descontoValor}
                  onChange={(e) => setDescontoValor(e.target.value)}
                  disabled={!podeEditar}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">
                  Valor descontado da comissão bruta ({formatBRL(calc.comissaoCorretorBruto)}).
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="pc-nf">% imposto NF</Label>
              <Input
                id="pc-nf"
                inputMode="decimal"
                value={pctImpostoNf}
                onChange={(e) => setPctImpostoNf(e.target.value)}
                disabled={!podeEditar}
                placeholder="11,9"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Valor imposto NF: </span>
                <span className="tabular-nums font-medium">
                  {formatBRL(calc.valorImpostoNf)}
                </span>
              </div>
            </div>
            {podeEditar ? (
              <div className="sm:col-span-2">
                <Button onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Salvar comissão
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Adiantamentos */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Adiantamentos</CardTitle>
            {podeEditar ? (
              <AdiantamentoDialog
                corretorId={venda.corretor_id ?? ""}
                vendaId={venda.id}
              />
            ) : null}
          </CardHeader>
          <CardContent className="px-0">
            {podeEditar ? (
              <p className="px-6 pb-2 text-xs text-muted-foreground">
                Marque os vales que devem ser descontados desta comissão. Vales
                sem marcação continuam disponíveis para outra venda.
              </p>
            ) : null}
            {linhasAdiantamento.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum vale para este corretor. Cadastre em Adiantamentos ou use
                &quot;+ Adiantamento&quot;.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {podeEditar ? <TableHead className="w-36">Descontar</TableHead> : null}
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasAdiantamento.map((a) => {
                    const incluido = estaIncluido(a);
                    return (
                    <TableRow key={a.id} className={incluido ? "" : "opacity-70"}>
                      {podeEditar ? (
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant={incluido ? "default" : "outline"}
                            className={
                              incluido
                                ? "w-32 bg-success text-white hover:bg-success/90"
                                : "w-32"
                            }
                            disabled={busyAdiantamento === a.id}
                            onClick={() => toggleIncluir(a.id, !incluido)}
                          >
                            {busyAdiantamento === a.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : incluido ? (
                              <Check className="size-4" />
                            ) : null}
                            {incluido ? "Descontando" : "Incluir"}
                          </Button>
                        </TableCell>
                      ) : null}
                      <TableCell className="whitespace-nowrap">
                        {formatData(a.data)}
                      </TableCell>
                      <TableCell>{a.descricao ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(a.valor)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell
                      colSpan={podeEditar ? 3 : 2}
                      className="font-medium"
                    >
                      Total descontado
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(totalAdiantamentos)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo do corretor */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Resumo do corretor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ResumoLinha label="Comissão bruta" valor={calc.comissaoCorretorBruto} />
            <ResumoLinha
              label="(−) Desconto parceria"
              valor={-calc.descontoCorretor}
              muted={!venda.possui_parceria}
            />
            <ResumoLinha
              label="Comissão corretor"
              valor={calc.comissaoCorretorAjustada}
              divider
            />
            <ResumoLinha label="(−) Imposto NF" valor={-calc.valorImpostoNf} />
            <ResumoLinha label="Comissão líquida" valor={calc.liquidoCorretor} strong divider />
            <ResumoLinha label="(−) Adiantamentos" valor={-totalAdiantamentos} />
            <ResumoLinha label="Líquido para pagamento" valor={liquidoPagamento} highlight />

            {podeEditar ? (
              pagavel.chaves.length > 0 ? (
                <Button className="mt-3 w-full" onClick={pagarCorretor} disabled={pagando}>
                  {pagando ? <Loader2 className="size-4 animate-spin" /> : null}
                  Pagar corretor · {formatBRL(liquidoAPagar)}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {parcelas.length > 0
                    ? "Nada liberado para pagar: marque as parcelas que a construtora já pagou."
                    : "Comissão já paga."}
                </p>
              )
            ) : null}

            {/* Venda parcelada não é paga de uma vez: o número acima é o total
                da venda, e o que entra na fila de pagamento é a fatia de cada
                parcela que a construtora já liberou. */}
            {parcelas.length > 0 ? (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Comissão por parcela
                </div>
                <ul className="space-y-1.5">
                  {parcelas.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {p.numero}/{p.total} · {formatData(p.vencimento)}
                        <span className="block">
                          {p.pago
                            ? "paga ao corretor"
                            : p.recebidoEm
                              ? `liberada em ${formatData(p.recebidoEm)}`
                              : "aguardando a construtora"}
                        </span>
                        {podeEditar && !p.pago ? (
                          <button
                            type="button"
                            disabled={parcelaBusy === p.id}
                            onClick={() => alternarParcela(p.id, p.recebidoEm)}
                            className="mt-0.5 underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                          >
                            {p.recebidoEm ? "desfazer" : "marcar como liberada"}
                          </button>
                        ) : null}
                      </span>
                      <span
                        className={
                          p.pago
                            ? "tabular-nums text-muted-foreground line-through"
                            : "tabular-nums"
                        }
                      >
                        {formatBRL(p.liquidoCorretor)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  A soma das parcelas é a comissão líquida da venda. O pagamento
                  acontece parcela a parcela, em Pagamentos, conforme a construtora
                  libera.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{valor}</div>
    </div>
  );
}

function AdiantamentoDialog({
  corretorId,
  vendaId,
}: {
  corretorId: string;
  vendaId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!corretorId) {
      toast.error("A venda não tem corretor vinculado.");
      return;
    }
    setSaving(true);
    const res = await registrarAdiantamento({
      corretor_id: corretorId,
      venda_id: vendaId,
      data,
      valor: parseNumeroBR(valor),
      descricao: descricao.trim() || null,
      observacoes: observacoes.trim() || null,
    });
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao registrar", { description: res.error });
      return;
    }
    toast.success("Adiantamento registrado");
    setValor("");
    setDescricao("");
    setObservacoes("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Adiantamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo adiantamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ad-data">Data</Label>
              <Input
                id="ad-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-valor">Valor</Label>
              <Input
                id="ad-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ad-desc">Descrição</Label>
            <Input
              id="ad-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ad-obs">Observações</Label>
            <Input
              id="ad-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

