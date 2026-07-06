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
import {
  LANCAMENTO_STATUS_LABEL,
  type LancamentoEscopo,
  type LancamentoNatureza,
  type LancamentoStatus,
} from "@/lib/types";
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

function competenciaLabel(iso: string): string {
  const d = new Date(iso);
  return `${mesAbrev(iso)}/${d.getUTCFullYear()}`;
}

export function LancamentosTable({
  lancamentos,
  podeEditar,
  escopoFixo,
  naturezaFixa,
  cadastros,
}: {
  lancamentos: LancamentoRow[];
  podeEditar: boolean;
  escopoFixo: LancamentoEscopo;
  naturezaFixa?: LancamentoNatureza;
  cadastros: CadastrosLancamento;
}) {
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState(TODOS);
  const [status, setStatus] = useState(TODOS);
  const [competencia, setCompetencia] = useState(TODOS);

  // Opções dinâmicas: só os valores realmente presentes nos lançamentos.
  const categoriasOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lancamentos) {
      if (l.categoria_id && l.categorias_financeiras?.nome)
        m.set(l.categoria_id, l.categorias_financeiras.nome);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [lancamentos]);

  const statusOpts = useMemo(() => {
    const s = new Set<LancamentoStatus>();
    for (const l of lancamentos) s.add(l.status);
    return [...s];
  }, [lancamentos]);

  const mesesOpts = useMemo(() => {
    const s = new Set<string>();
    for (const l of lancamentos) s.add(l.competencia.slice(0, 7));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [lancamentos]);

  const filtrados = useMemo(
    () =>
      lancamentos.filter(
        (l) =>
          (busca === "" ||
            l.descricao.toLowerCase().includes(busca.toLowerCase())) &&
          (categoriaId === TODOS || l.categoria_id === categoriaId) &&
          (status === TODOS || l.status === status) &&
          (competencia === TODOS || l.competencia.slice(0, 7) === competencia),
      ),
    [lancamentos, busca, categoriaId, status, competencia],
  );

  const total = filtrados.reduce((s, l) => s + Number(l.valor), 0);
  const temFiltro =
    busca !== "" ||
    categoriaId !== TODOS ||
    status !== TODOS ||
    competencia !== TODOS;

  function limpar() {
    setBusca("");
    setCategoriaId(TODOS);
    setStatus(TODOS);
    setCompetencia(TODOS);
  }

  if (lancamentos.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum lançamento.
      </div>
    );
  }

  return (
    <div>
      {/* Barra de filtros (estilo tabela dinâmica) */}
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

        <Select value={competencia} onValueChange={setCompetencia}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os meses</SelectItem>
            {mesesOpts.map((m) => (
              <SelectItem key={m} value={m}>
                {competenciaLabel(`${m}-01`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoriaId} onValueChange={setCategoriaId}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as categorias</SelectItem>
            {categoriasOpts.map(([id, nome]) => (
              <SelectItem key={id} value={id}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {statusOpts.map((s) => (
              <SelectItem key={s} value={s}>
                {LANCAMENTO_STATUS_LABEL[s]}
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
          Nenhum lançamento com esses filtros.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competência</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap">
                  {competenciaLabel(l.competencia)}
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
                <TableCell className="whitespace-nowrap">
                  {l.data_vencimento ? formatData(l.data_vencimento) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(l.valor)}
                </TableCell>
                <TableCell className="text-right">
                  {podeEditar ? (
                    <LancamentoRowActions
                      lancamento={l}
                      escopoFixo={escopoFixo}
                      naturezaFixa={naturezaFixa}
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
                Total{temFiltro ? " (filtrado)" : ""}
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
