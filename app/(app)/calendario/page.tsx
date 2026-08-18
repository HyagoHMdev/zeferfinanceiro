import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CalendarioView, type Atividade } from "./calendario-view";

export const dynamic = "force-dynamic";

/** Mês visível: ?mes=YYYY-MM, ou o mês corrente em São Paulo. */
function mesDaBusca(mes?: string): string {
  if (mes && /^\d{4}-\d{2}$/.test(mes)) return mes;
  const agora = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return agora.slice(0, 7);
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { profile } = await requireRole(STAFF_ROLES);
  const { mes } = await searchParams;
  const mesAtual = mesDaBusca(mes);

  // Puxa o mês inteiro com folga de uma semana de cada lado: a grade mostra os
  // dias vizinhos que completam a primeira e a última semana.
  const [ano, m] = mesAtual.split("-").map(Number);
  const de = new Date(Date.UTC(ano, m - 1, 1 - 7)).toISOString().slice(0, 10);
  const ate = new Date(Date.UTC(ano, m, 7)).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda")
    .select("id, data, titulo, descricao, categoria, hora, concluida, serie_id, repeticao")
    .gte("data", de)
    .lte("data", ate)
    .order("data")
    .order("hora", { nullsFirst: true });

  return (
    <div>
      <PageHeader
        title="Calendário"
        description="As atividades do dia do financeiro: contas a pagar, conferências, reuniões e prazos."
      />
      <CalendarioView
        mes={mesAtual}
        atividades={(data ?? []) as Atividade[]}
        podeEditar={profile.role === "admin" || profile.role === "financeiro"}
      />
    </div>
  );
}
