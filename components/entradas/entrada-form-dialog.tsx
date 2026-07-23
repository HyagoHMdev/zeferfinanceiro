"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { round2 } from "@/lib/calculos";
import {
  parseNumeroBR,
  formatBRL,
  fracaoParaInputPct,
  inputPctParaFracao,
} from "@/lib/format";
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
  /** % Empresa/Pessoal/Joinville atuais (edição). Criação usa 0/100/0. */
  percentualEmpresaInicial?: number;
  percentualPessoalInicial?: number;
  percentualJoinvilleInicial?: number;
  trigger: React.ReactNode;
}

export function EntradaFormDialog({
  config,
  vendas,
  entrada,
  percentuaisMensais = [],
  percentualEmpresaInicial = 0,
  percentualPessoalInicial = 1,
  percentualJoinvilleInicial = 0,
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
  const [vendaId, setVendaId] = useState(entrada?.venda_id ?? NONE);
  const [pctEmpresa, setPctEmpresa] = useState(
    fracaoParaInputPct(percentualEmpresaInicial),
  );
  const [pctPessoal, setPctPessoal] = useState(
    fracaoParaInputPct(percentualPessoalInicial),
  );
  const [pctJoinville, setPctJoinville] = useState(
    fracaoParaInputPct(percentualJoinvilleInicial),
  );

  const fracEmpresa = inputPctParaFracao(pctEmpresa);
  const fracPessoal = inputPctParaFracao(pctPessoal);
  const fracJoinville = inputPctParaFracao(pctJoinville);
  // Empresa + Pessoal + Zefer Joinville têm que somar 100%.
  const somaValida = Math.abs(fracEmpresa + fracPessoal + fracJoinville - 1) < 0.0001;

  // Sem dízimo: líquido = valor. As três parcelas são % do líquido; o pessoal
  // fica com o resto para não sobrar/faltar centavo no arredondamento.
  const dist = useMemo(() => {
    const liquido = round2(parseNumeroBR(valor));
    const valorEmpresa = round2(liquido * fracEmpresa);
    const valorJoinville = round2(liquido * fracJoinville);
    const valorPessoal = round2(liquido - valorEmpresa - valorJoinville);
    return { liquido, valorEmpresa, valorPessoal, valorJoinville };
  }, [valor, fracEmpresa, fracJoinville]);

  // Slider Empresa ↔ Pessoal: define a % da empresa (dentro do que sobra depois
  // da Joinville) e joga o resto no pessoal, mantendo a soma em 100%.
  const tetoEmpresa = 100 - fracJoinville * 100; // o que sobra depois da Joinville
  function ajustarSplit(empresaPct: number) {
    const emp = Math.max(0, Math.min(tetoEmpresa, Math.round(empresaPct)));
    setPctEmpresa(String(emp));
    // Arredonda o resto em 2 casas para não deixar "39.49999" no campo.
    setPctPessoal(String(Math.round((tetoEmpresa - emp) * 100) / 100));
  }

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
        "A soma de Empresa + Pessoal + Zefer Joinville deve dar exatamente 100%.",
      );
      return;
    }
    setSaving(true);
    const input: EntradaInput = {
      data,
      tipo,
      descricao: descricao.trim() || null,
      valor: parseNumeroBR(valor),
      percentual_dizimo: 0,
      percentual_empresa: fracEmpresa,
      percentual_pessoal: fracPessoal,
      percentual_joinville: fracJoinville,
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
            Divida a entrada entre Empresa, Pessoal e Zefer Joinville (soma 100%).
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
                onChange={(ev) => setData(ev.target.value)}
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

          <div className="group space-y-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <div className="space-y-2">
              <Label htmlFor="e-joinville">% Zefer Joinville</Label>
              <Input
                id="e-joinville"
                inputMode="decimal"
                value={pctJoinville}
                onChange={(ev) => setPctJoinville(ev.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Controle deslizante: aparece ao passar o mouse. Arrasta o split
              Empresa ↔ Pessoal (respeitando a fatia da Joinville). */}
          <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-24 group-hover:opacity-100 focus-within:max-h-24 focus-within:opacity-100">
            <div className="flex items-center gap-3 pt-1">
              <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">Pessoal</span>
              <input
                type="range"
                min={0}
                max={tetoEmpresa}
                value={Math.round(fracEmpresa * 100)}
                onChange={(ev) => ajustarSplit(Number(ev.target.value))}
                aria-label="Distribuir entre Pessoal e Empresa"
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
              <span className="w-14 shrink-0 text-xs text-muted-foreground">Empresa</span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-foreground">
                {Math.round(fracEmpresa * 100)}% / {Math.round(fracPessoal * 100)}%
              </span>
            </div>
          </div>
          </div>
          {!somaValida ? (
            <p className="text-sm text-destructive">
              A soma de Empresa + Pessoal + Zefer Joinville deve dar exatamente 100%.
            </p>
          ) : null}

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <Resumo label="Líquido" valor={dist.liquido} strong />
            <Resumo label="Empresa (Zefer)" valor={dist.valorEmpresa} />
            <Resumo label="Pessoal" valor={dist.valorPessoal} />
            {fracJoinville > 0 ? (
              <Resumo label="Zefer Joinville" valor={dist.valorJoinville} />
            ) : null}
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
