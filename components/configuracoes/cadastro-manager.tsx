"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, CalendarClock } from "lucide-react";

import {
  parseNumeroBR,
  formatBRL,
  formatPercent,
  fracaoParaInputPct,
  inputPctParaFracao,
} from "@/lib/format";
import { salvarCadastro, excluirCadastro } from "@/app/(app)/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PercentuaisMensaisDialog,
  type CampoPercentual,
} from "@/components/configuracoes/percentuais-mensais-dialog";
import type { PercentualMensal } from "@/lib/types";

const NONE = "__none__";

export type CampoTipo = "text" | "number" | "percent" | "select" | "switch";

export interface Campo {
  name: string;
  label: string;
  tipo: CampoTipo;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface Coluna {
  key: string;
  label: string;
  formato?: "text" | "currency" | "percent" | "bool";
  alignRight?: boolean;
}

export type Registro = Record<string, unknown> & { id: string };

type FormState = Record<string, string | boolean>;

function estadoInicial(campos: Campo[], registro?: Registro): FormState {
  const s: FormState = {};
  for (const c of campos) {
    const v = registro?.[c.name];
    if (c.tipo === "switch") s[c.name] = registro ? Boolean(v) : true;
    else if (c.tipo === "percent")
      s[c.name] = v == null ? "" : fracaoParaInputPct(Number(v));
    else if (c.tipo === "select") s[c.name] = v == null ? NONE : String(v);
    else s[c.name] = v == null ? "" : String(v);
  }
  return s;
}

export function CadastroManager({
  tabela,
  titulo,
  descricao,
  campos,
  colunas,
  registros,
  percentuais,
}: {
  tabela: string;
  titulo: string;
  descricao?: string;
  campos: Campo[];
  colunas: Coluna[];
  registros: Registro[];
  percentuais?: { campos: CampoPercentual[]; rows: PercentualMensal[] };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [form, setForm] = useState<FormState>(estadoInicial(campos));
  const [saving, setSaving] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  function abrirNovo() {
    setEditando(null);
    setForm(estadoInicial(campos));
    setOpen(true);
  }
  function abrirEdicao(r: Registro) {
    setEditando(r);
    setForm(estadoInicial(campos, r));
    setOpen(true);
  }

  function setarCampo(name: string, value: string | boolean) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  function montarDados(): Record<string, unknown> {
    const dados: Record<string, unknown> = {};
    for (const c of campos) {
      const v = form[c.name];
      if (c.tipo === "switch") dados[c.name] = Boolean(v);
      else if (c.tipo === "percent") dados[c.name] = inputPctParaFracao(String(v));
      else if (c.tipo === "number") dados[c.name] = parseNumeroBR(String(v));
      else if (c.tipo === "select")
        dados[c.name] = v === NONE || v === "" ? null : String(v);
      else dados[c.name] = String(v).trim() || null;
    }
    return dados;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await salvarCadastro(tabela, editando?.id ?? null, montarDados());
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar", { description: res.error });
      return;
    }
    toast.success("Salvo");
    setOpen(false);
    router.refresh();
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    const res = await excluirCadastro(tabela, excluindo);
    if (res?.error) {
      toast.error("Erro ao excluir", { description: res.error });
    } else {
      toast.success("Excluído");
      router.refresh();
    }
    setExcluindo(null);
  }

  function formatar(r: Registro, col: Coluna): React.ReactNode {
    const v = r[col.key];
    switch (col.formato) {
      case "currency":
        return formatBRL(Number(v ?? 0));
      case "percent":
        return v == null ? "—" : formatPercent(Number(v));
      case "bool":
        return v ? "Ativo" : "Inativo";
      default:
        return v == null || v === "" ? "—" : String(v);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {descricao ? (
            <p className="text-sm text-muted-foreground">{descricao}</p>
          ) : null}
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </div>

      {registros.length === 0 ? (
        <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
          Nenhum registro.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {colunas.map((c) => (
                  <TableHead key={c.key} className={c.alignRight ? "text-right" : ""}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={r.id}>
                  {colunas.map((c) => (
                    <TableCell
                      key={c.key}
                      className={c.alignRight ? "text-right tabular-nums" : ""}
                    >
                      {formatar(r, c)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      {percentuais ? (
                        <PercentuaisMensaisDialog
                          titulo={String(r.nome ?? "")}
                          entidadeId={r.id}
                          campos={percentuais.campos}
                          rows={percentuais.rows}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Percentuais por mês"
                              title="Percentuais por mês"
                            >
                              <CalendarClock className="size-4" />
                            </Button>
                          }
                        />
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEdicao(r)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExcluindo(r.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? `Editar ${titulo}` : `Novo em ${titulo}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            {campos.map((c) => (
              <div key={c.name} className="space-y-2">
                {c.tipo === "switch" ? (
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={Boolean(form[c.name])}
                      onCheckedChange={(v) => setarCampo(c.name, Boolean(v))}
                    />
                    <span className="text-sm font-medium">{c.label}</span>
                  </label>
                ) : c.tipo === "select" ? (
                  <>
                    <Label>{c.label}</Label>
                    <Select
                      value={String(form[c.name])}
                      onValueChange={(v) => setarCampo(c.name, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {c.options?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Label htmlFor={`f-${c.name}`}>{c.label}</Label>
                    <Input
                      id={`f-${c.name}`}
                      inputMode={
                        c.tipo === "number" || c.tipo === "percent"
                          ? "decimal"
                          : undefined
                      }
                      value={String(form[c.name])}
                      onChange={(e) => setarCampo(c.name, e.target.value)}
                      placeholder={c.placeholder}
                      required={c.required}
                    />
                  </>
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={excluindo != null} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir registro?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmarExclusao}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
