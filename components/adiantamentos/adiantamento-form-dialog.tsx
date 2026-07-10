"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { parseNumeroBR } from "@/lib/format";
import {
  criarAdiantamento,
  atualizarAdiantamento,
} from "@/app/(app)/adiantamentos/actions";
import type { AdiantamentoAvulsoRow, CorretorOpcao } from "@/lib/data/adiantamentos";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdiantamentoFormDialog({
  corretores,
  adiantamento,
  trigger,
}: {
  corretores: CorretorOpcao[];
  adiantamento?: AdiantamentoAvulsoRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(adiantamento);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [corretorId, setCorretorId] = useState(adiantamento?.corretorId ?? "");
  const [data, setData] = useState(
    adiantamento?.data ?? new Date().toISOString().slice(0, 10),
  );
  const [valor, setValor] = useState(
    adiantamento ? String(adiantamento.valor) : "",
  );
  const [descricao, setDescricao] = useState(
    adiantamento?.descricao ?? "Adiantamento",
  );
  const [reciboOk, setReciboOk] = useState(adiantamento?.reciboOk ?? false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!corretorId) {
      toast.error("Escolha o corretor.");
      return;
    }
    setSaving(true);
    const payload = {
      corretor_id: corretorId,
      data,
      valor: parseNumeroBR(valor),
      descricao: descricao.trim() || null,
      recibo_ok: reciboOk,
    };
    const res = adiantamento
      ? await atualizarAdiantamento({ id: adiantamento.id, ...payload })
      : await criarAdiantamento(payload);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao salvar", { description: res.error });
      return;
    }
    toast.success(isEdit ? "Adiantamento atualizado" : "Adiantamento registrado");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar adiantamento" : "Novo adiantamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Corretor</Label>
            <Select value={corretorId} onValueChange={setCorretorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o corretor" />
              </SelectTrigger>
              <SelectContent>
                {corretores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              placeholder="Ex.: Adiantamento, Notebook…"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={reciboOk}
              onCheckedChange={(v) => setReciboOk(v === true)}
            />
            Recibo assinado recebido
          </label>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
