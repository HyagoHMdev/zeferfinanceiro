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
import type { CadastrosLancamento } from "@/lib/data/financeiro";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog";

const STATUS: LancamentoStatus[] = ["pendente", "pago", "atrasado"];

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
  const [status, setStatus] = useState<LancamentoStatus>(lancamento.status);
  const [busy, setBusy] = useState(false);

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

  async function remover() {
    setBusy(true);
    const res = await excluirLancamento(lancamento.id);
    setBusy(false);
    if (res?.error) {
      toast.error("Erro ao excluir", { description: res.error });
      return;
    }
    toast.success("Lançamento excluído");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Select value={status} onValueChange={mudarStatus} disabled={busy}>
        <SelectTrigger size="sm" className="w-32">
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

      <Button
        variant="ghost"
        size="icon"
        onClick={remover}
        disabled={busy}
        aria-label="Excluir"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
