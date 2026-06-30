-- =============================================================================
-- Sistema Financeiro Zefer — Schema inicial
-- Enums, funções auxiliares (RLS), tabelas, índices e triggers.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'financeiro', 'diretor', 'corretor');
create type public.venda_status as enum ('aguardando_recebimento', 'recebido', 'pago');
create type public.entrada_tipo as enum ('comissao', 'bonificacao', 'premiacao', 'outras');
create type public.pagamento_status as enum ('pendente', 'pago', 'cancelado');
create type public.lancamento_escopo as enum ('empresa', 'pessoal');
create type public.lancamento_natureza as enum (
  'custo_fixo', 'despesa_variavel', 'investimento', 'entrada_pessoal', 'saida_pessoal'
);
create type public.recorrencia as enum ('nenhuma', 'mensal', 'anual');
create type public.categoria_tipo as enum ('custo_fixo', 'despesa_variavel', 'investimento');
create type public.distribuicao_destino as enum ('empresa', 'pessoal');
create type public.lancamento_status as enum ('pago', 'pendente', 'atrasado');

-- ---------------------------------------------------------------------------
-- Função utilitária: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastros / configuração
-- ---------------------------------------------------------------------------

-- Linha única de parâmetros globais (id sempre = true → garante singleton).
create table public.configuracoes (
  id boolean primary key default true check (id),
  percentual_comissao_padrao          numeric(6,5) not null default 0.05,
  percentual_parceiro_padrao          numeric(6,5) not null default 0.175,
  percentual_imposto_imobiliaria      numeric(6,5) not null default 0.119,
  percentual_imposto_nf_corretor      numeric(6,5) not null default 0.119,
  percentual_comissao_corretor_padrao numeric(6,5) not null default 0.0175,
  percentual_dizimo                   numeric(6,5) not null default 0,
  percentual_distribuicao_empresa     numeric(6,5) not null default 0.10,
  percentual_distribuicao_pessoal     numeric(6,5) not null default 0.90,
  updated_at timestamptz not null default now()
);

create table public.construtoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  comissao_padrao numeric(6,5),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.empreendimentos (
  id uuid primary key default gen_random_uuid(),
  construtora_id uuid references public.construtoras (id) on delete set null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.corretores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  percentual_comissao_padrao numeric(6,5),
  percentual_imposto_nf numeric(6,5),
  forma_pagamento text,
  chave_pix text,
  dados_bancarios text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  percentual_padrao numeric(6,5),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  banco text,
  tipo text,
  escopo public.lancamento_escopo,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo public.categoria_tipo not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (nome, tipo)
);

