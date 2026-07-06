"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { alterarStatusVenda } from "@/app/(app)/vendas/actions";
import { cn } from "@/lib/utils";
import { STATUS_VENDA_LABEL, type VendaStatus } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCOES: VendaStatus[] = ["aguardando_recebimento", "recebido"];

// Mesmas cores do badge de status (âmbar → verde → dourado).
// dark:bg-* explícito para sobrepor o dark:bg-input/30 padrão do SelectTrigger.
const COR: Record<VendaStatus, string> = {
  aguardando_recebimento: "bg-warning text-black border-transparent dark:bg-warning",
  recebido: "bg-success text-white border-transparent dark:bg-success",
  pago: "bg-primary text-primary-foreground border-transparent dark:bg-primary",
};

export function VendaStatusSelect({
  id,
  status,
}: {
  id: string;
  status: VendaStatus;
}) {
  const router = useRouter();
  const [st, setSt] = useState<VendaStatus>(
    status === "pago" ? "recebido" : status,
  );
  const [busy, setBusy] = useState(false);

  async function onChange(value: string) {
    const novo = value as VendaStatus;
    const anterior = st;
    setSt(novo);
    setBusy(true);
    const res = await alterarStatusVenda(id, novo);
    setBusy(false);
    if (res?.error) {
      toast.error("Erro ao mudar o status", { description: res.error });
      setSt(anterior);
    } else {
      router.refresh();
    }
  }

  return (
    <Select value={st} onValueChange={onChange} disabled={busy}>
      <SelectTrigger
        size="sm"
        className={cn("w-48 font-medium", COR[st])}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPCOES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_VENDA_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
