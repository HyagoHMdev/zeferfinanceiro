import { requireRole, STAFF_ROLES, ADMIN_FIN_ROLES } from "@/lib/auth";
import { listarComissoesCorretor } from "@/lib/data/corretores";
import {
  listarPagamentosPendentes,
  listarPagamentosRealizados,
} from "@/lib/data/pagamentos";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { ComissoesView } from "@/components/corretores/comissoes-view";
import { PagamentosCorretores } from "@/components/corretores/pagamentos-corretores";

export default async function CorretoresPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  const podeEditar = ADMIN_FIN_ROLES.includes(profile.role);

  // O pagamento da comissão vive aqui, e não em Pagamentos: é a mesma vida da
  // comissão, do fechamento da venda ao recibo. Só quem paga carrega as duas
  // listas de baixo.
  const [comissoes, pendentes, realizados] = await Promise.all([
    listarComissoesCorretor(),
    podeEditar ? listarPagamentosPendentes() : Promise.resolve([]),
    podeEditar ? listarPagamentosRealizados("corretor") : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Corretores"
        description="Comissões por venda, pagamento e recibos."
        help={<OnboardingHelp screen="corretores" />}
      />
      <ComissoesView comissoes={comissoes} podeEditar={podeEditar} />
      {podeEditar ? (
        <PagamentosCorretores pendentes={pendentes} realizados={realizados} />
      ) : null}
    </div>
  );
}
