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
    .order("competencia", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as LancamentoRow[];
}

export interface ResumoCaixa {
  entradas: number;
  saidasPagas: number;
  saidasPrevistas: number;
  saldoAtual: number;
  saldoPrevisto: number;
}

export interface CaixaData {
  empresa: ResumoCaixa;
  pessoal: ResumoCaixa;
}

export async function carregarCaixa(): Promise<CaixaData> {
  const supabase = await createClient();
  const [distRes, lancRes] = await Promise.all([
    supabase.from("distribuicoes").select("destino, valor"),
    supabase.from("lancamentos").select("escopo, natureza, valor, status"),
  ]);

  const dist = (distRes.data ?? []) as { destino: "empresa" | "pessoal"; valor: number }[];
  const lanc = (lancRes.data ?? []) as {
    escopo: LancamentoEscopo;
    natureza: LancamentoNatureza;
    valor: number;
    status: string;
  }[];

  const soma = <T,>(arr: T[], pred: (x: T) => boolean, val: (x: T) => number) =>
    round2(arr.reduce((s, x) => s + (pred(x) ? val(x) : 0), 0));

  const entradasEmpresa = soma(dist, (d) => d.destino === "empresa", (d) => Number(d.valor));
  const entradasPessoal = round2(
    soma(dist, (d) => d.destino === "pessoal", (d) => Number(d.valor)) +
      soma(lanc, (l) => l.natureza === "entrada_pessoal", (l) => Number(l.valor)),
  );

  const empresaPagas = soma(
    lanc,
    (l) => l.escopo === "empresa" && l.status === "pago",
    (l) => Number(l.valor),
  );
  const empresaPrevistas = soma(
    lanc,
    (l) => l.escopo === "empresa" && l.status !== "pago",
    (l) => Number(l.valor),
  );
  const pessoalPagas = soma(
    lanc,
    (l) => l.natureza === "saida_pessoal" && l.status === "pago",
    (l) => Number(l.valor),
  );
  const pessoalPrevistas = soma(
    lanc,
    (l) => l.natureza === "saida_pessoal" && l.status !== "pago",
    (l) => Number(l.valor),
  );

  return {
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
