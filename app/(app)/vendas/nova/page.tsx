import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { carregarCadastrosVenda } from "@/lib/data/cadastros";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { Button } from "@/components/ui/button";
import { VendaForm } from "@/components/vendas/venda-form";

export default async function NovaVendaPage() {
  await requireRole(ADMIN_FIN_ROLES);
  const cadastros = await carregarCadastrosVenda();

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

      <VendaForm mode="create" {...cadastros} />
    </div>
  );
}
