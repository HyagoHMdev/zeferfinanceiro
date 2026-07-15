import Link from "next/link";
import { FileText, PenLine } from "lucide-react";

import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import {
  listarPagamentosPendentes,
  listarPagamentosRealizados,
} from "@/lib/data/pagamentos";
import { salvarReciboPagamento } from "@/app/(app)/pagamentos/actions";
import { round2 } from "@/lib/calculos";
import { formatBRL, formatData } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegistrarPagamentoDialog } from "@/components/pagamentos/registrar-pagamento-dialog";
import { EstornarPagamentoButton } from "@/components/pagamentos/estornar-pagamento-button";
import { ReciboAssinado } from "@/components/recibo/recibo-assinado";

export default async function PagamentosPage() {
  const [, pendentes, realizados] = await Promise.all([
    requireRole(ADMIN_FIN_ROLES),
    listarPagamentosPendentes(),
    listarPagamentosRealizados(),
  ]);

  const totalAPagar = round2(pendentes.reduce((s, c) => s + c.liquido, 0));
  const totalPago = round2(realizados.reduce((s, p) => s + p.valorLiquido, 0));

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description="Pague as comissões dos corretores e gere os recibos."
        help={<OnboardingHelp screen="pagamentos" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="A pagar (líquido)" value={totalAPagar} tone="negative" />
        <KpiCard
          label="Corretores pendentes"
          value={pendentes.length}
          currency={false}
        />
        <KpiCard label="Total pago" value={totalPago} tone="positive" />
      </div>

      {/* A pagar --------------------------------------------------------- */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>A pagar</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {pendentes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma comissão aguardando liberação.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">Comissões</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Adiantamentos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((c) => (
                  <TableRow key={c.corretorId}>
                    <TableCell className="font-medium">
                      {c.corretorNome ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.comissoes.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(c.totalBruto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.totalAdiantamentos > 0
                        ? `- ${formatBRL(c.totalAdiantamentos)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBRL(c.liquido)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RegistrarPagamentoDialog corretor={c} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Realizados ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos realizados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {realizados.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Adiantamentos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realizados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(p.data)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {p.corretorNome ?? "—"}
                        {p.assinado ? (
                          <Badge
                            variant="success"
                            className="gap-1 px-1.5 py-0 text-[10px] font-normal"
                          >
                            <PenLine className="size-3" />
                            Assinado
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.valorBruto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.totalAdiantamentos > 0
                        ? `- ${formatBRL(p.totalAdiantamentos)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBRL(p.valorLiquido)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/recibo/pagamento/${p.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <FileText className="size-4" />
                          Recibo
                        </Link>
                        <ReciboAssinado
                          id={p.id}
                          value={p.reciboUrl}
                          salvar={salvarReciboPagamento}
                        />
                        <EstornarPagamentoButton pagamentoId={p.id} />
                      </div>
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
