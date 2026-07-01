"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { alterarStatusPagamentoCorretor } from "@/app/(app)/corretores/actions";
import {
  STATUS_PAGAMENTO_CORRETOR_LABEL,
  type StatusPagamentoCorretor,
} from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCOES: StatusPagamentoCorretor[] = ["aguardando_liberacao", "pago"];

export function CorretorStatusSelect({
  vendaId,
  status,
}: {
  vendaId: string;
  status: StatusPagamentoCorretor;
}) {
  const router = useRouter();
  const [st, setSt] = useState<StatusPagamentoCorretor>(status);
  const [busy, setBusy] = useState(false);

  async function onChange(value: string) {
    const novo = value as StatusPagamentoCorretor;
    const anterior = st;
    setSt(novo);
    setBusy(true);
    const res = await alterarStatusPagamentoCorretor(vendaId, novo);
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
      <SelectTrigger size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPCOES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_PAGAMENTO_CORRETOR_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
