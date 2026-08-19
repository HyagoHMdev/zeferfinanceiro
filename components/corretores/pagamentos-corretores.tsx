import Link from "next/link";
import { FileText, PenLine } from "lucide-react";

import type { CorretorPendente, PagamentoRealizado } from "@/lib/data/pagamentos";
import { salvarReciboPagamento } from "@/app/(app)/pagamentos/actions";
import { formatBRL, formatData } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrarPagamentoDialog } from "@/components/pagamentos/registrar-pagamento-dialog";
import { EstornarPagamentoButton } from "@/components/pagamentos/estornar-pagamento-button";
import { ReciboAssinado } from "@/components/recibo/recibo-assinado";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Pagamento das comissões, dentro da aba Corretores.
 *
 * Ficava em Pagamentos, junto com o dos colaboradores. Separar deixa cada tela
 * com um assunto: aqui é a vida da comissão do começo ao fim (venda, parcelas,
 * pagamento e recibo), e Pagamentos passa a ser só de colaborador.
 */
export function PagamentosCorretores({
  pendentes,
  realizados,
}: {
  pendentes: CorretorPendente[];
  realizados: PagamentoRealizado[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>A pagar</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {pendentes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma comissão liberada para pagamento. Em venda parcelada, a fatia
              só entra aqui depois que a construtora libera a parcela.
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
                    <TableCell className="font-medium">{c.corretorNome ?? "—"}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos realizados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {realizados.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento de comissão registrado ainda.
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
                    <TableCell className="whitespace-nowrap">{formatData(p.data)}</TableCell>
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
