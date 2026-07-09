-- 0009_corretor_creci_email
-- Dados de contato/registro do corretor: CRECI e e-mail.

alter table public.corretores
  add column if not exists creci text,
  add column if not exists email text;
