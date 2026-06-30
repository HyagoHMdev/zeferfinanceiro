"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { calcularComissao } from "@/lib/calculos";
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
  const [cliente, setCliente] = useState(venda?.cliente ?? "");
  const [corretorId, setCorretorId] = useState(venda?.corretor_id ?? NONE);
  const [parceiroId, setParceiroId] = useState(venda?.parceiro_id ?? NONE);

  const [vgv, setVgv] = useState(venda ? String(venda.vgv) : "");
  const [pctComissao, setPctComissao] = useState(
    fracaoParaPctStr(venda?.percentual_comissao ?? config.percentual_comissao_padrao),
  );
  const [pctParceiro, setPctParceiro] = useState(
    fracaoParaPctStr(
      venda?.percentual_parceiro ?? config.percentual_parceiro_padrao,
    ),
  );
  const [pctImpostoImob, setPctImpostoImob] = useState(
    fracaoParaPctStr(
      venda?.percentual_imposto_imobiliaria ?? config.percentual_imposto_imobiliaria,
    ),
  );
  const [pctCorretor, setPctCorretor] = useState(
    fracaoParaPctStr(
      venda?.percentual_corretor ?? config.percentual_comissao_corretor_padrao,
    ),
  );
  const [pctImpostoNf, setPctImpostoNf] = useState(
    fracaoParaPctStr(
      venda?.percentual_imposto_nf ?? config.percentual_imposto_nf_corretor,
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

  const temParceiro = parceiroId !== NONE;

  const calc = useMemo(
    () =>
      calcularComissao({
        vgv: parseNumeroBR(vgv),
        percentualComissao: pctToFrac(pctComissao),
        percentualParceiro: temParceiro ? pctToFrac(pctParceiro) : 0,
        percentualImpostoImobiliaria: pctToFrac(pctImpostoImob),
        percentualCorretor: pctToFrac(pctCorretor),
        percentualImpostoNf: pctToFrac(pctImpostoNf),
      }),
    [vgv, pctComissao, pctParceiro, pctImpostoImob, pctCorretor, pctImpostoNf, temParceiro],
  );

  // Resolve o percentual aplicável (mês → padrão do cadastro → padrão global)
  // e preenche o campo. Os valores continuam editáveis manualmente.
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

  function aplicarCorretor(coId: string, d: string) {
    const c = corretores.find((x) => x.id === coId);
    setPctCorretor(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "comissao_corretor",
          coId === NONE ? null : coId,
          d,
          c?.percentual_comissao_padrao,
          config.percentual_comissao_corretor_padrao,
        ),
      ),
    );
    setPctImpostoNf(
      fracaoParaPctStr(
        percentualComFallback(
          percentuaisMensais,
          "imposto_nf_corretor",
          coId === NONE ? null : coId,
          d,
          c?.percentual_imposto_nf,
          config.percentual_imposto_nf_corretor,
        ),
      ),
    );
  }

  function aplicarParceiro(pId: string, d: string) {
    const p = parceiros.find((x) => x.id === pId);
    setPctParceiro(
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

  function onSelectConstrutora(value: string) {
    setConstrutoraId(value);
    setEmpreendimentoId(NONE);
    aplicarComissao(value, dataVenda);
  }

  function onSelectCorretor(value: string) {
    setCorretorId(value);
    aplicarCorretor(value, dataVenda);
  }

  function onSelectParceiro(value: string) {
    setParceiroId(value);
    aplicarParceiro(value, dataVenda);
  }

  function onChangeData(value: string) {
    setDataVenda(value);
    aplicarComissao(construtoraId, value);
    aplicarImpostoImob(value);
    aplicarCorretor(corretorId, value);
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
      cliente: cliente.trim() || null,
      corretor_id: corretorId === NONE ? null : corretorId,
      parceiro_id: parceiroId === NONE ? null : parceiroId,
      vgv: parseNumeroBR(vgv),
      percentual_comissao: pctToFrac(pctComissao),
      percentual_parceiro: temParceiro ? pctToFrac(pctParceiro) : 0,
      percentual_imposto_imobiliaria: pctToFrac(pctImpostoImob),
      percentual_corretor: pctToFrac(pctCorretor),
      percentual_imposto_nf: pctToFrac(pctImpostoNf),
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
      {/* Coluna de dados */}
      <div className="space-y-6 lg:col-span-2">
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
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Corretor responsável</Label>
              <Select value={corretorId} onValueChange={onSelectCorretor}>
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
            <div className="space-y-2">
              <Label>Parceiro (opcional)</Label>
              <Select value={parceiroId} onValueChange={onSelectParceiro}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem parceiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem parceiro</SelectItem>
                  {parceiros.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valores e percentuais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vgv">Valor do imóvel (VGV)</Label>
              <Input
                id="vgv"
                inputMode="decimal"
                value={vgv}
                onChange={(e) => setVgv(e.target.value)}
                placeholder="431.790,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctComissao">% Comissão construtora</Label>
              <Input
                id="pctComissao"
                inputMode="decimal"
                value={pctComissao}
                onChange={(e) => setPctComissao(e.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctParceiro">% Parceiro</Label>
              <Input
                id="pctParceiro"
                inputMode="decimal"
                value={pctParceiro}
                onChange={(e) => setPctParceiro(e.target.value)}
                disabled={!temParceiro}
                placeholder="17,5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctImpostoImob">% Imposto imobiliária</Label>
              <Input
                id="pctImpostoImob"
                inputMode="decimal"
                value={pctImpostoImob}
                onChange={(e) => setPctImpostoImob(e.target.value)}
                placeholder="11,9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctCorretor">% Comissão corretor (sobre VGV)</Label>
              <Input
                id="pctCorretor"
                inputMode="decimal"
                value={pctCorretor}
                onChange={(e) => setPctCorretor(e.target.value)}
                placeholder="1,75"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctImpostoNf">% Imposto NF corretor</Label>
              <Input
                id="pctImpostoNf"
                inputMode="decimal"
                value={pctImpostoNf}
                onChange={(e) => setPctImpostoNf(e.target.value)}
                placeholder="11,9"
              />
            </div>
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

      {/* Coluna de resultado (cálculo ao vivo) */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Linha label="Comissão bruta" valor={calc.comissaoBruta} />
            <Linha
              label="(−) Parceiro"
              valor={-calc.valorParceiro}
              muted={!temParceiro}
            />
            <Linha label="Saldo pós-parceria" valor={calc.saldoPosParceiro} divider />
            <Linha label="(−) Imposto imobiliária" valor={-calc.valorImposto} />
            <Linha label="Líquido Zefer" valor={calc.liquidoZefer} strong divider />
            <Linha label="Comissão corretor (bruto)" valor={calc.comissaoCorretorBruto} />
            <Linha label="(−) Imposto NF" valor={-calc.valorImpostoNf} />
            <Linha label="Líquido corretor" valor={calc.liquidoCorretor} strong divider />
            <Linha label="Lucro líquido Zefer" valor={calc.lucroLiquido} highlight />

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "create" ? "Cadastrar venda" : "Salvar alterações"}
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link href="/vendas">Cancelar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Linha({
  label,
  valor,
  strong,
  highlight,
  muted,
  divider,
}: {
  label: string;
  valor: number;
  strong?: boolean;
  highlight?: boolean;
  muted?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-2 py-1",
        divider ? "border-t pt-2 mt-1" : "",
        muted ? "text-muted-foreground" : "",
      ].join(" ")}
    >
      <span className={highlight ? "font-semibold" : strong ? "font-medium" : ""}>
        {label}
      </span>
      <span
        className={[
          "tabular-nums",
          highlight ? "text-base font-bold text-success" : "",
          strong ? "font-semibold" : "",
        ].join(" ")}
      >
        {formatBRL(valor)}
      </span>
    </div>
  );
}
