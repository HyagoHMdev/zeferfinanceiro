"use client";

import { useMemo, useState } from "react";
import { Search, X, Pencil } from "lucide-react";

import { formatBRL, formatData, mesAbrev } from "@/lib/format";
import {
  ENTRADA_TIPO_LABEL,
  type Configuracoes,
  type Entrada,
  type EntradaTipo,
  type PercentualMensal,
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
import {
  EntradaFormDialog,
  type VendaDisponivel,
} from "@/components/entradas/entrada-form-dialog";
import { EntradaDelete } from "@/components/entradas/entrada-delete";

export interface EntradaRow extends Entrada {
  distribuicoes: {
    destino: "empresa" | "pessoal";
    valor: number;
    percentual: number;
  }[];
  vendas: {
    comissao_bruta: number;
    liquido_zefer: number;
    lucro_liquido: number;
  } | null;
}

const TODOS = "__todos__";
const TIPOS: EntradaTipo[] = [
  "comissao",
  "bonificacao",
  "premiacao",
  "investidor",
  "outras",
];

function mesLabel(ym: string): string {
  const [ano] = ym.split("-");
  return `${mesAbrev(`${ym}-01`)}/${ano}`;
}

export function EntradasTable({
  entradas,
  podeEditar,
  config,
  vendas,
  percentuaisMensais,
}: {
  entradas: EntradaRow[];
  podeEditar: boolean;
  config: Configuracoes;
  vendas: VendaDisponivel[];
  percentuaisMensais: PercentualMensal[];
}) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(TODOS);
  const [mes, setMes] = useState(TODOS);

  // Só os tipos e meses realmente presentes.
  const tiposOpts = useMemo(() => {
    const s = new Set<EntradaTipo>();
    for (const e of entradas) s.add(e.tipo);
    return TIPOS.filter((t) => s.has(t));
  }, [entradas]);

  const mesesOpts = useMemo(() => {
    const s = new Set<string>();
    for (const e of entradas) s.add(e.data.slice(0, 7));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [entradas]);

  const filtradas = useMemo(
    () =>
      entradas.filter(
        (e) =>
          (busca === "" ||
            (e.descricao ?? "").toLowerCase().includes(busca.toLowerCase())) &&
          (tipo === TODOS || e.tipo === tipo) &&
          (mes === TODOS || e.data.slice(0, 7) === mes),
      ),
    [entradas, busca, tipo, mes],
  );

  const distDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    e.distribuicoes?.find((d) => d.destino === destino);
  const valorDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    Number(distDe(e, destino)?.valor ?? 0);
  const percDe = (e: EntradaRow, destino: "empresa" | "pessoal") =>
    Number(distDe(e, destino)?.percentual ?? 0);

  const totalValor = filtradas.reduce((s, e) => s + Number(e.valor), 0);
  const totalLiquido = filtradas.reduce((s, e) => s + Number(e.liquido), 0);
  const totalEmpresa = filtradas.reduce((s, e) => s + valorDe(e, "empresa"), 0);
  const totalPessoal = filtradas.reduce((s, e) => s + valorDe(e, "pessoal"), 0);

  const temFiltro = busca !== "" || tipo !== TODOS || mes !== TODOS;

  function limpar() {
    setBusca("");
    setTipo(TODOS);
    setMes(TODOS);
  }

  if (entradas.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma entrada registrada.
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

        <Select value={mes} onValueChange={setMes}>
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

        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {tiposOpts.map((t) => (
              <SelectItem key={t} value={t}>
                {ENTRADA_TIPO_LABEL[t]}
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
          {filtradas.length} de {entradas.length}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma entrada com esses filtros.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Venda bruta</TableHead>
              <TableHead className="text-right">Pós imposto</TableHead>
              <TableHead className="text-right">Pós corr.+imp.</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Dízimo</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-right">Empresa</TableHead>
              <TableHead className="text-right">Pessoal</TableHead>
              {podeEditar ? <TableHead></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">
                  {formatData(e.data)}
                </TableCell>
                <TableCell>{ENTRADA_TIPO_LABEL[e.tipo]}</TableCell>
                <TableCell>{e.descricao ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {e.vendas ? formatBRL(e.vendas.comissao_bruta) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {e.vendas ? formatBRL(e.vendas.liquido_zefer) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {e.vendas ? formatBRL(e.vendas.lucro_liquido) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(e.valor)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatBRL(e.valor_dizimo)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(e.liquido)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(valorDe(e, "empresa"))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(valorDe(e, "pessoal"))}
                </TableCell>
                {podeEditar ? (
                  <TableCell>
                    <div className="flex justify-end">
                      <EntradaFormDialog
                        config={config}
                        vendas={vendas}
                        entrada={e}
                        percentuaisMensais={percentuaisMensais}
                        percentualEmpresaInicial={percDe(e, "empresa")}
                        percentualPessoalInicial={percDe(e, "pessoal")}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Editar">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <EntradaDelete id={e.id} />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6}>
                Total{temFiltro ? " (filtrado)" : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(totalValor)}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(totalLiquido)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(totalEmpresa)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(totalPessoal)}
              </TableCell>
              {podeEditar ? <TableCell></TableCell> : null}
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
