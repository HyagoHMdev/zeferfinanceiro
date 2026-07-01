import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { carregarProcessamentoVenda } from "@/lib/data/corretores";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ProcessamentoCorretor } from "@/components/corretores/processamento-corretor";
import { CorretorStatusSelect } from "@/components/corretores/corretor-status-select";

export default async function CorretorVendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);
  const { id } = await params;

  const dados = await carregarProcessamentoVenda(id);
  if (!dados) notFound();

  return (
    <div>
      <PageHeader
        title={dados.venda.corretores?.nome ?? "Corretor"}
        description={`Processamento da comissão — ${dados.venda.empreendimentos?.nome ?? "venda"}`}
      >
        <div className="flex items-center gap-2">
          {podeEditar ? (
            <CorretorStatusSelect
              vendaId={dados.venda.id}
              status={dados.venda.status_pagamento_corretor}
            />
          ) : null}
          <Button asChild variant="outline">
            <Link href="/corretores">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
        </div>
      </PageHeader>

      <ProcessamentoCorretor dados={dados} podeEditar={podeEditar} />
    </div>
  );
}
