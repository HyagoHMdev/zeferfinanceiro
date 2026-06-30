import { formatBRL, formatData, mesAbrev } from "@/lib/format";
import type { LancamentoRow } from "@/lib/data/financeiro";
import type { CadastrosLancamento } from "@/lib/data/financeiro";
import type { LancamentoEscopo, LancamentoNatureza } from "@/lib/types";
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
  if (lancamentos.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum lançamento.
      </div>
    );
  }

  const total = lancamentos.reduce((s, l) => s + Number(l.valor), 0);

  return (
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
        {lancamentos.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="whitespace-nowrap">
              {competenciaLabel(l.competencia)}
            </TableCell>
            <TableCell className="font-medium">{l.descricao}</TableCell>
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
                <LancamentoStatusBadge status={l.status} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>Total</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatBRL(total)}
          </TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
