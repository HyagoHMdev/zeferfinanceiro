"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import {
  alterarStatusLancamento,
  excluirLancamento,
} from "@/app/(app)/financeiro/actions";
import {
  LANCAMENTO_STATUS_LABEL,
  type Lancamento,
  type LancamentoEscopo,
  type LancamentoNatureza,
  type LancamentoStatus,
} from "@/lib/types";
import { statusLancamentoEfetivo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CadastrosLancamento } from "@/lib/data/financeiro";
import { Button } from "@/components/ui/button";
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
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog";

const STATUS: LancamentoStatus[] = ["pendente", "pago", "atrasado"];

const STATUS_COR: Record<LancamentoStatus, string> = {
  pago: "border-success/60 text-success",
  pendente: "border-warning/60 text-warning",
  atrasado: "border-destructive/60 text-destructive",
};

export function LancamentoRowActions({
  lancamento,
  escopoFixo,
  naturezaFixa,
  cadastros,
}: {
  lancamento: Lancamento;
  escopoFixo: LancamentoEscopo;
  naturezaFixa?: LancamentoNatureza;
  cadastros: CadastrosLancamento;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<LancamentoStatus>(
    statusLancamentoEfetivo(lancamento.status, lancamento.data_vencimento),
  );
  const [busy, setBusy] = useState(false);
  const [openDel, setOpenDel] = useState(false);
  const isGrupo = Boolean(lancamento.recorrencia_grupo);

  async function mudarStatus(value: string) {
    const novo = value as LancamentoStatus;
    const anterior = status;
    setStatus(novo);
    setBusy(true);
    const res = await alterarStatusLancamento(lancamento.id, novo);
    setBusy(false);
    if (res?.error) {
      toast.error("Erro ao mudar status", { description: res.error });
      setStatus(anterior);
    } else {
      router.refresh();
    }
  }

  async function remover(escopo: "este" | "grupo") {
    setBusy(true);
    const res = await excluirLancamento(lancamento.id, escopo);
    setBusy(false);
    if (res?.error) {
      toast.error("Erro ao excluir", { description: res.error });
      return;
    }
    toast.success("Lançamento excluído");
    setOpenDel(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Select value={status} onValueChange={mudarStatus} disabled={busy}>
        <SelectTrigger size="sm" className={cn("w-32 font-medium", STATUS_COR[status])}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS.map((s) => (
            <SelectItem key={s} value={s}>
              {LANCAMENTO_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <LancamentoFormDialog
        escopoFixo={escopoFixo}
        naturezaFixa={naturezaFixa}
        cadastros={cadastros}
        lancamento={lancamento}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        }
      />

      <Dialog open={openDel} onOpenChange={setOpenDel}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Excluir">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lançamento?</DialogTitle>
            <DialogDescription>
              {isGrupo
                ? "Este lançamento faz parte de uma recorrência. Excluir somente este ou todos do grupo?"
                : "Esta ação não pode ser desfeita."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            {isGrupo ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => remover("este")}
                  disabled={busy}
                >
                  Somente este
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => remover("grupo")}
                  disabled={busy}
                >
                  Todos do grupo
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => remover("este")}
                disabled={busy}
              >
                Excluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
