import { requireRole, ADMIN_FIN_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { OnboardingHelp } from "@/components/onboarding/onboarding-help";
import { ConfiguracoesNav } from "@/components/configuracoes/configuracoes-nav";

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole(ADMIN_FIN_ROLES);
  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Parâmetros, cadastros e usuários do sistema."
        help={<OnboardingHelp screen="configuracoes" />}
      />
      <ConfiguracoesNav isAdmin={profile.role === "admin"} />
      {children}
    </div>
  );
}
