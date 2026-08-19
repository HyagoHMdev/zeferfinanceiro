import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarComissoesCorretor } from "@/lib/data/corretores";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { ComissoesView } from "@/components/corretores/comissoes-view";

export default async function CorretoresPage() {
  const [{ profile }, comissoes] = await Promise.all([
    requireRole(STAFF_ROLES),
    listarComissoesCorretor(),
  ]);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  return (
    <div>
      <PageHeader
        title="Corretores"
        description="Comissões por venda e status de pagamento."
        help={<OnboardingHelp screen="corretores" />}
      />
      {/* Filtros e totais moram na view: são estado de tela, e recarregar a
          página a cada troca de filtro seria ida ao servidor à toa. */}
      <ComissoesView comissoes={comissoes} podeEditar={podeEditar} />
    </div>
  );
}
