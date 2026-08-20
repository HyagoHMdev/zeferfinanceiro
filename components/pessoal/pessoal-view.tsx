"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";

import { round2 } from "@/lib/calculos";
import { mesAbrev } from "@/lib/format";
import type { CadastrosLancamento, LancamentoRow } from "@/lib/data/financeiro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { LancamentosTable } from "@/components/financeiro/lancamentos-table";
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODOS = "__todos__";

function mesLabel(ym: string): string {
  const [ano] = ym.split("-");
  return `${mesAbrev(`${ym}-01`)}/${ano}`;
}

/** Um bloco que abre e fecha. Fechado, mostra só o título e o total. */
function Bloco({
  titulo,
  total,
  linhas,
  cadastros,
  podeEditar,
  natureza,
  vazio,
  acao,
  abertoInicial = true,
}: {
  titulo: string;
  total: number;
  linhas: LancamentoRow[];
  cadastros: CadastrosLancamento;
  podeEditar: boolean;
  natureza: "entrada_pessoal" | "saida_pessoal";
  vazio: string;
  acao?: React.ReactNode;
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={aberto}
        >
          {aberto ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <CardTitle>{titulo}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {linhas.length} · {brl.format(total)}
          </span>
        </button>
        {acao}
      </CardHeader>
      {aberto ? (
        <CardContent className="px-0">
          {linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{vazio}</p>
          ) : (
            <LancamentosTable
              lancamentos={linhas}
              podeEditar={podeEditar}
              escopoFixo="pessoal"
              naturezaFixa={natureza}
              cadastros={cadastros}
            />
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function PessoalView({
  lancamentos,
  cadastros,
  podeEditar,
}: {
  lancamentos: LancamentoRow[];
  cadastros: CadastrosLancamento;
  podeEditar: boolean;
}) {
  const [mes, setMes] = useState(TODOS);

  const meses = useMemo(() => {
    const s = new Set<string>();
    for (const l of lancamentos) s.add(l.competencia.slice(0, 7));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [lancamentos]);

  const filtrados = useMemo(
    () => (mes === TODOS ? lancamentos : lancamentos.filter((l) => l.competencia.slice(0, 7) === mes)),
    [lancamentos, mes],
  );

  // Fixo x variável sai do TIPO da categoria; sem categoria conta como
  // variável, que é o balde mais honesto para um gasto solto.
  const grupos = useMemo(() => {
    const tipo = new Map(cadastros.categorias.map((c) => [c.id, c.tipo]));
    const entradas = filtrados.filter((l) => l.natureza === "entrada_pessoal");
    const saidas = filtrados.filter((l) => l.natureza === "saida_pessoal");
    return {
      entradas,
      fixos: saidas.filter((l) => tipo.get(l.categoria_id ?? "") === "custo_fixo"),
      variaveis: saidas.filter((l) => tipo.get(l.categoria_id ?? "") !== "custo_fixo"),
    };
  }, [filtrados, cadastros]);

  const soma = (linhas: LancamentoRow[]) =>
    round2(linhas.reduce((s, l) => s + Number(l.valor), 0));
  const totalEntradas = soma(grupos.entradas);
  const totalFixos = soma(grupos.fixos);
  const totalVariaveis = soma(grupos.variaveis);
  const sufixo = mes === TODOS ? "" : ` · ${mesLabel(mes)}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os meses</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                {mesLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mes !== TODOS ? (
          <Button variant="ghost" size="sm" onClick={() => setMes(TODOS)}>
            <X className="size-4" />
            Limpar
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} de {lancamentos.length} lançamentos
        </span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard label={`Entradas${sufixo}`} value={totalEntradas} tone="positive" />
        <KpiCard label={`Custo fixo${sufixo}`} value={totalFixos} tone="negative" />
        <KpiCard label={`Custo variável${sufixo}`} value={totalVariaveis} tone="negative" />
        <KpiCard
          label="Sobra"
          value={round2(totalEntradas - totalFixos - totalVariaveis)}
        />
      </div>

      <div className="space-y-4">
        <Bloco
          titulo="Entradas"
          total={totalEntradas}
          linhas={grupos.entradas}
          cadastros={cadastros}
          podeEditar={podeEditar}
          natureza="entrada_pessoal"
          vazio="Nenhuma entrada lançada. Retirada da empresa, salário, aluguel recebido: tudo que entra no seu bolso é cadastrado aqui, na mão."
          acao={
            podeEditar ? (
              <LancamentoFormDialog
                escopoFixo="pessoal"
                naturezaFixa="entrada_pessoal"
                cadastros={cadastros}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="size-4" />
                    Nova entrada
                  </Button>
                }
              />
            ) : null
          }
        />

        <Bloco
          titulo="Custo fixo"
          total={totalFixos}
          linhas={grupos.fixos}
          cadastros={cadastros}
          podeEditar={podeEditar}
          natureza="saida_pessoal"
          vazio="Nada em custo fixo neste recorte."
        />

        <Bloco
          titulo="Custo variável"
          total={totalVariaveis}
          linhas={grupos.variaveis}
          cadastros={cadastros}
          podeEditar={podeEditar}
          natureza="saida_pessoal"
          vazio="Nada em custo variável neste recorte."
        />
      </div>
    </div>
  );
}
