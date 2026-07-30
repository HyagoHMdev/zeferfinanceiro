-- De onde veio o cliente desta venda (canal de aquisição).
-- Texto livre em vez de enum: a lista de canais muda com o tempo (entra um
-- portal novo, sai outro) e enum exigiria migração a cada mudança. A tela
-- oferece as opções padrão; o detalhe guarda o "qual" (nome de quem indicou,
-- qual portal, qual evento).
alter table financeiro.vendas
  add column if not exists origem text,
  add column if not exists origem_detalhe text;

comment on column financeiro.vendas.origem is
  'Canal de aquisição do cliente: Instagram, Anúncio, Indicação, Site, etc.';
comment on column financeiro.vendas.origem_detalhe is
  'Complemento livre: quem indicou, qual portal, qual evento.';

create index if not exists vendas_origem_idx on financeiro.vendas (origem);
