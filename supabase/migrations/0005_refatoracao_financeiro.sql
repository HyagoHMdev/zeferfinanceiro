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
