import { requireRole } from "@/lib/auth";
import { listarComissoesCorretor } from "@/lib/data/corretores";
import { round2 } from "@/lib/calculos";
import { formatBRL, formatData } from "@/lib/format";
import { STATUS_PAGAMENTO_CORRETOR_LABEL } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MeuExtratoPage() {
  const { profile } = await requireRole(["corretor"]);

  if (!profile.corretor_id) {
    return (
      <div>
        <PageHeader title="Meu extrato" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Seu usuário ainda não está vinculado a um corretor. Fale com o
            financeiro.
          </CardContent>
        </Card>
      </div>
    );
  }

  const comissoes = await listarComissoesCorretor(profile.corretor_id);
  const total = round2(comissoes.reduce((s, c) => s + c.liquidoCorretor, 0));
  const pendente = round2(
    comissoes
      .filter((c) => c.statusPagamento === "aguardando_liberacao")
      .reduce((s, c) => s + c.liquidoCorretor, 0),
  );
  const pago = round2(total - pendente);

  return (
    <div>
      <PageHeader
        title="Meu extrato"
        description="Suas comissões por venda e status de pagamento."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total de comissões" value={total} />
        <KpiCard label="A receber" value={pendente} />
        <KpiCard label="Pago" value={pago} tone="positive" />
      </div>

      <Card>
        <CardContent className="px-0">
          {comissoes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Você ainda não tem comissões.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoes.map((c) => (
                  <TableRow key={c.vendaId}>
                    <TableCell className="font-medium">
                      {c.empreendimento ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatData(c.dataVenda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(c.liquidoCorretor)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.statusPagamento === "pago" ? "success" : "warning"
                        }
                      >
                        {STATUS_PAGAMENTO_CORRETOR_LABEL[c.statusPagamento]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
