"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import {
  inputPctParaFracao,
  fracaoParaInputPct,
  formatPercent,
} from "@/lib/format";
import {
  salvarMesPercentuais,
  excluirMesPercentuais,
} from "@/app/(app)/configuracoes/actions";
import type { PercentualChave, PercentualMensal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface CampoPercentual {
  chave: PercentualChave;
  label: string;
}

function mesLabel(yyyymm: string) {
  const [a, m] = yyyymm.split("-");
  return `${m}/${a}`;
}

export function PercentuaisMensaisDialog({
  titulo,
  entidadeId,
  campos,
  rows,
  trigger,
}: {
  titulo: string;
  entidadeId: string | null;
  campos: CampoPercentual[];
  rows: PercentualMensal[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [valores, setValores] = useState<Record<string, string>>({});

  const chaves = campos.map((c) => c.chave);

  // Agrupa as linhas relevantes por mês.
  const porMes = useMemo(() => {
    const relevantes = rows.filter(
      (r) =>
        (r.entidade_id ?? null) === (entidadeId ?? null) &&
        chaves.includes(r.chave),
    );
    const map = new Map<string, Record<string, number>>();
    for (const r of relevantes) {
      const mm = r.competencia.slice(0, 7);
      const atual = map.get(mm) ?? {};
      atual[r.chave] = Number(r.percentual);
      map.set(mm, atual);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows, entidadeId, chaves]);

  function editar(mm: string, vals: Record<string, number>) {
    setMes(mm);
    const novos: Record<string, string> = {};
    for (const c of campos) {
      novos[c.chave] = vals[c.chave] != null ? fracaoParaInputPct(vals[c.chave]) : "";
    }
    setValores(novos);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const itens = campos
      .filter((c) => (valores[c.chave] ?? "").trim() !== "")
      .map((c) => ({ chave: c.chave, percentual: inputPctParaFracao(valores[c.chave]) }));
    if (itens.length === 0) {
      toast.error("Informe ao menos um percentual.");
      return;
    }
    setSaving(true);
    const res = await salvarMesPercentuais(entidadeId, mes, itens);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar", { description: res.error });
      return;
    }
    toast.success("Percentuais do mês salvos");
    setValores({});
    router.refresh();
  }

  async function remover(mm: string) {
    const res = await excluirMesPercentuais(entidadeId, mm, chaves);
    if (res?.error) {
      toast.error("Erro ao remover", { description: res.error });
      return;
    }
    toast.success("Mês removido");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Percentuais por mês — {titulo}</DialogTitle>
          <DialogDescription>
            Defina o percentual de cada mês. Meses sem valor usam o padrão do
            cadastro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-3">
          <div className="space-y-1">
            <Label htmlFor="pm-mes">Mês</Label>
            <Input
              id="pm-mes"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-40"
              required
            />
          </div>
          {campos.map((c) => (
            <div key={c.chave} className="space-y-1">
              <Label htmlFor={`pm-${c.chave}`}>{c.label}</Label>
              <Input
                id={`pm-${c.chave}`}
                inputMode="decimal"
                value={valores[c.chave] ?? ""}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [c.chave]: e.target.value }))
                }
                placeholder="0"
                className="w-28"
              />
            </div>
          ))}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar mês
          </Button>
        </form>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                {campos.map((c) => (
                  <TableHead key={c.chave} className="text-right">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porMes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={campos.length + 2}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Nenhum mês definido. Será usado o padrão do cadastro.
                  </TableCell>
                </TableRow>
              ) : (
                porMes.map(([mm, vals]) => (
                  <TableRow
                    key={mm}
                    className="cursor-pointer"
                    onClick={() => editar(mm, vals)}
                  >
                    <TableCell className="font-medium">{mesLabel(mm)}</TableCell>
                    {campos.map((c) => (
                      <TableCell key={c.chave} className="text-right tabular-nums">
                        {vals[c.chave] != null ? formatPercent(vals[c.chave]) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover mês"
                        onClick={(e) => {
                          e.stopPropagation();
                          remover(mm);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
