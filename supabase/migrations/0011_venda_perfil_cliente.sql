-- Perfil do comprador: serve para saber PARA QUEM a Zefer vende (finalidade,
-- profissão, de onde é) e alimentar segmentação de campanha depois.
alter table financeiro.vendas
  add column if not exists cliente_finalidade text,
  add column if not exists cliente_profissao text,
  add column if not exists cliente_cidade text,
  add column if not exists cliente_estado text,
  add column if not exists cliente_email text;

comment on column financeiro.vendas.cliente_finalidade is
  'Para que comprou: Moradia, Investimento ou Veraneio.';
comment on column financeiro.vendas.cliente_estado is 'UF de residência do cliente.';

create index if not exists vendas_finalidade_idx on financeiro.vendas (cliente_finalidade);
create index if not exists vendas_cliente_estado_idx on financeiro.vendas (cliente_estado);
