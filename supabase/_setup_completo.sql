-- Zefer Financeiro — setup completo


-- >>> migrations/0001_schema.sql
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
  observacoes text,
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


-- >>> migrations/0002_rls.sql
-- =============================================================================
-- Sistema Financeiro Zefer — Row Level Security
-- Funções auxiliares (SECURITY DEFINER, evitam recursão de RLS) e políticas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funções auxiliares de papel
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo and role in ('admin', 'financeiro', 'diretor')
  );
$$;

create or replace function public.is_admin_fin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo and role in ('admin', 'financeiro')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo and role = 'admin'
  );
$$;

create or replace function public.current_corretor_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select corretor_id from public.profiles where id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.configuracoes          enable row level security;
alter table public.construtoras           enable row level security;
alter table public.empreendimentos        enable row level security;
alter table public.corretores             enable row level security;
alter table public.parceiros              enable row level security;
alter table public.contas_bancarias       enable row level security;
alter table public.centros_custo          enable row level security;
alter table public.fornecedores           enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.profiles               enable row level security;
alter table public.pagamentos_corretor    enable row level security;
alter table public.vendas                 enable row level security;
alter table public.adiantamentos          enable row level security;
alter table public.bonificacoes           enable row level security;
alter table public.entradas               enable row level security;
alter table public.distribuicoes          enable row level security;
alter table public.lancamentos            enable row level security;

-- ---------------------------------------------------------------------------
-- configuracoes — staff lê; admin/financeiro altera
-- ---------------------------------------------------------------------------
create policy configuracoes_read on public.configuracoes
  for select using (public.is_staff());
create policy configuracoes_update on public.configuracoes
  for update using (public.is_admin_fin()) with check (public.is_admin_fin());

-- ---------------------------------------------------------------------------
-- construtoras / empreendimentos — qualquer autenticado lê; admin/fin escreve
-- ---------------------------------------------------------------------------
create policy construtoras_read on public.construtoras
  for select using (auth.uid() is not null);
create policy construtoras_write on public.construtoras
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy empreendimentos_read on public.empreendimentos
  for select using (auth.uid() is not null);
create policy empreendimentos_write on public.empreendimentos
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

-- ---------------------------------------------------------------------------
-- corretores — staff vê todos; corretor vê o próprio; admin/fin escreve
-- ---------------------------------------------------------------------------
create policy corretores_read on public.corretores
  for select using (public.is_staff() or id = public.current_corretor_id());
create policy corretores_write on public.corretores
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

-- ---------------------------------------------------------------------------
-- Cadastros restritos ao staff (leitura) / admin-fin (escrita)
-- ---------------------------------------------------------------------------
create policy parceiros_read on public.parceiros
  for select using (public.is_staff());
create policy parceiros_write on public.parceiros
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy contas_read on public.contas_bancarias
  for select using (public.is_staff());
create policy contas_write on public.contas_bancarias
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy centros_read on public.centros_custo
  for select using (public.is_staff());
create policy centros_write on public.centros_custo
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy fornecedores_read on public.fornecedores
  for select using (public.is_staff());
create policy fornecedores_write on public.fornecedores
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy categorias_read on public.categorias_financeiras
  for select using (public.is_staff());
create policy categorias_write on public.categorias_financeiras
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

-- ---------------------------------------------------------------------------
-- profiles — usuário vê o próprio; staff vê todos; admin gerencia
-- ---------------------------------------------------------------------------
create policy profiles_read on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy profiles_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- vendas — staff vê todas; corretor vê as suas; admin/fin escreve
-- ---------------------------------------------------------------------------
create policy vendas_read on public.vendas
  for select using (public.is_staff() or corretor_id = public.current_corretor_id());
create policy vendas_write on public.vendas
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

-- ---------------------------------------------------------------------------
-- adiantamentos / bonificações / pagamentos — staff todos; corretor os seus
-- ---------------------------------------------------------------------------
create policy adiantamentos_read on public.adiantamentos
  for select using (public.is_staff() or corretor_id = public.current_corretor_id());
create policy adiantamentos_write on public.adiantamentos
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy bonificacoes_read on public.bonificacoes
  for select using (public.is_staff() or corretor_id = public.current_corretor_id());
