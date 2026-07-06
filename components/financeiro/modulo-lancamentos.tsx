import { Plus } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import {
  listarLancamentos,
  carregarCadastrosLancamento,
} from "@/lib/data/financeiro";
import type { LancamentoEscopo, LancamentoNatureza } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LancamentosTable } from "@/components/financeiro/lancamentos-table";
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog";

export async function ModuloLancamentos({
  titulo,
  descricao,
  escopo,
  naturezas,
  naturezaFixaCriar,
}: {
  titulo: string;
  descricao: string;
  escopo: LancamentoEscopo;
  naturezas: LancamentoNatureza[];
  naturezaFixaCriar?: LancamentoNatureza;
}) {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const [lancamentos, cadastros] = await Promise.all([
    listarLancamentos({ escopo, naturezas }),
    carregarCadastrosLancamento(),
  ]);

  return (
    <div>
      <PageHeader title={titulo} description={descricao} help={<OnboardingHelp screen="financeiro-lancamentos" />}>
        {podeEditar ? (
          <LancamentoFormDialog
            escopoFixo={escopo}
            naturezaFixa={naturezaFixaCriar}
            cadastros={cadastros}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo lançamento
              </Button>
            }
          />
        ) : null}
      </PageHeader>

      <Card>
        <CardContent className="px-0">
          <LancamentosTable
            lancamentos={lancamentos}
            podeEditar={podeEditar}
            escopoFixo={escopo}
            naturezaFixa={naturezaFixaCriar}
            cadastros={cadastros}
          />
        </CardContent>
      </Card>
    </div>
  );
}
