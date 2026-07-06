import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { carregarDashboard } from "@/lib/data/dashboard";
import { MESES } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReceitaDespesaChart } from "@/components/charts/receita-despesa-chart";
import { DashboardFiltro } from "@/components/dashboard/dashboard-filtro";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const { ano: anoParam, mes: mesParam } = await searchParams;
  const d = await carregarDashboard({
    ano: anoParam ? Number(anoParam) : undefined,
    mes: mesParam ? Number(mesParam) : undefined,
  });

  const periodo = d.mes ? `${MESES[d.mes - 1]}/${d.ano}` : String(d.ano);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Visão geral financeira da Zefer — ${periodo}.`}
        help={<OnboardingHelp screen="dashboard" />}
      >
        <DashboardFiltro anos={d.anos} ano={d.ano} mes={d.mes} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={`Receita (${periodo})`} value={d.receita} />
        <KpiCard label="Comissões recebidas" value={d.comissoesRecebidas} />
        <KpiCard label="Comissões pendentes" value={d.comissoesPendentes} />
        <KpiCard label="Pago aos corretores" value={d.pagoCorretores} />
        <KpiCard label="Despesas fixas" value={d.despesasFixas} />
        <KpiCard label="Despesas variáveis" value={d.despesasVariaveis} />
        <KpiCard
          label="Resultado líquido"
          value={d.resultadoLiquido}
          tone={d.resultadoLiquido >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Saldo em caixa (empresa)"
          value={d.saldoCaixaEmpresa}
          hint={`Acumulado até o fim de ${periodo}`}
          tone={d.saldoCaixaEmpresa >= 0 ? "positive" : "negative"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Receita x Despesa — {d.ano}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceitaDespesaChart data={d.mensal} />
        </CardContent>
      </Card>
    </div>
  );
}