create policy bonificacoes_write on public.bonificacoes
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy pagamentos_read on public.pagamentos_corretor
  for select using (public.is_staff() or corretor_id = public.current_corretor_id());
create policy pagamentos_write on public.pagamentos_corretor
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

-- ---------------------------------------------------------------------------
-- entradas / distribuições / lançamentos — somente staff (leitura) e admin/fin
-- ---------------------------------------------------------------------------
create policy entradas_read on public.entradas
  for select using (public.is_staff());
create policy entradas_write on public.entradas
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy distribuicoes_read on public.distribuicoes
  for select using (public.is_staff());
create policy distribuicoes_write on public.distribuicoes
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());

create policy lancamentos_read on public.lancamentos
  for select using (public.is_staff());
create policy lancamentos_write on public.lancamentos
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());


-- >>> migrations/0003_storage.sql
-- =============================================================================
-- Storage — bucket de anexos e recibos
-- Guarda comprovantes de despesas e recibos de adiantamento.
-- Caminhos usam UUID (não enumeráveis); bucket público para link direto.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;

-- Leitura pública (o caminho é um UUID não adivinhável).
create policy "anexos_read"
  on storage.objects for select
  using (bucket_id = 'anexos');

-- Upload/edição/remoção apenas por usuários autenticados.
create policy "anexos_insert"
  on storage.objects for insert
  with check (bucket_id = 'anexos' and auth.uid() is not null);

create policy "anexos_update"
  on storage.objects for update
  using (bucket_id = 'anexos' and auth.uid() is not null);

create policy "anexos_delete"
  on storage.objects for delete
  using (bucket_id = 'anexos' and auth.uid() is not null);


-- >>> migrations/0004_percentuais_mensais.sql
-- =============================================================================
-- Percentuais por mês (variam de um mês para o outro).
-- chave = qual percentual; entidade_id = corretor/parceiro/construtora
-- (null para os globais: imposto da imobiliária e dízimo).
-- =============================================================================

create type public.percentual_chave as enum (
  'comissao_construtora',
  'repasse_parceiro',
  'comissao_corretor',
  'imposto_nf_corretor',
  'imposto_imobiliaria',
  'dizimo'
);

create table public.percentuais_mensais (
  id uuid primary key default gen_random_uuid(),
  chave public.percentual_chave not null,
  entidade_id uuid,
  competencia date not null, -- 1º dia do mês
  percentual numeric(6,5) not null,
  created_at timestamptz not null default now()
);

-- Unicidade: um valor por (chave, entidade, mês). Índices parciais cobrem o
-- caso global (entidade_id null) e o por-entidade separadamente.
create unique index uq_pm_global
  on public.percentuais_mensais (chave, competencia)
  where entidade_id is null;
create unique index uq_pm_entidade
  on public.percentuais_mensais (chave, entidade_id, competencia)
  where entidade_id is not null;
create index idx_pm_lookup
  on public.percentuais_mensais (chave, entidade_id, competencia);

alter table public.percentuais_mensais enable row level security;

create policy pm_read on public.percentuais_mensais
  for select using (auth.uid() is not null);
create policy pm_write on public.percentuais_mensais
  for all using (public.is_admin_fin()) with check (public.is_admin_fin());


-- >>> migrations/0005_refatoracao_financeiro.sql
-- =============================================================================
-- Refatoração do módulo financeiro
-- Parceria manual na venda, status de pagamento do corretor por venda,
-- tipo de entrada "investidor", adiantamentos por venda, remoção da
-- distribuição global e backfill de vencimentos recorrentes.
-- Compatível com os dados existentes (backfill incluído).
-- =============================================================================

-- ---- Enum de status de pagamento do corretor -------------------------------
do $$ begin
  create type public.status_pagamento_corretor as enum ('aguardando_liberacao', 'pago');
exception when duplicate_object then null; end $$;

-- ---- Vendas: campos de parceria + desconto + status do corretor ------------
alter table public.vendas
  add column if not exists possui_parceria boolean not null default false,
  add column if not exists empresa_parceira text,
  add column if not exists percentual_parceria numeric(6,5) not null default 0,
  add column if not exists valor_parceria numeric(14,2) not null default 0,
  add column if not exists liquido_pos_parceria numeric(14,2) not null default 0,
  add column if not exists percentual_desconto_parceiro numeric(6,5) not null default 0,
  add column if not exists status_pagamento_corretor public.status_pagamento_corretor
    not null default 'aguardando_liberacao';

