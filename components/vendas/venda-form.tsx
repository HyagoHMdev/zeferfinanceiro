"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { calcularVenda } from "@/lib/calculos";
import { parseNumeroBR, formatBRL } from "@/lib/format";
import { percentualComFallback } from "@/lib/percentuais";
import { criarVenda, atualizarVenda } from "@/app/(app)/vendas/actions";
import type { VendaInput } from "@/lib/schemas/venda";
import type {
  Configuracoes,
  Venda,
  Construtora,
  Empreendimento,
  Corretor,
  Parceiro,
  PercentualMensal,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResumoLinha } from "@/components/resumo-linha";

const NONE = "__none__";

function fracaoParaPctStr(f: number | null | undefined): string {
  if (f === null || f === undefined) return "";
  return (Math.round(f * 1e6) / 1e4).toString();
}
function pctToFrac(str: string): number {
  return parseNumeroBR(str) / 100;
}

interface VendaFormProps {
  mode: "create" | "edit";
  config: Configuracoes;
  construtoras: Construtora[];
  empreendimentos: Empreendimento[];
  corretores: Corretor[];
  parceiros: Parceiro[];
  percentuaisMensais?: PercentualMensal[];
  venda?: Venda;
}

export function VendaForm({
  mode,
  config,
  construtoras,
  empreendimentos,
  corretores,
  parceiros,
  percentuaisMensais = [],
  venda,
}: VendaFormProps) {
  const [dataVenda, setDataVenda] = useState(
    venda?.data_venda ?? new Date().toISOString().slice(0, 10),
  );
  const [construtoraId, setConstrutoraId] = useState(venda?.construtora_id ?? NONE);
  const [empreendimentoId, setEmpreendimentoId] = useState(
    venda?.empreendimento_id ?? NONE,
  );
  const [unidade, setUnidade] = useState(venda?.unidade ?? "");
  const [torre, setTorre] = useState(venda?.torre ?? "");
  const [cliente, setCliente] = useState(venda?.cliente ?? "");
  const [clienteNascimento, setClienteNascimento] = useState(
    venda?.cliente_nascimento ?? "",
  );
  const [clienteTelefone, setClienteTelefone] = useState(
    venda?.cliente_telefone ?? "",
  );
  const [corretorId, setCorretorId] = useState(venda?.corretor_id ?? NONE);
  const [vgv, setVgv] = useState(venda ? String(venda.vgv) : "");

  const [possuiParceria, setPossuiParceria] = useState(
    venda?.possui_parceria ?? false,
  );
  const [parceiroId, setParceiroId] = useState(venda?.parceiro_id ?? NONE);
  const [empresaParceira, setEmpresaParceira] = useState(
    venda?.empresa_parceira ?? "",
  );
  const [pctParceria, setPctParceria] = useState(
    fracaoParaPctStr(venda?.percentual_parceria ?? 0),
  );

  const [pctComissao, setPctComissao] = useState(
    fracaoParaPctStr(venda?.percentual_comissao ?? config.percentual_comissao_padrao),
  );
  const [pctImpostoImob, setPctImpostoImob] = useState(
    fracaoParaPctStr(
      venda?.percentual_imposto_imobiliaria ?? config.percentual_imposto_imobiliaria,
    ),
  );
  const [observacoes, setObservacoes] = useState(venda?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  const empreendimentosFiltrados = useMemo(
    () =>
      empreendimentos.filter(
        (e) => construtoraId === NONE || e.construtora_id === construtoraId,
      ),
    [empreendimentos, construtoraId],
  );

  // Percentuais do corretor (geridos no módulo Corretores) — usados só para
  // pré-visualizar o resultado. Na edição preserva os valores salvos, a menos
  // que o corretor tenha sido trocado.
  const corretorSel = corretores.find((c) => c.id === corretorId);
  const corretorMudou = venda ? corretorId !== (venda.corretor_id ?? NONE) : true;
  const pctCorretorPreview =
    venda && !corretorMudou
      ? venda.percentual_corretor
      : (corretorSel?.percentual_comissao_padrao ??
        config.percentual_comissao_corretor_padrao);
  const pctImpostoNfPreview =
    venda && !corretorMudou
      ? venda.percentual_imposto_nf
      : (corretorSel?.percentual_imposto_nf ??
        config.percentual_imposto_nf_corretor);
  const pctDescontoPreview =
    venda && !corretorMudou ? venda.percentual_desconto_parceiro : 0;

  const calc = useMemo(
    () =>
      calcularVenda({
        vgv: parseNumeroBR(vgv),
        percentualComissao: pctToFrac(pctComissao),
        possuiParceria,
        percentualParceria: possuiParceria ? pctToFrac(pctParceria) : 0,
        percentualImpostoImobiliaria: pctToFrac(pctImpostoImob),
        percentualCorretor: pctCorretorPreview,
        percentualDescontoParceiro: pctDescontoPreview,
        percentualImpostoNf: pctImpostoNfPreview,
      }),
    [
      vgv,
      pctComissao,
      possuiParceria,
      pctParceria,
      pctImpostoImob,
      pctCorretorPreview,
      pctDescontoPreview,
      pctImpostoNfPreview,
    ],
  );

  function aplicarComissao(cId: string, d: string) {
    const c = construtoras.find((x) => x.id === cId);
    setPctComissao(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "comissao_construtora",
          cId === NONE ? null : cId,
          d,
          c?.comissao_padrao,
          config.percentual_comissao_padrao,
        ),
      ),
    );
  }
  function aplicarImpostoImob(d: string) {
    setPctImpostoImob(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "imposto_imobiliaria",
          null,
          d,
          config.percentual_imposto_imobiliaria,
        ),
      ),
    );
  }

  function onSelectConstrutora(value: string) {
    setConstrutoraId(value);
    setEmpreendimentoId(NONE);
    aplicarComissao(value, dataVenda);
  }
  function aplicarParceiro(pId: string, d: string) {
    const p = parceiros.find((x) => x.id === pId);
    setPctParceria(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "repasse_parceiro",
          pId === NONE ? null : pId,
          d,
          p?.percentual_padrao,
          config.percentual_parceiro_padrao,
        ),
      ),
    );
  }

  function onSelectParceiro(value: string) {
    setParceiroId(value);
    const p = parceiros.find((x) => x.id === value);
    setEmpresaParceira(p?.nome ?? "");
    if (value !== NONE) aplicarParceiro(value, dataVenda);
  }

  function onChangeData(value: string) {
    setDataVenda(value);
    aplicarComissao(construtoraId, value);
    aplicarImpostoImob(value);
    if (parceiroId !== NONE) aplicarParceiro(parceiroId, value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: VendaInput = {
      data_venda: dataVenda,
      construtora_id: construtoraId === NONE ? null : construtoraId,
      empreendimento_id: empreendimentoId === NONE ? null : empreendimentoId,
      unidade: unidade.trim() || null,
      torre: torre.trim() || null,
      cliente: cliente.trim() || null,
      cliente_nascimento: clienteNascimento || null,
      cliente_telefone: clienteTelefone.trim() || null,
      corretor_id: corretorId === NONE ? null : corretorId,
      possui_parceria: possuiParceria,
      parceiro_id: possuiParceria && parceiroId !== NONE ? parceiroId : null,
      empresa_parceira: possuiParceria ? empresaParceira.trim() || null : null,
      percentual_parceria: possuiParceria ? pctToFrac(pctParceria) : 0,
      vgv: parseNumeroBR(vgv),
      percentual_comissao: pctToFrac(pctComissao),
      percentual_imposto_imobiliaria: pctToFrac(pctImpostoImob),
      observacoes: observacoes.trim() || null,
    };

    const res =
      mode === "create"
        ? await criarVenda(input)
        : await atualizarVenda(venda!.id, input);
    if (res?.error) {
      toast.error("Erro ao salvar a venda", { description: res.error });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* CARD 1 — Dados da venda */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da venda</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="data">Data da venda</Label>
              <Input
                id="data"
                type="date"
                value={dataVenda}
                onChange={(e) => onChangeData(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Construtora</Label>
              <Select value={construtoraId} onValueChange={onSelectConstrutora}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {construtoras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empreendimento</Label>
              <Select value={empreendimentoId} onValueChange={setEmpreendimentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {empreendimentosFiltrados.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Input
                id="unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: Apto 1203"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="torre">Torre</Label>
              <Input
                id="torre"
                value={torre}
                onChange={(e) => setTorre(e.target.value)}
                placeholder="Ex.: Torre A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Nome completo do cliente</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-nasc">Data de nascimento</Label>
              <Input
                id="cliente-nasc"
                type="date"
                value={clienteNascimento}
                onChange={(e) => setClienteNascimento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-tel">Telefone do cliente</Label>
              <Input
                id="cliente-tel"
                inputMode="tel"
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                placeholder="(47) 90000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Corretor responsável</Label>
              <Select value={corretorId} onValueChange={setCorretorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {corretores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vgv">Valor do contrato (VGV)</Label>
              <Input
                id="vgv"
                inputMode="decimal"
                value={vgv}
                onChange={(e) => setVgv(e.target.value)}
                placeholder="431.790,00"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2 — Parceria */}
        <Card>
          <CardHeader>
            <CardTitle>Parceria</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Possui parceria?</Label>
              <Select
                value={possuiParceria ? "sim" : "nao"}
                onValueChange={(v) => setPossuiParceria(v === "sim")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {possuiParceria ? (
              <>
                <div className="space-y-2">
                  <Label>Parceiro</Label>
                  <Select value={parceiroId} onValueChange={onSelectParceiro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o parceiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {parceiros.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pct-parceria">% da parceria (sobre o VGV)</Label>
                  <Input
                    id="pct-parceria"
                    inputMode="decimal"
                    value={pctParceria}
                    onChange={(e) => setPctParceria(e.target.value)}
                    placeholder="17,5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                  <Calculado label="Valor da parceria" valor={calc.valorParceria} />
                  <Calculado
                    label="Líquido pós-parceria"
                    valor={calc.liquidoPosParceria}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* CARD 3 — Valores e percentuais */}
        <Card>
          <CardHeader>
            <CardTitle>Valores e percentuais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Calculado label="VGV" valor={parseNumeroBR(vgv)} />
            <div className="space-y-2">
              <Label htmlFor="pctComissao">% pago pela construtora</Label>
              <Input
                id="pctComissao"
                inputMode="decimal"
                value={pctComissao}
                onChange={(e) => setPctComissao(e.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctImpostoImob">% imposto a reter</Label>
              <Input
                id="pctImpostoImob"
                inputMode="decimal"
                value={pctImpostoImob}
                onChange={(e) => setPctImpostoImob(e.target.value)}
                placeholder="11,9"
              />
            </div>
            <Calculado label="R$ imposto" valor={calc.valorImposto} />
            <Calculado label="Líquido pós imposto" valor={calc.liquidoZefer} />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="obs">Observações</Label>
              <Input
                id="obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PAINEL RESULTADO */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <ResumoLinha label="Comissão bruta" valor={calc.comissaoBruta} />
            <ResumoLinha
              label="(−) Parceiro"
              valor={-calc.valorParceria}
              muted={!possuiParceria}
            />
            <ResumoLinha label="Líquido pós-parceria" valor={calc.liquidoPosParceria} divider />
            <ResumoLinha label="(−) Imposto" valor={-calc.valorImposto} />
            <ResumoLinha label="Líquido Zefer" valor={calc.liquidoZefer} highlight divider />

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "create" ? "Cadastrar venda" : "Salvar alterações"}
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link href="/vendas">Cancelar</Link>
              </Button>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              A comissão do corretor é gerida no módulo Corretores.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Calculado({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">
        {formatBRL(valor)}
      </div>
    </div>
  );
}

