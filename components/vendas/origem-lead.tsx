import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatData } from "@/lib/format";
import type { LeadDaVenda } from "@/lib/data/lead";

/**
 * De onde a venda veio, vindo do CRM pelo telefone do cliente.
 *
 * Responde duas perguntas que só o CRM sabe: por qual canal o cliente chegou
 * e há quanto tempo ele estava na base. O intervalo entre o primeiro contato
 * e a venda é o que diz se o ciclo foi curto ou se o lead ficou meses
 * maturando, e isso muda como se lê o custo da campanha.
 */
export function OrigemLead({
  lead,
  telefone,
  dataVenda,
}: {
  lead: LeadDaVenda | null;
  telefone: string | null;
  dataVenda: string | null;
}) {
  const dias =
    lead && dataVenda
      ? Math.round(
          (new Date(dataVenda).getTime() - new Date(lead.primeiroContato).getTime()) /
            86_400_000,
        )
      : null;

  const canal = [lead?.fonte, lead?.origemForm, lead?.utm].filter(Boolean).join(" · ");

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Origem do cliente</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {!lead ? (
          <p className="text-muted-foreground">
            {telefone?.trim()
              ? "Nenhum lead com este telefone no CRM. Venda de carteira, indicação ou contato que não passou pelo funil."
              : "Sem telefone na venda, então não há como cruzar com o CRM."}
          </p>
        ) : (
          <div className="space-y-1">
            <p>
              <span className="text-muted-foreground">Canal: </span>
              {canal || "não informado no CRM"}
            </p>
            <p>
              <span className="text-muted-foreground">Primeiro contato: </span>
              {formatData(lead.primeiroContato)}
              {dias !== null && dias >= 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {dias === 0 ? "fechou no mesmo dia" : `${dias} dias até a venda`}
                </span>
              )}
            </p>
            {lead.nome && (
              <p className="text-xs text-muted-foreground">
                Lead no CRM: {lead.nome}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
