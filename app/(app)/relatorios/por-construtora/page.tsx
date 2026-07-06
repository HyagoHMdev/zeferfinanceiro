import { relatorioPorConstrutora } from "@/lib/data/relatorios";
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

export default async function RelatorioPorConstrutoraPage() {
  const linhas = await relatorioPorConstrutora();
  const tot = linhas.reduce(
    (a, l) => ({ vendas: a.vendas + l.vendas, vgv: a.vgv + l.vgv, comissao: a.comissao + l.comissao }),
    { vendas: 0, vgv: 0, comissao: 0 },
  );

  return (
    <div>
      <PageHeader title="Comissão por construtora" description="Vendas, VGV e comissão total por construtora." help={<OnboardingHelp screen="relatorios" />} />
      <Card>
        <CardContent className="px-0">
          {linhas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Sem dados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Construtora</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">VGV</TableHead>
                  <TableHead className="text-right">Comissão total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.nome}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.vendas}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(l.vgv)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(l.comissao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{tot.vendas}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(tot.vgv)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(tot.comissao)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
