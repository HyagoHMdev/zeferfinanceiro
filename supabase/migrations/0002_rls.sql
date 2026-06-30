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
