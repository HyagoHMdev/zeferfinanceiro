import {
  carregarCaixa,
  type CaixaModo,
  type ResumoCaixa,
} from "@/lib/data/financeiro";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { CaixaFiltro } from "@/components/financeiro/caixa-filtro";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";

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

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; modo?: string }>;
}) {
  const { mes: mesParam, modo: modoParam } = await searchParams;
  const modo: CaixaModo = modoParam === "acumulado" ? "acumulado" : "movimento";

  const caixa = await carregarCaixa({ mes: mesParam, modo });
  // carregarCaixa ignora mês inexistente; refletimos isso no filtro/descrição.
  const mes = mesParam && caixa.meses.includes(mesParam) ? mesParam : null;

  const descricao = !mes
    ? "Saldo atual e previsto da empresa e pessoal — todos os meses."
    : modo === "acumulado"
      ? "Acumulado até o fim do mês selecionado."
      : "Movimento (entradas e saídas) do mês selecionado.";

  return (
    <div className="space-y-8">
      <PageHeader title="Caixa" description={descricao} help={<OnboardingHelp screen="financeiro-caixa" />}>
        <CaixaFiltro meses={caixa.meses} mesAtual={mes} modoAtual={modo} />
      </PageHeader>
      <Bloco titulo="Empresa (Zefer)" resumo={caixa.empresa} />
      <Bloco titulo="Pessoal" resumo={caixa.pessoal} />
      <Bloco titulo="Zefer Joinville" resumo={caixa.joinville} />
    </div>
  );
}
