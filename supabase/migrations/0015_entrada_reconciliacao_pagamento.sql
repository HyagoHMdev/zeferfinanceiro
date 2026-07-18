-- 0015_entrada_reconciliacao_pagamento
-- No pagamento da comissão ao corretor, os adiantamentos descontados voltam ao
-- caixa como entrada (100% empresa), cancelando a despesa variável que foi
-- lançada quando o adiantamento foi dado. A entrada fica ligada ao pagamento;
-- se o pagamento for estornado (deletado), a entrada e suas distribuições somem
-- junto (cascade). A criação da entrada + distribuição fica na action
-- registrarPagamento.

alter table public.entradas
  add column if not exists pagamento_id uuid references public.pagamentos_corretor(id) on delete cascade;
create index if not exists idx_entradas_pagamento on public.entradas(pagamento_id);
