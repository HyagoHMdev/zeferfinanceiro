import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/calculos";
import { MESES } from "@/lib/format";
import type {
  CategoriaFinanceira,
  ContaBancaria,
  CentroCusto,
  Fornecedor,
  Lancamento,
  LancamentoEscopo,
  LancamentoNatureza,
} from "@/lib/types";

export interface CadastrosLancamento {
  categorias: CategoriaFinanceira[];
  contas: ContaBancaria[];
  centros: CentroCusto[];
  fornecedores: Fornecedor[];
}

export async function carregarCadastrosLancamento(): Promise<CadastrosLancamento> {
  const supabase = await createClient();
  const [categorias, contas, centros, fornecedores] = await Promise.all([
    supabase.from("categorias_financeiras").select("*").eq("ativo", true).order("nome"),
    supabase.from("contas_bancarias").select("*").eq("ativo", true).order("nome"),
    supabase.from("centros_custo").select("*").eq("ativo", true).order("nome"),
    supabase.from("fornecedores").select("*").eq("ativo", true).order("nome"),
  ]);
  return {
    categorias: (categorias.data ?? []) as CategoriaFinanceira[],
    contas: (contas.data ?? []) as ContaBancaria[],
    centros: (centros.data ?? []) as CentroCusto[],
    fornecedores: (fornecedores.data ?? []) as Fornecedor[],
  };
}

export interface LancamentoRow extends Lancamento {
  categorias_financeiras: { nome: string } | null;
  contas_bancarias: { nome: string } | null;
}

export async function listarLancamentos(filtro: {
  escopo: LancamentoEscopo;
  naturezas: LancamentoNatureza[];
}): Promise<LancamentoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("*, categorias_financeiras(nome), contas_bancarias(nome)")
    .eq("escopo", filtro.escopo)
    .in("natureza", filtro.naturezas)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as unknown as LancamentoRow[];

  // Ordenação relativa a hoje: mês atual e futuros em ordem crescente no topo;
  // meses já passados vão para o fim (mais recente primeiro). Dentro do mesmo
  // mês, ordena por data de vencimento (mais próximo primeiro; sem data por
  // último). Empate final = created_at (sort estável preserva a ordem do banco).
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const passou = (comp: string) => comp.slice(0, 7) < mesAtual;
  return rows.sort((a, b) => {
    const pa = passou(a.competencia);
    const pb = passou(b.competencia);
    if (pa !== pb) return pa ? 1 : -1; // passados sempre depois
    if (a.competencia === b.competencia) {
      // Mesmo mês: por vencimento crescente; lançamentos sem vencimento por último.
      const va = a.data_vencimento ?? "";
      const vb = b.data_vencimento ?? "";
      if (va === vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      return va < vb ? -1 : 1;
    }
    // futuros/atual: crescente · passados: decrescente (mais recente primeiro)
    const asc = a.competencia < b.competencia ? -1 : 1;
    return pa ? -asc : asc;
  });
}

/**
 * Contas a pagar: todas as saídas ainda não pagas (qualquer escopo/natureza,
 * menos entradas), ordenadas pelo vencimento mais próximo primeiro.
 */
export async function listarContasAPagar(): Promise<LancamentoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("*, categorias_financeiras(nome), contas_bancarias(nome)")
    .neq("status", "pago")
    .neq("natureza", "entrada_pessoal")
    .order("data_vencimento", { ascending: true, nullsFirst: false });
  return (data ?? []) as unknown as LancamentoRow[];
}

export interface ResumoCaixa {
  entradas: number;
  saidasPagas: number;
  saidasPrevistas: number;
  saldoAtual: number;
  saldoPrevisto: number;
}

export type CaixaModo = "movimento" | "acumulado";

export interface CaixaData {
  empresa: ResumoCaixa;
  pessoal: ResumoCaixa;
  /** Meses (YYYY-MM) com movimento, em ordem decrescente. */
  meses: string[];
}

