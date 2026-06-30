-- =============================================================================
-- Sistema Financeiro Zefer — Seed mínimo (sem dados históricos)
-- Apenas a configuração padrão e a taxonomia de categorias do documento.
-- Tudo é editável depois na tela de Configurações.
-- =============================================================================

-- Linha única de configuração com os percentuais verificados nas planilhas.
insert into public.configuracoes (id)
values (true)
on conflict (id) do nothing;

-- Categorias financeiras padrão (editáveis).
insert into public.categorias_financeiras (nome, tipo) values
  ('Estrutura',        'custo_fixo'),
  ('Funcionários',     'custo_fixo'),
  ('Jurídico',         'custo_fixo'),
  ('CRECI',            'custo_fixo'),
  ('Sistemas',         'custo_fixo'),
  ('Marketing',        'custo_fixo'),
  ('Contabilidade',    'custo_fixo'),
  ('Impostos',         'custo_fixo'),
  ('Outros',           'custo_fixo'),
  ('Marketing',        'despesa_variavel'),
  ('Estrutura',        'despesa_variavel'),
  ('Compras',          'despesa_variavel'),
  ('Outros',           'despesa_variavel'),
  ('Equipamentos',     'investimento'),
  ('Reforma',          'investimento'),
  ('Móveis',           'investimento'),
  ('Marketing Inicial','investimento'),
  ('Outros',           'investimento')
on conflict (nome, tipo) do nothing;
