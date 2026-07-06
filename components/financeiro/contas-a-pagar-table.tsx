"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import {
  formatBRL,
  formatData,
  mesAbrev,
  statusLancamentoEfetivo,
} from "@/lib/format";
import type { LancamentoRow, CadastrosLancamento } from "@/lib/data/financeiro";
import type { LancamentoNatureza } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { LancamentoStatusBadge } from "@/components/financeiro/lancamento-status-badge";
import { LancamentoRowActions } from "@/components/financeiro/lancamento-row-actions";

const TODOS = "__todos__";

const NATUREZA_LABEL: Record<LancamentoNatureza, string> = {
  custo_fixo: "Custo fixo",
  despesa_variavel: "Despesa variável",
  investimento: "Investimento",
  saida_pessoal: "Pessoal",
  entrada_pessoal: "Entrada",
};

function mesLabel(ym: string): string {
  const [ano] = ym.split("-");
  return `${mesAbrev(`${ym}-01`)}/${ano}`;
}

export function ContasAPagarTable({
  lancamentos,
  podeEditar,
  cadastros,
}: {
  lancamentos: LancamentoRow[];
  podeEditar: boolean;
  cadastros: CadastrosLancamento;
}) {
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState(TODOS);
  const [dia, setDia] = useState(TODOS);

  // Meses de vencimento presentes, mais próximos primeiro.
  const mesesOpts = useMemo(() => {
    const s = new Set<string>();
    for (const l of lancamentos)
      if (l.data_vencimento) s.add(l.data_vencimento.slice(0, 7));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [lancamentos]);

  // Dias presentes (respeitando o mês selecionado), em ordem numérica.
  const diasOpts = useMemo(() => {
    const s = new Set<string>();
    for (const l of lancamentos) {
      if (!l.data_vencimento) continue;
      if (mes !== TODOS && l.data_vencimento.slice(0, 7) !== mes) continue;
      s.add(l.data_vencimento.slice(8, 10));
    }
    return [...s].sort((a, b) => Number(a) - Number(b));
  }, [lancamentos, mes]);

  const filtrados = useMemo(
    () =>
      lancamentos.filter((l) => {
        if (
          busca !== "" &&
          !l.descricao.toLowerCase().includes(busca.toLowerCase())
        )
          return false;
        if (mes !== TODOS) {
          if (!l.data_vencimento || l.data_vencimento.slice(0, 7) !== mes)
            return false;
        }
        if (dia !== TODOS) {
          if (!l.data_vencimento || l.data_vencimento.slice(8, 10) !== dia)
            return false;
        }
        return true;
      }),
    [lancamentos, busca, mes, dia],
  );

  const total = filtrados.reduce((s, l) => s + Number(l.valor), 0);
  const temFiltro = busca !== "" || mes !== TODOS || dia !== TODOS;

  function limpar() {
    setBusca("");
    setMes(TODOS);
    setDia(TODOS);
  }

  function onMes(v: string) {
    setMes(v);
    setDia(TODOS); // dias dependem do mês
  }

  if (lancamentos.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nada a pagar. 🎉
      </div>
    );
  }

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar descrição..."
            className="h-8 w-52 pl-8"
          />
        </div>

        <Select value={mes} onValueChange={onMes}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os meses</SelectItem>
            {mesesOpts.map((m) => (
              <SelectItem key={m} value={m}>
                {mesLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dia} onValueChange={setDia}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os dias</SelectItem>
            {diasOpts.map((d) => (
              <SelectItem key={d} value={d}>
                Dia {Number(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {temFiltro ? (
          <Button variant="ghost" size="sm" onClick={limpar}>
            <X className="size-4" />
            Limpar
          </Button>
        ) : null}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} de {lancamentos.length}
        </span>
      </div>

      {filtrados.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma conta com esses filtros.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap">
                  {l.data_vencimento ? formatData(l.data_vencimento) : "—"}
                </TableCell>
                <TableCell className="font-medium">
                  {l.descricao}
                  {l.observacoes ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {l.observacoes}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{l.categorias_financeiras?.nome ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {NATUREZA_LABEL[l.natureza] ?? l.natureza}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(l.valor)}
                </TableCell>
                <TableCell className="text-right">
                  {podeEditar ? (
                    <LancamentoRowActions
                      lancamento={l}
                      escopoFixo={l.escopo}
                      naturezaFixa={l.natureza}
                      cadastros={cadastros}
                    />
                  ) : (
                    <LancamentoStatusBadge
                      status={statusLancamentoEfetivo(l.status, l.data_vencimento)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>
                Total a pagar{temFiltro ? " (filtrado)" : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(total)}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
