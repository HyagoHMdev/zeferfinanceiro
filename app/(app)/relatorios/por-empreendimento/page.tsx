import { relatorioPorEmpreendimento } from "@/lib/data/relatorios";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
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

export default async function RelatorioPorEmpreendimentoPage() {
  const linhas = await relatorioPorEmpreendimento();
  const totUnidades = linhas.reduce((s, l) => s + l.unidades, 0);
  const totVgv = linhas.reduce((s, l) => s + l.vgv, 0);
  const totComissao = linhas.reduce((s, l) => s + l.comissao, 0);
  const ticketGeral = totUnidades > 0 ? totVgv / totUnidades : 0;

  return (
    <div>
      <PageHeader
        title="Comissão por empreendimento"
        description="Unidades vendidas, comissão e ticket médio."
      />
      <Card>
        <CardContent className="px-0">
          {linhas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Sem dados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">VGV</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.nome}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.unidades}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(l.vgv)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(l.comissao)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(l.ticketMedio)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{totUnidades}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(totVgv)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(totComissao)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(ticketGeral)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
