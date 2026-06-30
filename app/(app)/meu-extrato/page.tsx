import { requireRole } from "@/lib/auth";
import { carregarExtrato } from "@/lib/data/extrato";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ExtratoView } from "@/components/corretores/extrato-view";

export default async function MeuExtratoPage() {
  const { profile } = await requireRole(["corretor"]);

  if (!profile.corretor_id) {
    return (
      <div>
        <PageHeader title="Meu extrato" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Seu usuário ainda não está vinculado a um corretor. Fale com o
            financeiro.
          </CardContent>
        </Card>
      </div>
    );
  }

  const extrato = await carregarExtrato(profile.corretor_id);
  if (!extrato) {
    return (
      <div>
        <PageHeader title="Meu extrato" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Não foi possível carregar seu extrato.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Meu extrato"
        description="Suas comissões, adiantamentos e bonificações."
      />
      <ExtratoView data={extrato} podeEditar={false} />
    </div>
  );
}
