-- 0007_lancamento_observacoes
-- Campo livre de observações no lançamento (ex.: chave PIX, instruções de pagamento).

alter table public.lancamentos
  add column if not exists observacoes text;
