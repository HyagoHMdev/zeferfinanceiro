-- ============================================================
-- Distingue corretor de funcionário na tabela de pessoas (corretores).
-- Funcionário pode receber adiantamento, mas não aparece como vendedor.
-- Linhas existentes viram 'corretor' pelo default ao adicionar a coluna.
-- Rode no SQL Editor do banco do painel (schema financeiro).
-- ============================================================

alter table financeiro.corretores
  add column if not exists tipo text not null default 'corretor'
    check (tipo in ('corretor', 'funcionario'));