-- Perfis de acesso, ligados ao auth.users do Supabase.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  role public.app_role not null default 'corretor',
  corretor_id uuid references public.corretores (id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Módulo 2 — Pagamentos (declarado antes de vendas por causa das FKs)
-- ---------------------------------------------------------------------------
create table public.pagamentos_corretor (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null references public.corretores (id) on delete restrict,
  data date not null,
  valor_bruto numeric(14,2) not null default 0,
  total_bonificacoes numeric(14,2) not null default 0,
  total_adiantamentos numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) not null default 0,
  status public.pagamento_status not null default 'pago',
  recibo_url text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Módulo 1 — Vendas / Comissões
-- ---------------------------------------------------------------------------
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  data_venda date not null,
  construtora_id uuid references public.construtoras (id) on delete set null,
  empreendimento_id uuid references public.empreendimentos (id) on delete set null,
  unidade text,
  cliente text,
  corretor_id uuid references public.corretores (id) on delete set null,
  parceiro_id uuid references public.parceiros (id) on delete set null,
  vgv numeric(14,2) not null,
  percentual_comissao numeric(6,5) not null,
  comissao_bruta numeric(14,2) not null,
  percentual_parceiro numeric(6,5) not null default 0,
  valor_parceiro numeric(14,2) not null default 0,
  saldo_pos_parceiro numeric(14,2) not null,
  percentual_imposto_imobiliaria numeric(6,5) not null,
  valor_imposto numeric(14,2) not null,
  liquido_zefer numeric(14,2) not null,
  percentual_corretor numeric(6,5) not null,
  comissao_corretor_bruto numeric(14,2) not null,
  percentual_imposto_nf numeric(6,5) not null,
  valor_imposto_nf numeric(14,2) not null,
  liquido_corretor numeric(14,2) not null,
  lucro_liquido numeric(14,2) not null,
  status public.venda_status not null default 'aguardando_recebimento',
  pagamento_id uuid references public.pagamentos_corretor (id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adiantamentos (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null references public.corretores (id) on delete cascade,
  data date not null,
  valor numeric(14,2) not null,
  descricao text,
  recibo_url text,
  pagamento_id uuid references public.pagamentos_corretor (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.bonificacoes (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null references public.corretores (id) on delete cascade,
  data date not null,
  valor numeric(14,2) not null,
  motivo text,
  pagamento_id uuid references public.pagamentos_corretor (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Módulo 3 — Entradas e Distribuições
-- ---------------------------------------------------------------------------
create table public.entradas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo public.entrada_tipo not null,
  descricao text,
  valor numeric(14,2) not null,
  percentual_dizimo numeric(6,5) not null default 0,
  valor_dizimo numeric(14,2) not null default 0,
  liquido numeric(14,2) not null,
  venda_id uuid references public.vendas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.distribuicoes (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas (id) on delete cascade,
  destino public.distribuicao_destino not null,
  conta_id uuid references public.contas_bancarias (id) on delete set null,
  percentual numeric(6,5) not null,
  valor numeric(14,2) not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Módulo 4 — Financeiro (lançamentos unificados, empresa e pessoal)
-- ---------------------------------------------------------------------------
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  escopo public.lancamento_escopo not null,
  natureza public.lancamento_natureza not null,
  categoria_id uuid references public.categorias_financeiras (id) on delete set null,
  descricao text not null,
  valor numeric(14,2) not null,
  competencia date not null,
  data_vencimento date,
  data_pagamento date,
  recorrencia public.recorrencia not null default 'nenhuma',
  recorrencia_grupo uuid,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  centro_custo_id uuid references public.centros_custo (id) on delete set null,
  conta_id uuid references public.contas_bancarias (id) on delete set null,
  status public.lancamento_status not null default 'pendente',
  anexo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index idx_empreendimentos_construtora on public.empreendimentos (construtora_id);
create index idx_profiles_corretor on public.profiles (corretor_id);
create index idx_vendas_corretor on public.vendas (corretor_id);
create index idx_vendas_status on public.vendas (status);
create index idx_vendas_data on public.vendas (data_venda);
create index idx_vendas_construtora on public.vendas (construtora_id);
create index idx_vendas_empreendimento on public.vendas (empreendimento_id);
create index idx_vendas_pagamento on public.vendas (pagamento_id);
create index idx_adiantamentos_corretor on public.adiantamentos (corretor_id);
create index idx_adiantamentos_pagamento on public.adiantamentos (pagamento_id);
create index idx_bonificacoes_corretor on public.bonificacoes (corretor_id);
create index idx_bonificacoes_pagamento on public.bonificacoes (pagamento_id);
create index idx_pagamentos_corretor on public.pagamentos_corretor (corretor_id);
create index idx_entradas_data on public.entradas (data);
create index idx_entradas_venda on public.entradas (venda_id);
create index idx_distribuicoes_entrada on public.distribuicoes (entrada_id);
create index idx_lancamentos_competencia on public.lancamentos (competencia);
create index idx_lancamentos_escopo_natureza on public.lancamentos (escopo, natureza);
create index idx_lancamentos_categoria on public.lancamentos (categoria_id);

-- ---------------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------------
create trigger trg_configuracoes_updated before update on public.configuracoes
  for each row execute function public.set_updated_at();
create trigger trg_corretores_updated before update on public.corretores
  for each row execute function public.set_updated_at();
create trigger trg_vendas_updated before update on public.vendas
  for each row execute function public.set_updated_at();
create trigger trg_entradas_updated before update on public.entradas
  for each row execute function public.set_updated_at();
create trigger trg_lancamentos_updated before update on public.lancamentos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Criação automática de profile ao registrar um usuário no Auth
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
