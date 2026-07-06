import { carregarFluxoAnual } from "@/lib/data/financeiro";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function FluxoPage() {
  const ano = new Date().getUTCFullYear();
  const fluxo = await carregarFluxoAnual(ano);

  const totalEntradas = fluxo.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = fluxo.reduce((s, m) => s + m.saidas, 0);
  const totalSaldo = totalEntradas - totalSaidas;

  return (
    <div>
      <PageHeader
        title="Fluxo de Caixa"
        description={`Entradas e saídas da empresa, mês a mês — ${ano}.`}
        help={<OnboardingHelp screen="financeiro-fluxo" />}
      />
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fluxo.map((m) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium">{m.mes}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(m.entradas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(m.saidas)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${m.saldo < 0 ? "text-destructive" : ""}`}
                  >
                    {formatBRL(m.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total {ano}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(totalEntradas)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(totalSaidas)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(totalSaldo)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
