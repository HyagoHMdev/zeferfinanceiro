import { Plus } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import {
  listarAdiantamentosAvulsos,
  listarCorretoresAtivos,
} from "@/lib/data/adiantamentos";
import { round2 } from "@/lib/calculos";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdiantamentoFormDialog } from "@/components/adiantamentos/adiantamento-form-dialog";
import { AdiantamentosManager } from "@/components/adiantamentos/adiantamentos-manager";

export default async function AdiantamentosPage() {
  const [{ profile }, adiantamentos, corretores] = await Promise.all([
    requireRole(STAFF_ROLES),
    listarAdiantamentosAvulsos(),
    listarCorretoresAtivos(),
  ]);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const aDescontar = round2(
    adiantamentos.filter((a) => !a.descontado).reduce((s, a) => s + a.valor, 0),
  );
  const jaDescontado = round2(
    adiantamentos.filter((a) => a.descontado).reduce((s, a) => s + a.valor, 0),
  );
  const semRecibo = adiantamentos.filter(
    (a) => !a.descontado && !a.reciboOk,
  ).length;

  return (
    <div>
      <PageHeader
        title="Adiantamentos"
        description="Vales dos corretores, descontados quando houver comissões a receber."
        help={<OnboardingHelp screen="adiantamentos" />}
      >
        {podeEditar ? (
          <AdiantamentoFormDialog
            corretores={corretores}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo adiantamento
              </Button>
            }
          />
        ) : null}
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="A descontar" value={aDescontar} tone="negative" />
        <KpiCard label="Já descontado" value={jaDescontado} tone="positive" />
        <KpiCard label="Sem recibo assinado" value={semRecibo} currency={false} />
      </div>

      <Card>
        <CardContent className="px-0">
          <AdiantamentosManager
            adiantamentos={adiantamentos}
            corretores={corretores}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>
    </div>
  );
}
