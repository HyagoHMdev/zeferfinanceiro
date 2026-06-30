import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { carregarExtrato } from "@/lib/data/extrato";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ExtratoView } from "@/components/corretores/extrato-view";

export default async function CorretorExtratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireRole(STAFF_ROLES);
  const { id } = await params;

  const extrato = await carregarExtrato(id);
  if (!extrato) notFound();

  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  return (
    <div>
      <PageHeader
        title={extrato.corretor.nome}
        description="Extrato de comissões, adiantamentos e bonificações."
      >
        <Button asChild variant="outline">
          <Link href="/corretores">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <ExtratoView data={extrato} podeEditar={podeEditar} />
    </div>
  );
}
