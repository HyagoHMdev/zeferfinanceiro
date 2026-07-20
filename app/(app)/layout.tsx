import { unstable_noStore as noStore } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar, MobileTopbar } from "@/components/app-sidebar";
import { AniversarioBanner, type Niver } from "@/components/aniversario-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, email } = await requireProfile();
  const role = profile.role;
  const userName = profile.nome ?? email;

  // Aniversariantes de HOJE (mesma tabela do painel, no schema public). noStore:
  // a data muda a cada dia, então a consulta não pode ficar no Data Cache.
  noStore();
  const TZ = "America/Sao_Paulo";
  const agora = new Date();
  const hojeDia = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" }).format(agora));
  const hojeMes = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "numeric" }).format(agora));
  const supabase = await createClient();
  const { data: nivers } = await supabase
    .schema("public")
    .from("aniversariantes")
    .select("id,nome,telefone")
    .eq("dia", hojeDia)
    .eq("mes", hojeMes)
    .order("nome");
  const aniversariantes = (nivers ?? []) as Niver[];
  const hojeChave = `${hojeMes}-${hojeDia}`;

  return (
    <div className="flex min-h-svh">
      <AppSidebar role={role} userName={userName} userEmail={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar role={role} userName={userName} />
        <AniversarioBanner aniversariantes={aniversariantes} hoje={hojeChave} />
        <main className="flex-1 bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
