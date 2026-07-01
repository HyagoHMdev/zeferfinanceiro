"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { alterarStatusVenda } from "@/app/(app)/vendas/actions";
import { STATUS_VENDA_LABEL, type VendaStatus } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCOES: VendaStatus[] = ["aguardando_recebimento", "recebido"];

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
      <SelectTrigger size="sm" className="w-48">
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
