-- =============================================================================
-- Venda: campos adicionais (torre e dados do cliente).
-- Somente adição de colunas — não quebra o código atual.
-- =============================================================================

alter table public.vendas
  add column if not exists torre text,
  add column if not exists cliente_nascimento date,
  add column if not exists cliente_telefone text;
