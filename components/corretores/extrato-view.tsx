import { formatBRL, formatData } from "@/lib/format";
import type { ExtratoData } from "@/lib/data/extrato";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendaStatusBadge } from "@/components/vendas/status-badge";
import { CorretorAcoes } from "@/components/corretores/corretor-acoes";
import { ItemDelete } from "@/components/corretores/item-delete";

export function ExtratoView({
  data,
  podeEditar,
}: {
  data: ExtratoData;
  podeEditar: boolean;
}) {
  const { corretor, comissoes, adiantamentos, bonificacoes, pagamentos, kpis } =
    data;

  const temPendencia =
    kpis.comissoesPendentes > 0 ||
    kpis.bonificacoesPendentes > 0 ||
    kpis.adiantamentosPendentes > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="Saldo disponível"
          value={kpis.saldoDisponivel}
          tone={kpis.saldoDisponivel >= 0 ? "positive" : "negative"}
        />
        <KpiCard label="Comissões pendentes" value={kpis.comissoesPendentes} />
        <KpiCard label="Comissões pagas" value={kpis.comissoesPagas} />
        <KpiCard label="Adiantamentos" value={kpis.adiantamentosPendentes} />
        <KpiCard label="Bonificações" value={kpis.bonificacoesPendentes} />
      </div>

      {podeEditar ? (
        <CorretorAcoes
          corretorId={corretor.id}
          resumo={{
            valorBruto: kpis.comissoesPendentes,
            totalBonificacoes: kpis.bonificacoesPendentes,
            totalAdiantamentos: kpis.adiantamentosPendentes,
            valorLiquido: kpis.saldoDisponivel,
            temPendencia,
          }}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Comissões</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {comissoes.length === 0 ? (
            <Vazio texto="Nenhuma comissão." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Líquido corretor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(c.data_venda)}
                    </TableCell>
                    <TableCell>{c.empreendimento ?? "—"}</TableCell>
                    <TableCell>{c.cliente ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(c.liquido_corretor)}
                    </TableCell>
                    <TableCell>
                      <VendaStatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Adiantamentos</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {adiantamentos.length === 0 ? (
              <Vazio texto="Nenhum adiantamento." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adiantamentos.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatData(a.data)}
                      </TableCell>
                      <TableCell>{a.descricao ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(a.valor)}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.pagamento_id ? (
                          <Badge variant="secondary">Pago</Badge>
                        ) : podeEditar ? (
                          <ItemDelete
                            tipo="adiantamento"
                            id={a.id}
                            corretorId={corretor.id}
                          />
                        ) : (
                          <Badge variant="warning">Em aberto</Badge>
                        )}
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
            <CardTitle>Bonificações</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {bonificacoes.length === 0 ? (
              <Vazio texto="Nenhuma bonificação." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonificacoes.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatData(b.data)}
                      </TableCell>
                      <TableCell>{b.motivo ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(b.valor)}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.pagamento_id ? (
                          <Badge variant="secondary">Pago</Badge>
                        ) : podeEditar ? (
                          <ItemDelete
                            tipo="bonificacao"
                            id={b.id}
                            corretorId={corretor.id}
                          />
                        ) : (
                          <Badge variant="warning">Em aberto</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {pagamentos.length === 0 ? (
            <Vazio texto="Nenhum pagamento registrado." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Bonificações</TableHead>
                  <TableHead className="text-right">Adiantamentos</TableHead>
                  <TableHead className="text-right">Líquido pago</TableHead>
                  <TableHead className="text-right">Recibo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(p.data)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.valor_bruto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.total_bonificacoes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(p.total_adiantamentos)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBRL(p.valor_liquido)}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/recibo/pagamento/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Abrir
                      </a>
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

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">{texto}</div>
  );
}
