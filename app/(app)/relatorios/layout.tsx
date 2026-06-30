import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { RelatoriosNav } from "@/components/relatorios/relatorios-nav";

export default async function RelatoriosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(STAFF_ROLES);
  return (
    <div>
      <RelatoriosNav />
      {children}
    </div>
  );
}
