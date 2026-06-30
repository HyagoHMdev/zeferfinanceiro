import { carregarCaixa, type ResumoCaixa } from "@/lib/data/financeiro";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";

function Bloco({ titulo, resumo }: { titulo: string; resumo: ResumoCaixa }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {titulo}
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Entradas" value={resumo.entradas} />
        <KpiCard label="Saídas pagas" value={resumo.saidasPagas} />
        <KpiCard
          label="Saldo atual"
          value={resumo.saldoAtual}
          tone={resumo.saldoAtual >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Saldo previsto"
          value={resumo.saldoPrevisto}
          hint={`Saídas previstas: ${resumo.saidasPrevistas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
          tone={resumo.saldoPrevisto >= 0 ? "positive" : "negative"}
        />
      </div>
    </div>
  );
}

export default async function CaixaPage() {
  const caixa = await carregarCaixa();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Caixa"
        description="Saldo atual e previsto da empresa e pessoal."
      />
      <Bloco titulo="Empresa (Zefer)" resumo={caixa.empresa} />
      <Bloco titulo="Pessoal" resumo={caixa.pessoal} />
    </div>
  );
}
