-- 0014_recibo_assinatura
-- Assinatura digital do recibo (desenhada) + aceite eletrônico (data/hora/IP).
-- O corretor assina pelo link público; o servidor grava estes campos.

alter table public.pagamentos_corretor
  add column if not exists assinatura_url text,
  add column if not exists assinado_em timestamptz,
  add column if not exists assinado_ip text;

alter table public.adiantamentos
  add column if not exists assinatura_url text,
  add column if not exists assinado_em timestamptz,
  add column if not exists assinado_ip text;
