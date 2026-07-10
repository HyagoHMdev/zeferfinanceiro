-- 0010_adiantamento_recibo_ok
-- Marca se o recibo (vale) assinado do adiantamento já foi recolhido.
-- Adiantamentos avulsos (vale) usam venda_id = null; são descontados no
-- pagamento das comissões do corretor, junto dos adiantamentos por venda.

alter table public.adiantamentos
  add column if not exists recibo_ok boolean not null default false;
