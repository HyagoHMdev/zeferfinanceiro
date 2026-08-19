import Link from "next/link";
import { FileText, PenLine } from "lucide-react";

import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarPagamentosRealizados } from "@/lib/data/pagamentos";
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
import { createClient } from "@/lib/supabase/server";
import { RegistrarPagamentoDialog } from "@/components/pagamentos/registrar-pagamento-dialog";
import {
  PagarFuncionarioDialog,
  type AdiantamentoAberto,
  type ContaAberta,
} from "@/components/pagamentos/pagar-funcionario-dialog";
import { EstornarPagamentoButton } from "@/components/pagamentos/estornar-pagamento-button";
import { ReciboAssinado } from "@/components/recibo/recibo-assinado";

export default async function PagamentosPage() {
  const [, realizados] = await Promise.all([
    requireRole(ADMIN_FIN_ROLES),
    // Só os de colaborador: a comissão do corretor virou assunto da aba
    // Corretores, do fechamento da venda ao recibo.
    listarPagamentosRealizados("funcionario"),
  ]);

  // Funcionário não tem comissão de venda, então não entra na lista de cima.
  // Aqui ele aparece sempre, com os adiantamentos em aberto ao lado.
  const supabase = await createClient();
  const [funcRes, adiRes, contasRes] = await Promise.all([
    supabase
      .from("corretores")
      .select("id, nome")
      .eq("tipo", "funcionario")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("adiantamentos")
      .select("id, corretor_id, data, valor, descricao")
      .is("pagamento_id", null)
      .order("data"),
    // Contas a pagar em aberto de cada colaborador (o salário do mês, tipicamente).
    // Pagar tem que baixar essas, não criar uma despesa nova ao lado.
    supabase
      .from("lancamentos")
      .select("id, colaborador_id, descricao, valor, competencia, data_vencimento")
      .not("colaborador_id", "is", null)
      .neq("status", "pago")
      .order("competencia"),
  ]);

  const adiPorPessoa = new Map<string, AdiantamentoAberto[]>();
  for (const a of (adiRes.data ?? []) as (AdiantamentoAberto & { corretor_id: string })[]) {
    const lista = adiPorPessoa.get(a.corretor_id) ?? [];
    lista.push({ id: a.id, data: a.data, valor: Number(a.valor), descricao: a.descricao });
    adiPorPessoa.set(a.corretor_id, lista);
  }
  const contasPorPessoa = new Map<string, ContaAberta[]>();
  for (const c of (contasRes.data ?? []) as {
    id: string;
    colaborador_id: string;
    descricao: string;
    valor: number;
    competencia: string;
    data_vencimento: string | null;
  }[]) {
    const lista = contasPorPessoa.get(c.colaborador_id) ?? [];
    lista.push({
      id: c.id,
      descricao: c.descricao,
      valor: Number(c.valor),
      competencia: c.competencia,
      dataVencimento: c.data_vencimento,
    });
    contasPorPessoa.set(c.colaborador_id, lista);
  }

  const funcionarios = ((funcRes.data ?? []) as { id: string; nome: string }[]).map((f) => ({
    ...f,
    adiantamentos: adiPorPessoa.get(f.id) ?? [],
    contas: contasPorPessoa.get(f.id) ?? [],
  }));

  const totalPago = round2(realizados.reduce((s, p) => s + p.valorLiquido, 0));

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description="Pagamento dos colaboradores: salário, contas em aberto e adiantamentos. Comissão de corretor fica em Corretores."
        help={<OnboardingHelp screen="pagamentos" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Colaboradores" value={funcionarios.length} currency={false} />
        <KpiCard label="Total pago" value={totalPago} tone="positive" />
      </div>

      {/* Funcionários ----------------------------------------------------- */}
      {funcionarios.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Funcionários</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pagamento com valor informado (não vem de comissão). Os
              adiantamentos descontados voltam para o caixa.
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Adiantamentos em aberto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcionarios.map((f) => {
                  const total = f.adiantamentos.reduce((s, a) => s + a.valor, 0);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {total > 0 ? (
                          <>
                            {formatBRL(total)}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({f.adiantamentos.length})
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PagarFuncionarioDialog
                          funcionarioId={f.id}
                          nome={f.nome}
                          adiantamentos={f.adiantamentos}
                          contas={f.contas}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Realizados ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos realizados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {realizados.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento de colaborador registrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaborador</TableHead>
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
