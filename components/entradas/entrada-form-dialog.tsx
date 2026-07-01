"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { calcularDistribuicao } from "@/lib/calculos";
import {
  parseNumeroBR,
  formatBRL,
  fracaoParaInputPct,
  inputPctParaFracao,
} from "@/lib/format";
import { percentualComFallback } from "@/lib/percentuais";
import { criarEntrada, atualizarEntrada } from "@/app/(app)/entradas/actions";
import type { EntradaInput } from "@/lib/schemas/entrada";
import {
  ENTRADA_TIPO_LABEL,
  type Configuracoes,
  type Entrada,
  type EntradaTipo,
  type PercentualMensal,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NONE = "__none__";
const TIPOS: EntradaTipo[] = [
  "comissao",
  "bonificacao",
  "premiacao",
  "investidor",
  "outras",
];

export interface VendaDisponivel {
  id: string;
  label: string;
  valor: number;
}

interface Props {
  config: Configuracoes;
  vendas: VendaDisponivel[];
  entrada?: Entrada;
  percentuaisMensais?: PercentualMensal[];
  /** % Empresa/Pessoal atuais (edição). Criação usa 0/100 como ponto de partida. */
  percentualEmpresaInicial?: number;
  percentualPessoalInicial?: number;
  trigger: React.ReactNode;
}

export function EntradaFormDialog({
  config,
  vendas,
  entrada,
  percentuaisMensais = [],
  percentualEmpresaInicial = 0,
  percentualPessoalInicial = 1,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const dataInicial = entrada?.data ?? new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(dataInicial);
  const [tipo, setTipo] = useState<EntradaTipo>(entrada?.tipo ?? "comissao");
  const [descricao, setDescricao] = useState(entrada?.descricao ?? "");
  const [valor, setValor] = useState(entrada ? String(entrada.valor) : "");
  const [pctDizimo, setPctDizimo] = useState(
    fracaoParaInputPct(
      entrada
        ? entrada.percentual_dizimo
        : percentualComFallback(
            percentuaisMensais,
            "dizimo",
            null,
            dataInicial,
            config.percentual_dizimo,
          ),
    ),
  );
  const [vendaId, setVendaId] = useState(entrada?.venda_id ?? NONE);
  const [pctEmpresa, setPctEmpresa] = useState(
    fracaoParaInputPct(percentualEmpresaInicial),
  );
  const [pctPessoal, setPctPessoal] = useState(
    fracaoParaInputPct(percentualPessoalInicial),
  );

  const fracEmpresa = inputPctParaFracao(pctEmpresa);
  const fracPessoal = inputPctParaFracao(pctPessoal);
  const somaValida = Math.abs(fracEmpresa + fracPessoal - 1) < 0.0001;

  function onChangeData(value: string) {
    setData(value);
    setPctDizimo(
      fracaoParaInputPct(
        percentualComFallback(
          percentuaisMensais,
          "dizimo",
          null,
          value,
          config.percentual_dizimo,
        ),
      ),
    );
  }

  const dist = useMemo(
    () =>
      calcularDistribuicao({
        valor: parseNumeroBR(valor),
        percentualDizimo: inputPctParaFracao(pctDizimo),
        percentualEmpresa: fracEmpresa,
      }),
    [valor, pctDizimo, fracEmpresa],
  );

  function onSelectVenda(value: string) {
    setVendaId(value);
    if (value !== NONE) {
      const v = vendas.find((x) => x.id === value);
      if (v) {
        setTipo("comissao");
        if (!valor) setValor(String(v.valor));
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!somaValida) {
      toast.error(
        "A distribuição entre Empresa e Pessoal deve totalizar exatamente 100%.",
      );
      return;
    }
    setSaving(true);
    const input: EntradaInput = {
      data,
      tipo,
      descricao: descricao.trim() || null,
      valor: parseNumeroBR(valor),
      percentual_dizimo: inputPctParaFracao(pctDizimo),
      percentual_empresa: fracEmpresa,
      percentual_pessoal: fracPessoal,
      venda_id: vendaId === NONE ? null : vendaId,
    };
    const res = entrada
      ? await atualizarEntrada(entrada.id, input)
      : await criarEntrada(input);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar a entrada", { description: res.error });
      return;
    }
    toast.success(entrada ? "Entrada atualizada" : "Entrada registrada");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entrada ? "Editar entrada" : "Nova entrada"}</DialogTitle>
          <DialogDescription>
            O dízimo e a distribuição empresa/pessoal são calculados
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-data">Data</Label>
              <Input
                id="e-data"
                type="date"
                value={data}
                onChange={(ev) => onChangeData(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as EntradaTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ENTRADA_TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Venda (recebimento de comissão)</Label>
            <Select value={vendaId} onValueChange={onSelectVenda}>
              <SelectTrigger>
                <SelectValue placeholder="Não vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não vinculada</SelectItem>
                {vendas.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="e-desc">Descrição</Label>
            <Input
              id="e-desc"
              value={descricao}
              onChange={(ev) => setDescricao(ev.target.value)}
              placeholder="Ex.: Comissão Evolution Urban Club"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-valor">Valor recebido</Label>
              <Input
                id="e-valor"
                inputMode="decimal"
                value={valor}
                onChange={(ev) => setValor(ev.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-dizimo">% Dízimo</Label>
              <Input
                id="e-dizimo"
                inputMode="decimal"
                value={pctDizimo}
                onChange={(ev) => setPctDizimo(ev.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-empresa">% Empresa</Label>
              <Input
                id="e-empresa"
                inputMode="decimal"
                value={pctEmpresa}
                onChange={(ev) => setPctEmpresa(ev.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-pessoal">% Pessoal</Label>
              <Input
                id="e-pessoal"
                inputMode="decimal"
                value={pctPessoal}
                onChange={(ev) => setPctPessoal(ev.target.value)}
                placeholder="100"
              />
            </div>
          </div>
          {!somaValida ? (
            <p className="text-sm text-destructive">
              A distribuição entre Empresa e Pessoal deve totalizar exatamente
              100%.
            </p>
          ) : null}

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <Resumo label="Dízimo" valor={dist.valorDizimo} />
            <Resumo label="Líquido" valor={dist.liquido} strong />
            <Resumo label="Empresa (Zefer)" valor={dist.valorEmpresa} />
            <Resumo label="Pessoal" valor={dist.valorPessoal} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || !somaValida}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {entrada ? "Salvar" : "Registrar entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({
  label,
  valor,
  strong,
}: {
  label: string;
  valor: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {formatBRL(valor)}
      </span>
    </div>
  );
}