export async function carregarCaixa(opts?: {
  /** YYYY-MM; ausente = todos os meses. */
  mes?: string;
  /** "movimento" = só o mês; "acumulado" = tudo até o fim do mês. */
  modo?: CaixaModo;
}): Promise<CaixaData> {
  const supabase = await createClient();
  const [distRes, lancRes] = await Promise.all([
    supabase.from("distribuicoes").select("destino, valor, entradas(data)"),
    supabase
      .from("lancamentos")
      .select("escopo, natureza, valor, status, competencia"),
  ]);

  const dist = (distRes.data ?? []) as unknown as {
    destino: "empresa" | "pessoal";
    valor: number;
    entradas: { data: string } | null;
  }[];
  const lanc = (lancRes.data ?? []) as {
    escopo: LancamentoEscopo;
    natureza: LancamentoNatureza;
    valor: number;
    status: string;
    competencia: string;
  }[];

  // Meses disponíveis: união das datas de entrada e das competências.
  const mesesSet = new Set<string>();
  for (const d of dist) if (d.entradas?.data) mesesSet.add(d.entradas.data.slice(0, 7));
  for (const l of lanc) mesesSet.add(l.competencia.slice(0, 7));
  const meses = [...mesesSet].sort((a, b) => b.localeCompare(a));

  // Filtro por mês: "movimento" pega só o mês; "acumulado" pega tudo até ele.
  // Mês inexistente é ignorado (equivale a "todos os meses").
  const mes = opts?.mes && meses.includes(opts.mes) ? opts.mes : undefined;
  const modo = opts?.modo ?? "movimento";
  const inclui = (mk: string | null): boolean => {
    if (!mes) return true;
    if (!mk) return false;
    return modo === "acumulado" ? mk <= mes : mk === mes;
  };
  const distF = dist.filter((d) => inclui(d.entradas?.data?.slice(0, 7) ?? null));
  const lancF = lanc.filter((l) => inclui(l.competencia.slice(0, 7)));

  const soma = <T,>(arr: T[], pred: (x: T) => boolean, val: (x: T) => number) =>
    round2(arr.reduce((s, x) => s + (pred(x) ? val(x) : 0), 0));

  const entradasEmpresa = soma(distF, (d) => d.destino === "empresa", (d) => Number(d.valor));
  const entradasPessoal = round2(
    soma(distF, (d) => d.destino === "pessoal", (d) => Number(d.valor)) +
      soma(lancF, (l) => l.natureza === "entrada_pessoal", (l) => Number(l.valor)),
  );

  const empresaPagas = soma(
    lancF,
    (l) => l.escopo === "empresa" && l.status === "pago",
    (l) => Number(l.valor),
  );
  const empresaPrevistas = soma(
    lancF,
    (l) => l.escopo === "empresa" && l.status !== "pago",
    (l) => Number(l.valor),
  );
  const pessoalPagas = soma(
    lancF,
    (l) => l.natureza === "saida_pessoal" && l.status === "pago",
    (l) => Number(l.valor),
  );
  const pessoalPrevistas = soma(
    lancF,
    (l) => l.natureza === "saida_pessoal" && l.status !== "pago",
    (l) => Number(l.valor),
  );

  return {
    meses,
    empresa: {
      entradas: entradasEmpresa,
      saidasPagas: empresaPagas,
      saidasPrevistas: empresaPrevistas,
      saldoAtual: round2(entradasEmpresa - empresaPagas),
      saldoPrevisto: round2(entradasEmpresa - empresaPagas - empresaPrevistas),
    },
    pessoal: {
      entradas: entradasPessoal,
      saidasPagas: pessoalPagas,
      saidasPrevistas: pessoalPrevistas,
      saldoAtual: round2(entradasPessoal - pessoalPagas),
      saldoPrevisto: round2(entradasPessoal - pessoalPagas - pessoalPrevistas),
    },
  };
}

export interface FluxoMes {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

/** Fluxo de caixa mensal da EMPRESA para um ano (Jan–Dez). */
export async function carregarFluxoAnual(ano: number): Promise<FluxoMes[]> {
  const supabase = await createClient();
  const [distRes, lancRes] = await Promise.all([
    supabase
      .from("distribuicoes")
      .select("valor, entradas(data)")
      .eq("destino", "empresa"),
    supabase
      .from("lancamentos")
      .select("valor, competencia")
      .eq("escopo", "empresa"),
  ]);

  const dist = (distRes.data ?? []) as unknown as {
    valor: number;
    entradas: { data: string } | null;
  }[];
  const lanc = (lancRes.data ?? []) as { valor: number; competencia: string }[];

  const entradas = new Array(12).fill(0);
  const saidas = new Array(12).fill(0);

  for (const d of dist) {
    if (!d.entradas?.data) continue;
    const dt = new Date(d.entradas.data);
    if (dt.getUTCFullYear() === ano) entradas[dt.getUTCMonth()] += Number(d.valor);
  }
  for (const l of lanc) {
    const dt = new Date(l.competencia);
    if (dt.getUTCFullYear() === ano) saidas[dt.getUTCMonth()] += Number(l.valor);
  }

  return MESES.map((mes, i) => ({
    mes,
    entradas: round2(entradas[i]),
    saidas: round2(saidas[i]),
    saldo: round2(entradas[i] - saidas[i]),
  }));
}
