"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { alterarStatusVenda, excluirVenda } from "@/app/(app)/vendas/actions";
import { STATUS_VENDA_LABEL, type VendaStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STATUS: VendaStatus[] = ["aguardando_recebimento", "recebido", "pago"];

export function VendaAcoes({ id, status }: { id: string; status: VendaStatus }) {
  const [st, setSt] = useState<VendaStatus>(status);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function mudar(value: string) {
    const novo = value as VendaStatus;
    const anterior = st;
    setSt(novo);
    setSaving(true);
    const res = await alterarStatusVenda(id, novo);
    setSaving(false);
    if (res?.error) {
      toast.error("Erro ao mudar o status", { description: res.error });
      setSt(anterior);
    } else {
      toast.success("Status atualizado");
    }
  }

  async function remover() {
    setRemoving(true);
    const res = await excluirVenda(id);
    if (res?.error) {
      toast.error("Erro ao excluir", { description: res.error });
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Label>Status da venda</Label>
        <div className="flex items-center gap-2">
          <Select value={st} onValueChange={mudar} disabled={saving}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_VENDA_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="text-destructive">
            <Trash2 className="size-4" />
            Excluir venda
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir venda?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A venda e seus cálculos serão
              removidos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={remover}
              disabled={removing}
            >
              {removing ? <Loader2 className="size-4 animate-spin" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
