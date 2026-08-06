import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { carregarCadastrosVenda, carregarInvestidoresDaVenda } from "@/lib/data/cadastros";
import { buscarChecklist } from "@/lib/data/checklist";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { VendaForm } from "@/components/vendas/venda-form";

export default async function NovaVendaPage({
  searchParams,
}: {
  searchParams: Promise<{ checklist?: string }>;
}) {
  await requireRole(ADMIN_FIN_ROLES);
  const { checklist: checklistId } = await searchParams;
  const [cadastros, investidores, checklist] = await Promise.all([
    carregarCadastrosVenda(),
    carregarInvestidoresDaVenda(),
    checklistId ? buscarChecklist(checklistId) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader title="Nova venda" description="Cadastre uma venda e veja o cálculo da comissão em tempo real." help={<OnboardingHelp screen="vendas-form" />}>
        <Button asChild variant="outline">
          <Link href="/vendas">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      {checklist ? (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Aprovando a venda enviada por{" "}
          <strong>{checklist.corretorNome ?? "corretor"}</strong>. Os campos vieram
          do checklist; confira os percentuais antes de gravar. Salvar aprova a
          submissão.
        </p>
      ) : null}

      <VendaForm
        mode="create"
        {...cadastros}
        investidores={investidores}
        checklist={checklist}
      />
    </div>
  );
}
