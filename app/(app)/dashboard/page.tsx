import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { carregarDashboard } from "@/lib/data/dashboard";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReceitaDespesaChart } from "@/components/charts/receita-despesa-chart";

export default async function DashboardPage() {
  await requireRole(STAFF_ROLES);
  const d = await carregarDashboard();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Visão geral financeira da Zefer — ${d.ano}.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Receita do mês" value={d.receitaMes} />
        <KpiCard label="Comissões recebidas" value={d.comissoesRecebidas} />
        <KpiCard label="Comissões pendentes" value={d.comissoesPendentes} />
        <KpiCard label="Pago aos corretores" value={d.pagoCorretores} />
        <KpiCard label="Despesas fixas (ano)" value={d.despesasFixas} />
        <KpiCard label="Despesas variáveis (ano)" value={d.despesasVariaveis} />
        <KpiCard
          label="Resultado líquido (ano)"
          value={d.resultadoLiquido}
          tone={d.resultadoLiquido >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Saldo em caixa (empresa)"
          value={d.saldoCaixaEmpresa}
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
