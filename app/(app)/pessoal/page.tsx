import { Plus } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarLancamentos, carregarCadastrosLancamento } from "@/lib/data/financeiro";
import { round2 } from "@/lib/calculos";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { LancamentosTable } from "@/components/financeiro/lancamentos-table";
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog";

export const dynamic = "force-dynamic";

/**
 * Financeiro pessoal.
 *
 * Aba própria, e não um pedaço do módulo da empresa, porque nada aqui é criado
 * por automação: a entrada da empresa não repassa mais percentual nenhum para
 * cá. Tudo nesta tela é lançado à mão.
 *
 * Três blocos, que é como o dinheiro pessoal é pensado: o que entra, o que sai
 * todo mês (custo fixo) e o que varia (custo variável). A separação sai do
 * TIPO da categoria, então classificar um gasto é escolher a categoria certa.
 */
export default async function PessoalPage() {
  const [{ profile }, lancamentos, cadastros] = await Promise.all([
    requireRole(STAFF_ROLES),
    listarLancamentos({
      escopo: "pessoal",
      naturezas: ["entrada_pessoal", "saida_pessoal"],
    }),
    carregarCadastrosLancamento(),
  ]);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const tipoDaCategoria = new Map(cadastros.categorias.map((c) => [c.id, c.tipo]));
  const entradas = lancamentos.filter((l) => l.natureza === "entrada_pessoal");
  const saidas = lancamentos.filter((l) => l.natureza === "saida_pessoal");
  const fixos = saidas.filter(
    (l) => tipoDaCategoria.get(l.categoria_id ?? "") === "custo_fixo",
  );
  // Sem categoria cai em variável: é o balde mais honesto para um gasto solto.
  const variaveis = saidas.filter(
    (l) => tipoDaCategoria.get(l.categoria_id ?? "") !== "custo_fixo",
  );

  const soma = (linhas: typeof lancamentos) =>
    round2(linhas.reduce((s, l) => s + Number(l.valor), 0));
  const totalEntradas = soma(entradas);
  const totalFixos = soma(fixos);
  const totalVariaveis = soma(variaveis);

  return (
    <div>
      <PageHeader
        title="Pessoal"
        description="Suas entradas e saídas pessoais. Nada aqui vem da empresa por automação: tudo é lançado à mão."
        help={<OnboardingHelp screen="pessoal" />}
      >
        {podeEditar ? (
          <LancamentoFormDialog
            escopoFixo="pessoal"
            naturezaFixa="saida_pessoal"
            cadastros={cadastros}
            trigger={
              <Button>
                <Plus className="size-4" />
                Nova saída
              </Button>
            }
          />
        ) : null}
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard label="Entradas" value={totalEntradas} tone="positive" />
        <KpiCard label="Custo fixo" value={totalFixos} tone="negative" />
        <KpiCard label="Custo variável" value={totalVariaveis} tone="negative" />
        <KpiCard label="Sobra" value={round2(totalEntradas - totalFixos - totalVariaveis)} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Entradas</CardTitle>
            {podeEditar ? (
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
            ) : null}
          </CardHeader>
          <CardContent className="px-0">
            {entradas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma entrada lançada. Retirada da empresa, salário, aluguel recebido:
                tudo que entra no seu bolso é cadastrado aqui, na mão.
              </p>
            ) : (
              <LancamentosTable
                lancamentos={entradas}
                podeEditar={podeEditar}
                escopoFixo="pessoal"
                naturezaFixa="entrada_pessoal"
                cadastros={cadastros}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custo fixo</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {fixos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nada em custo fixo.
              </p>
            ) : (
              <LancamentosTable
                lancamentos={fixos}
                podeEditar={podeEditar}
                escopoFixo="pessoal"
                naturezaFixa="saida_pessoal"
                cadastros={cadastros}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custo variável</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {variaveis.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nada em custo variável.
              </p>
            ) : (
              <LancamentosTable
                lancamentos={variaveis}
                podeEditar={podeEditar}
                escopoFixo="pessoal"
                naturezaFixa="saida_pessoal"
                cadastros={cadastros}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
