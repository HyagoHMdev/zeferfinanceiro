import { createClient } from "@/lib/supabase/server";
import { round2, calcularSaldoCorretor } from "@/lib/calculos";
import type {
  Corretor,
  Adiantamento,
  Bonificacao,
  PagamentoCorretor,
  VendaStatus,
} from "@/lib/types";

export interface ComissaoExtrato {
  id: string;
  data_venda: string;
  empreendimento: string | null;
  cliente: string | null;
  liquido_corretor: number;
  status: VendaStatus;
  pago: boolean;
}

export interface ExtratoData {
  corretor: Corretor;
  comissoes: ComissaoExtrato[];
  adiantamentos: Adiantamento[];
  bonificacoes: Bonificacao[];
  pagamentos: PagamentoCorretor[];
  kpis: {
    comissoesPendentes: number;
    comissoesPagas: number;
    adiantamentosPendentes: number;
    bonificacoesPendentes: number;
    saldoDisponivel: number;
  };
}

interface VendaExtratoRow {
  id: string;
  data_venda: string;
  cliente: string | null;
  liquido_corretor: number;
  status: VendaStatus;
  pagamento_id: string | null;
  empreendimentos: { nome: string } | null;
}

export async function carregarExtrato(
  corretorId: string,
): Promise<ExtratoData | null> {
  const supabase = await createClient();
  const [corretorRes, vendasRes, adiRes, bonRes, pagRes] = await Promise.all([
    supabase.from("corretores").select("*").eq("id", corretorId).single(),
    supabase
      .from("vendas")
      .select(
        "id, data_venda, cliente, liquido_corretor, status, pagamento_id, empreendimentos(nome)",
      )
      .eq("corretor_id", corretorId)
      .order("data_venda", { ascending: false }),
    supabase
      .from("adiantamentos")
      .select("*")
      .eq("corretor_id", corretorId)
      .order("data", { ascending: false }),
    supabase
      .from("bonificacoes")
      .select("*")
      .eq("corretor_id", corretorId)
      .order("data", { ascending: false }),
    supabase
      .from("pagamentos_corretor")
      .select("*")
      .eq("corretor_id", corretorId)
      .order("data", { ascending: false }),
  ]);

  if (!corretorRes.data) return null;
  const corretor = corretorRes.data as Corretor;

  const vendas = (vendasRes.data ?? []) as unknown as VendaExtratoRow[];
  const comissoes: ComissaoExtrato[] = vendas.map((v) => ({
    id: v.id,
    data_venda: v.data_venda,
    empreendimento: v.empreendimentos?.nome ?? null,
    cliente: v.cliente,
    liquido_corretor: Number(v.liquido_corretor),
    status: v.status,
    pago: v.pagamento_id != null,
  }));

  const adiantamentos = (adiRes.data ?? []) as Adiantamento[];
  const bonificacoes = (bonRes.data ?? []) as Bonificacao[];
  const pagamentos = (pagRes.data ?? []) as PagamentoCorretor[];

  const comissoesPendentes = round2(
    comissoes
      .filter((c) => c.status === "recebido" && !c.pago)
      .reduce((s, c) => s + c.liquido_corretor, 0),
  );
  const comissoesPagas = round2(
    comissoes
      .filter((c) => c.status === "pago")
      .reduce((s, c) => s + c.liquido_corretor, 0),
  );
  const adiantamentosPendentes = round2(
    adiantamentos
      .filter((a) => a.pagamento_id == null)
      .reduce((s, a) => s + Number(a.valor), 0),
  );
  const bonificacoesPendentes = round2(
    bonificacoes
      .filter((b) => b.pagamento_id == null)
      .reduce((s, b) => s + Number(b.valor), 0),
  );
  const saldoDisponivel = calcularSaldoCorretor({
    comissoesAReceber: comissoesPendentes,
    bonificacoes: bonificacoesPendentes,
    adiantamentos: adiantamentosPendentes,
  });

  return {
    corretor,
    comissoes,
    adiantamentos,
    bonificacoes,
    pagamentos,
    kpis: {
      comissoesPendentes,
      comissoesPagas,
      adiantamentosPendentes,
      bonificacoesPendentes,
      saldoDisponivel,
    },
  };
}
