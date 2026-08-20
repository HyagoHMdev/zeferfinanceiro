import { Plus } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarLancamentos, carregarCadastrosLancamento } from "@/lib/data/financeiro";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog";
import { PessoalView } from "@/components/pessoal/pessoal-view";

export const dynamic = "force-dynamic";

/**
 * Financeiro pessoal.
 *
 * Aba própria, e não um pedaço do módulo da empresa, porque nada aqui é criado
 * por automação: a entrada da empresa não repassa mais percentual nenhum para
 * cá. Tudo nesta tela é lançado à mão.
 *
 * A página só busca; o recorte por mês e o abre/fecha dos blocos são estado de
 * tela e vivem na view.
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

      <PessoalView
        lancamentos={lancamentos}
        cadastros={cadastros}
        podeEditar={podeEditar}
      />
    </div>
  );
}
