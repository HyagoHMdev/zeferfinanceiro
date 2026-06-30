import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { carregarCadastrosVenda } from "@/lib/data/cadastros";
import type { Venda } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendaForm } from "@/components/vendas/venda-form";
import { VendaAcoes } from "@/components/vendas/venda-acoes";

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ADMIN_FIN_ROLES);
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("vendas").select("*").eq("id", id).single();
  if (!data) notFound();
  const venda = data as Venda;

  const cadastros = await carregarCadastrosVenda();

  return (
    <div>
      <PageHeader
        title="Editar venda"
        description={[venda.cliente, venda.unidade].filter(Boolean).join(" · ") || "Detalhes da venda"}
      >
        <Button asChild variant="outline">
          <Link href="/vendas">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Status e ações</CardTitle>
        </CardHeader>
        <CardContent>
          <VendaAcoes id={venda.id} status={venda.status} />
        </CardContent>
      </Card>

      <VendaForm mode="edit" venda={venda} {...cadastros} />
    </div>
  );
}
