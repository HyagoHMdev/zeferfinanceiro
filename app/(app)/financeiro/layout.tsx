import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { FinanceiroNav } from "@/components/financeiro/financeiro-nav";

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(STAFF_ROLES);
  return (
    <div>
      <FinanceiroNav />
      {children}
    </div>
  );
}
