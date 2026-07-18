/**
 * Tipos do domínio, espelhando o schema do banco (supabase/migrations).
 * Usados nas queries e Server Actions para dar segurança de tipo sem depender
 * da geração automática (que exige um projeto Supabase linkado).
 */

export type AppRole = "admin" | "financeiro" | "diretor" | "corretor";
export type VendaStatus = "aguardando_recebimento" | "recebido" | "pago";
export type StatusPagamentoCorretor = "aguardando_liberacao" | "pago";
export type EntradaTipo =
  | "comissao"
  | "bonificacao"
  | "premiacao"
  | "investidor"
  | "outras";
export type PagamentoStatus = "pendente" | "pago" | "cancelado";
export type LancamentoEscopo = "empresa" | "pessoal" | "joinville";
export type LancamentoNatureza =
  | "custo_fixo"
  | "despesa_variavel"
  | "investimento"
  | "entrada_pessoal"
  | "saida_pessoal"
  | "entrada_joinville"
  | "saida_joinville";
export type Recorrencia = "nenhuma" | "mensal" | "anual";
export type CategoriaTipo = "custo_fixo" | "despesa_variavel" | "investimento";
export type DistribuicaoDestino = "empresa" | "pessoal";
export type LancamentoStatus = "pago" | "pendente" | "atrasado";

export interface Configuracoes {
  id: boolean;
  percentual_comissao_padrao: number;
  percentual_parceiro_padrao: number;
  percentual_imposto_imobiliaria: number;
  percentual_imposto_nf_corretor: number;
  percentual_comissao_corretor_padrao: number;
  percentual_dizimo: number;
  updated_at: string;
}

export interface Construtora {
  id: string;
  nome: string;
  comissao_padrao: number | null;
  ativo: boolean;
  created_at: string;
}

export interface Empreendimento {
  id: string;
  construtora_id: string | null;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface Corretor {
  id: string;
  nome: string;
  percentual_comissao_padrao: number | null;
  percentual_imposto_nf: number | null;
  forma_pagamento: string | null;
  chave_pix: string | null;
  dados_bancarios: string | null;
  telefone: string | null;
  creci: string | null;
  email: string | null;
  cpf: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Parceiro {
  id: string;
  nome: string;
  percentual_padrao: number | null;
  ativo: boolean;
  created_at: string;
}

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string | null;
  tipo: string | null;
  escopo: LancamentoEscopo | null;
  ativo: boolean;
  created_at: string;
}

export interface CentroCusto {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: CategoriaTipo;
  ativo: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  nome: string | null;
  role: AppRole;
  corretor_id: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Venda {
  id: string;
  data_venda: string;
  construtora_id: string | null;
  empreendimento_id: string | null;
  unidade: string | null;
  torre: string | null;
  cliente: string | null;
  cliente_nascimento: string | null;
  cliente_telefone: string | null;
  corretor_id: string | null;
  parceiro_id: string | null;
  vgv: number;
  percentual_comissao: number;
  comissao_bruta: number;
  percentual_parceiro: number;
  valor_parceiro: number;
  saldo_pos_parceiro: number;
  percentual_imposto_imobiliaria: number;
  valor_imposto: number;
  liquido_zefer: number;
  percentual_corretor: number;
  comissao_corretor_bruto: number;
  percentual_imposto_nf: number;
  valor_imposto_nf: number;
  liquido_corretor: number;
  lucro_liquido: number;
  status: VendaStatus;
  pagamento_id: string | null;
  observacoes: string | null;
  // Parceria (modelo manual)
  possui_parceria: boolean;
  empresa_parceira: string | null;
  percentual_parceria: number;
  valor_parceria: number;
  liquido_pos_parceria: number;
  percentual_desconto_parceiro: number;
  // Pagamento do corretor (por venda)
  status_pagamento_corretor: StatusPagamentoCorretor;
  created_at: string;
  updated_at: string;
}

export interface PagamentoCorretor {
  id: string;
  corretor_id: string;
  data: string;
  valor_bruto: number;
  total_bonificacoes: number;
  total_adiantamentos: number;
  valor_liquido: number;
  status: PagamentoStatus;
  recibo_url: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface Adiantamento {
  id: string;
  corretor_id: string;
  venda_id: string | null;
  data: string;
  valor: number;
  descricao: string | null;
  observacoes: string | null;
  recibo_url: string | null;
  recibo_ok: boolean;
  pagamento_id: string | null;
  /** Lançamento espelho (despesa variável da empresa) gerado ao cadastrar. */
  lancamento_id: string | null;
  created_at: string;
}

export interface Bonificacao {
  id: string;
  corretor_id: string;
  data: string;
  valor: number;
  motivo: string | null;
  pagamento_id: string | null;
  created_at: string;
}

export interface Entrada {
  id: string;
  data: string;
  tipo: EntradaTipo;
  descricao: string | null;
  valor: number;
  percentual_dizimo: number;
  valor_dizimo: number;
  liquido: number;
  venda_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Distribuicao {
  id: string;
  entrada_id: string;
  destino: DistribuicaoDestino;
  conta_id: string | null;
  percentual: number;
  valor: number;
  created_at: string;
}

export interface Lancamento {
  id: string;
  escopo: LancamentoEscopo;
  natureza: LancamentoNatureza;
  categoria_id: string | null;
  descricao: string;
  valor: number;
  competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  recorrencia: Recorrencia;
  recorrencia_grupo: string | null;
  fornecedor_id: string | null;
  centro_custo_id: string | null;
  conta_id: string | null;
  status: LancamentoStatus;
  anexo_url: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_VENDA_LABEL: Record<VendaStatus, string> = {
  aguardando_recebimento: "Aguardando recebimento",
  recebido: "Recebido",
  pago: "Pago",
};

export const ENTRADA_TIPO_LABEL: Record<EntradaTipo, string> = {
  comissao: "Comissão",
  bonificacao: "Bonificação",
  premiacao: "Premiação",
  investidor: "Investidor",
  outras: "Outras receitas",
};

export const STATUS_PAGAMENTO_CORRETOR_LABEL: Record<
  StatusPagamentoCorretor,
  string
> = {
  aguardando_liberacao: "Aguardando liberação",
  pago: "Pago",
};

export const LANCAMENTO_STATUS_LABEL: Record<LancamentoStatus, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
};

export const CATEGORIA_TIPO_LABEL: Record<CategoriaTipo, string> = {
  custo_fixo: "Custo Fixo",
  despesa_variavel: "Despesa Variável",
  investimento: "Investimento",
};

export type PercentualChave =
  | "comissao_construtora"
  | "repasse_parceiro"
  | "comissao_corretor"
  | "imposto_nf_corretor"
  | "imposto_imobiliaria"
  | "dizimo";

export interface PercentualMensal {
  id: string;
  chave: PercentualChave;
  entidade_id: string | null;
  competencia: string; // 'YYYY-MM-01'
  percentual: number;
  created_at: string;
}

export const PERCENTUAL_CHAVE_LABEL: Record<PercentualChave, string> = {
  comissao_construtora: "% Comissão construtora",
  repasse_parceiro: "% Repasse parceiro",
  comissao_corretor: "% Comissão corretor",
  imposto_nf_corretor: "% Imposto NF corretor",
  imposto_imobiliaria: "% Imposto imobiliária",
  dizimo: "% Dízimo",
};
