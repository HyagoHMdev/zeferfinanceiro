"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { round2 } from "@/lib/calculos";
import { formatBRL, formatData } from "@/lib/format";
import { STATUS_PAGAMENTO_CORRETOR_LABEL } from "@/lib/types";
import type { ComissaoLinha } from "@/lib/data/corretores";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { CorretorStatusSelect } from "@/components/corretores/corretor-status-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TODOS = "__todos__";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 'YYYY-MM' -> 'agosto de 2026'. A data vem como texto, sem fuso no meio. */
function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} de ${ano}`;
}

export function ComissoesView({
  comissoes,
  podeEditar,
}: {
  comissoes: ComissaoLinha[];
  podeEditar: boolean;
}) {
  const [corretor, setCorretor] = useState(TODOS);
  const [empreendimento, setEmpreendimento] = useState(TODOS);
  const [mes, setMes] = useState(TODOS);

  // As opções saem dos próprios dados: filtro que oferece coisa sem resultado
  // só faz o usuário perder tempo.
  const opcoes = useMemo(() => {
    const nomes = new Set<string>();
    const emps = new Set<string>();
    const meses = new Set<string>();
    for (const c of comissoes) {
      if (c.corretorNome) nomes.add(c.corretorNome);
      if (c.empreendimento) emps.add(c.empreendimento);
      meses.add(c.dataVenda.slice(0, 7));
    }
    return {
      corretores: [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")),
      empreendimentos: [...emps].sort((a, b) => a.localeCompare(b, "pt-BR")),
      meses: [...meses].sort().reverse(),
    };
  }, [comissoes]);

  const filtradas = useMemo(
    () =>
      comissoes.filter(
        (c) =>
          (corretor === TODOS || c.corretorNome === corretor) &&
          (empreendimento === TODOS || c.empreendimento === empreendimento) &&
          (mes === TODOS || c.dataVenda.slice(0, 7) === mes),
      ),
    [comissoes, corretor, empreendimento, mes],
  );

  // Os indicadores seguem o filtro: o total do recorte é o que interessa
  // depois de escolher um corretor ou um mês.
  const totais = useMemo(() => {
    const total = round2(filtradas.reduce((s, c) => s + c.liquidoCorretor, 0));
    // Venda parcelada pode estar meio paga: somar por status jogaria o valor
    // cheio para um lado só.
    const pago = round2(filtradas.reduce((s, c) => s + c.liquidoPago, 0));
    return { total, pendente: round2(total - pago), pago };
  }, [filtradas]);

  const temFiltro = corretor !== TODOS || empreendimento !== TODOS || mes !== TODOS;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={temFiltro ? "Total de comissões (filtrado)" : "Total de comissões"}
          value={totais.total}
        />
        <KpiCard label="Aguardando liberação" value={totais.pendente} tone="negative" />
        <KpiCard label="Pago" value={totais.pago} tone="positive" />
      </div>

      <Card>
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
            <Select value={corretor} onValueChange={setCorretor}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os corretores</SelectItem>
                {opcoes.corretores.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={empreendimento} onValueChange={setEmpreendimento}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os empreendimentos</SelectItem>
                {opcoes.empreendimentos.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os meses</SelectItem>
                {opcoes.meses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {rotuloMes(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {temFiltro ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCorretor(TODOS);
                  setEmpreendimento(TODOS);
                  setMes(TODOS);
                }}
              >
                Limpar
              </Button>
            ) : null}

            <span className="ml-auto text-sm text-muted-foreground">
              {filtradas.length} de {comissoes.length}
            </span>
          </div>

          {filtradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {comissoes.length === 0
                ? "Nenhuma comissão de corretor ainda."
                : "Nenhuma comissão com esses filtros."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Líquido corretor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((c) => (
                  <TableRow key={c.chave}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(c.dataVenda)}
                    </TableCell>
                    <TableCell className="font-medium">{c.corretorNome ?? "—"}</TableCell>
                    <TableCell>
                      {c.empreendimento ?? "—"}
                      {c.unidade ? (
                        <span className="text-muted-foreground"> · {c.unidade}</span>
                      ) : null}
                      {c.parcelas && (
                        <span className="block text-xs text-muted-foreground">
                          {c.parcelas.total} parcelas · {c.parcelas.liberadas} liberadas
                          {c.parcelas.pagas > 0 ? ` · ${c.parcelas.pagas} pagas` : ""}
                        </span>
                      )}
                      {c.descontoParceria > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          desconto de parceria: {formatBRL(c.descontoParceria)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(c.liquidoCorretor)}
                    </TableCell>
                    <TableCell>
                      {podeEditar && !c.parcelas ? (
                        <CorretorStatusSelect vendaId={c.vendaId} status={c.statusPagamento} />
                      ) : (
                        <Badge
                          variant={c.statusPagamento === "pago" ? "success" : "warning"}
                        >
                          {STATUS_PAGAMENTO_CORRETOR_LABEL[c.statusPagamento]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/corretores/${c.vendaId}`}
                        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
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
                  <TableCell colSpan={3}>
                    Total{temFiltro ? " (filtrado)" : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totais.total)}
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
