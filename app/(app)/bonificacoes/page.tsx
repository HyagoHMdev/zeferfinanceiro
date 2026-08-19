import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarBonificacoes } from "@/lib/data/bonificacoes";
import { PageHeader } from "@/components/page-header";
import { BonificacoesView } from "@/components/bonificacoes/bonificacoes-view";

export const dynamic = "force-dynamic";

export default async function BonificacoesPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeDecidir = ADMIN_FIN_ROLES.includes(profile.role);
  const bonificacoes = await listarBonificacoes();

  return (
    <div>
      <PageHeader
        title="Bonificações"
        description="Bônus de campanha da construtora, informados pelo corretor na venda. Confira contra o print, aprove e pague quando a construtora liberar."
      />
      <BonificacoesView bonificacoes={bonificacoes} podeDecidir={podeDecidir} />
    </div>
  );
}
