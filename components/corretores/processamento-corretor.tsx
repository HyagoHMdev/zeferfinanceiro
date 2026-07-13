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
} from "@/app/(app)/corretores/actions";
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
  const { venda, adiantamentos } = dados;

  // Vales do corretor: os desta venda (incluídos) + os avulsos disponíveis.
  const linhasAdiantamento = [
    ...adiantamentos.map((a) => ({ ...a, incluido: true })),
    ...dados.adiantamentosDisponiveis.map((a) => ({ ...a, incluido: false })),
  ];

  const [busyAdiantamento, setBusyAdiantamento] = useState<string | null>(null);

  async function toggleIncluir(id: string, incluir: boolean) {
    setBusyAdiantamento(id);
    const res = incluir
      ? await vincularAdiantamento(id, venda.id)
      : await desvincularAdiantamento(id, venda.id);
    if (res?.error) {
      toast.error("Erro ao atualizar", { description: res.error });
      setBusyAdiantamento(null);
      return;
    }
    router.refresh();
    setBusyAdiantamento(null);
  }

  const [pctCorretor, setPctCorretor] = useState(
    fracaoParaInputPct(Number(venda.percentual_corretor)),
  );
  const [pctDesconto, setPctDesconto] = useState(
    fracaoParaInputPct(Number(venda.percentual_desconto_parceiro)),
  );
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
    percentualDescontoParceiro: venda.possui_parceria
      ? inputPctParaFracao(pctDesconto)
      : 0,
    percentualImpostoNf: inputPctParaFracao(pctImpostoNf),
  });

  const totalAdiantamentos = round2(
    adiantamentos.reduce((s, a) => s + Number(a.valor), 0),
  );
  const liquidoPagamento = resumoCorretor(calc.liquidoCorretor, totalAdiantamentos);

  async function salvar() {
    setSaving(true);
    const res = await salvarCorretorVenda(venda.id, {
      percentual_corretor: inputPctParaFracao(pctCorretor),
      percentual_desconto_parceiro: venda.possui_parceria
        ? inputPctParaFracao(pctDesconto)
        : 0,
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
                <Label htmlFor="pc-desc">% desconto (parceria)</Label>
                <Input
                  id="pc-desc"
                  inputMode="decimal"
                  value={pctDesconto}
                  onChange={(e) => setPctDesconto(e.target.value)}
                  disabled={!podeEditar}
                  placeholder="0"
                />
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
                  {linhasAdiantamento.map((a) => (
                    <TableRow key={a.id} className={a.incluido ? "" : "opacity-70"}>
                      {podeEditar ? (
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant={a.incluido ? "default" : "outline"}
                            className={
                              a.incluido
                                ? "w-32 bg-success text-white hover:bg-success/90"
                                : "w-32"
                            }
                            disabled={busyAdiantamento === a.id}
                            onClick={() => toggleIncluir(a.id, !a.incluido)}
                          >
                            {busyAdiantamento === a.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : a.incluido ? (
                              <Check className="size-4" />
                            ) : null}
                            {a.incluido ? "Descontando" : "Incluir"}
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
                  ))}
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

