import { Badge } from "@/components/ui/badge";
import { LANCAMENTO_STATUS_LABEL, type LancamentoStatus } from "@/lib/types";

const VARIANT: Record<LancamentoStatus, "success" | "warning" | "destructive"> = {
  pago: "success",
  pendente: "warning",
  atrasado: "destructive",
};

export function LancamentoStatusBadge({ status }: { status: LancamentoStatus }) {
  return <Badge variant={VARIANT[status]}>{LANCAMENTO_STATUS_LABEL[status]}</Badge>;
}
