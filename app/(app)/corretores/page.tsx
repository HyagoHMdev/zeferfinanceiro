import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarComissoesCorretor } from "@/lib/data/corretores";
import { round2 } from "@/lib/calculos";
import { formatBRL, formatData } from "@/lib/format";
import { STATUS_PAGAMENTO_CORRETOR_LABEL } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { CorretorStatusSelect } from "@/components/corretores/corretor-status-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CorretoresPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const comissoes = await listarComissoesCorretor();
  const totalGeral = round2(comissoes.reduce((s, c) => s + c.liquidoCorretor, 0));
  const pendente = round2(
    comissoes
      .filter((c) => c.statusPagamento === "aguardando_liberacao")
      .reduce((s, c) => s + c.liquidoCorretor, 0),
  );
  const pago = round2(totalGeral - pendente);

  return (
    <div>
      <PageHeader
        title="Corretores"
        description="Comissões por venda e status de pagamento."
        help={<OnboardingHelp screen="corretores" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total de comissões" value={totalGeral} />
        <KpiCard label="Aguardando liberação" value={pendente} tone="negative" />
        <KpiCard label="Pago" value={pago} tone="positive" />
      </div>

      <Card>
        <CardContent className="px-0">
          {comissoes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma comissão de corretor ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Líquido corretor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoes.map((c) => (
                  <TableRow key={c.vendaId}>
                    <TableCell className="font-medium">
                      {c.corretorNome ?? "—"}
                    </TableCell>
                    <TableCell>{c.empreendimento ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatData(c.dataVenda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(c.liquidoCorretor)}
                    </TableCell>
                    <TableCell>
                      {podeEditar ? (
                        <CorretorStatusSelect
                          vendaId={c.vendaId}
                          status={c.statusPagamento}
                        />
                      ) : (
                        <Badge
                          variant={
                            c.statusPagamento === "pago" ? "success" : "warning"
                          }
                        >
                          {STATUS_PAGAMENTO_CORRETOR_LABEL[c.statusPagamento]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/corretores/${c.vendaId}`}
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        Processar
                        <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totalGeral)}
                  </TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
