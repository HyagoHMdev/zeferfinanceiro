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