-- Backfill: vendas COM parceiro do cadastro antigo.
update public.vendas v set
  possui_parceria = true,
  percentual_parceria = coalesce(v.percentual_parceiro, 0),
  valor_parceria = coalesce(v.valor_parceiro, 0),
  liquido_pos_parceria = coalesce(v.saldo_pos_parceiro, v.comissao_bruta),
  empresa_parceira = par.nome
from public.parceiros par
where v.parceiro_id = par.id;

-- Backfill: vendas SEM parceiro → líquido pós-parceria = comissão bruta.
update public.vendas set
  liquido_pos_parceria = comissao_bruta
where parceiro_id is null;

-- Migração de status: 'pago' vira 'recebido' + status_pagamento_corretor 'pago'.
update public.vendas set status_pagamento_corretor = 'pago' where status = 'pago';
update public.vendas set status = 'recebido' where status = 'pago';

create index if not exists idx_vendas_status_pgto_corretor
  on public.vendas (status_pagamento_corretor);

-- ---- Entradas: novo tipo "investidor" --------------------------------------
alter type public.entrada_tipo add value if not exists 'investidor';

-- ---- Adiantamentos por venda -----------------------------------------------
alter table public.adiantamentos
  add column if not exists venda_id uuid references public.vendas (id) on delete set null,
  add column if not exists observacoes text;
create index if not exists idx_adiantamentos_venda on public.adiantamentos (venda_id);

-- ---- Configurações: remover distribuição global ----------------------------
alter table public.configuracoes
  drop column if exists percentual_distribuicao_empresa,
  drop column if exists percentual_distribuicao_pessoal;

-- ---- Lançamentos recorrentes: preencher vencimento de cada ocorrência ------
update public.lancamentos l
set data_vencimento =
  date_trunc('month', l.competencia)::date
  + (least(
       extract(day from base.data_vencimento)::int,
       extract(day from (date_trunc('month', l.competencia) + interval '1 month' - interval '1 day'))::int
     ) - 1)
from (
  select recorrencia_grupo,
         min(data_vencimento) filter (where data_vencimento is not null) as data_vencimento
  from public.lancamentos
  where recorrencia_grupo is not null
  group by recorrencia_grupo
) base
where l.recorrencia_grupo = base.recorrencia_grupo
  and l.data_vencimento is null
  and base.data_vencimento is not null;


-- >>> migrations/0006_venda_cliente.sql
-- =============================================================================
-- Venda: campos adicionais (torre e dados do cliente).
-- Somente adição de colunas — não quebra o código atual.
-- =============================================================================

alter table public.vendas
  add column if not exists torre text,
  add column if not exists cliente_nascimento date,
  add column if not exists cliente_telefone text;


-- >>> seed.sql
-- =============================================================================
-- Sistema Financeiro Zefer — Seed mínimo (sem dados históricos)
-- Apenas a configuração padrão e a taxonomia de categorias do documento.
-- Tudo é editável depois na tela de Configurações.
-- =============================================================================

-- Linha única de configuração com os percentuais verificados nas planilhas.
insert into public.configuracoes (id)
values (true)
on conflict (id) do nothing;

-- Categorias financeiras padrão (editáveis).
insert into public.categorias_financeiras (nome, tipo) values
  ('Estrutura',        'custo_fixo'),
  ('Funcionários',     'custo_fixo'),
  ('Jurídico',         'custo_fixo'),
  ('CRECI',            'custo_fixo'),
  ('Sistemas',         'custo_fixo'),
  ('Marketing',        'custo_fixo'),
  ('Contabilidade',    'custo_fixo'),
  ('Impostos',         'custo_fixo'),
  ('Outros',           'custo_fixo'),
  ('Marketing',        'despesa_variavel'),
  ('Estrutura',        'despesa_variavel'),
  ('Compras',          'despesa_variavel'),
  ('Outros',           'despesa_variavel'),
  ('Equipamentos',     'investimento'),
  ('Reforma',          'investimento'),
  ('Móveis',           'investimento'),
  ('Marketing Inicial','investimento'),
  ('Outros',           'investimento')
on conflict (nome, tipo) do nothing;

