-- 0011_corretor_cpf
-- CPF do corretor (usado no recibo de adiantamento).

alter table public.corretores
  add column if not exists cpf text;
