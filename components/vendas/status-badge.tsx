import { Badge } from "@/components/ui/badge";
import { STATUS_VENDA_LABEL, type VendaStatus } from "@/lib/types";

const VARIANT: Record<
  VendaStatus,
  "warning" | "secondary" | "success"
> = {
  aguardando_recebimento: "warning",
  recebido: "secondary",
  pago: "success",
};

export function VendaStatusBadge({ status }: { status: VendaStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_VENDA_LABEL[status]}</Badge>;
}
