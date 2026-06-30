import { requireProfile } from "@/lib/auth";
import { AppSidebar, MobileTopbar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireProfile();
  const role = profile.role;
  const userName = profile.nome ?? email;

  return (
    <div className="flex min-h-svh">
      <AppSidebar role={role} userName={userName} userEmail={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar role={role} userName={userName} />
        <main className="flex-1 bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
