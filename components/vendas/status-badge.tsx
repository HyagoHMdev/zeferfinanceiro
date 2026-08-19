import { Badge } from "@/components/ui/badge";
import { STATUS_VENDA_LABEL, type VendaStatus } from "@/lib/types";

const VARIANT: Record<
  VendaStatus,
  "warning" | "success" | "default"
> = {
  aguardando_recebimento: "warning",
  // Ainda é dinheiro incompleto, então divide o âmbar com "aguardando": o
  // verde fica reservado para quando a última parcela cair.
  parcialmente_recebido: "warning",
  recebido: "success",
  pago: "default",
};

export function VendaStatusBadge({ status }: { status: VendaStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_VENDA_LABEL[status]}</Badge>;
}
