import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import {
  listarContasAPagar,
  carregarCadastrosLancamento,
} from "@/lib/data/financeiro";
import { round2 } from "@/lib/calculos";
import { statusLancamentoEfetivo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { ContasAPagarTable } from "@/components/financeiro/contas-a-pagar-table";

export default async function APagarPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  const [lancamentos, cadastros] = await Promise.all([
    listarContasAPagar(),
    carregarCadastrosLancamento(),
  ]);

  const totalAPagar = round2(lancamentos.reduce((s, l) => s + Number(l.valor), 0));
  const vencido = round2(
    lancamentos
      .filter(
        (l) =>
          statusLancamentoEfetivo(l.status, l.data_vencimento) === "atrasado",
      )
      .reduce((s, l) => s + Number(l.valor), 0),
  );

  return (
    <div>
      <PageHeader
        title="A Pagar"
        description="Tudo que está pendente de pagamento, por vencimento."
        help={<OnboardingHelp screen="financeiro-a-pagar" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total a pagar" value={totalAPagar} tone="negative" />
        <KpiCard label="Vencido" value={vencido} tone="negative" />
        <KpiCard
          label="A vencer"
          value={round2(totalAPagar - vencido)}
        />
      </div>

      <Card>
        <CardContent className="px-0">
          <ContasAPagarTable
            lancamentos={lancamentos}
            podeEditar={podeEditar}
            cadastros={cadastros}
          />
        </CardContent>
      </Card>
    </div>
  );
}
