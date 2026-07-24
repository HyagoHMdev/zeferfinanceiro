-- ============================================================
-- Pagamento de comissão ao corretor debita o caixa (saldo Empresa).
-- Antes, registrar o pagamento não gerava saída no caixa. Agora cria uma
-- despesa paga (escopo empresa) ligada ao pagamento; o estorno remove por
-- cascata (delete do pagamento). Rode no SQL Editor do banco do painel.
-- ============================================================

alter table financeiro.lancamentos
  add column if not exists pagamento_id uuid
    references financeiro.pagamentos_corretor (id) on delete cascade;

create index if not exists idx_lancamentos_pagamento
  on financeiro.lancamentos (pagamento_id);

insert into financeiro.categorias_financeiras (nome, tipo)
select 'Comissões de corretores', 'despesa_variavel'
where not exists (
  select 1 from financeiro.categorias_financeiras
  where nome = 'Comissões de corretores' and tipo = 'despesa_variavel'
);
