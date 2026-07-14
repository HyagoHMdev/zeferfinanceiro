-- 0012_adiantamento_despesa
-- Todo adiantamento cadastrado gera automaticamente uma despesa variável da
-- empresa (lançamento espelho). O vínculo fica em adiantamentos.lancamento_id
-- para editar/excluir em sincronia.

alter table public.adiantamentos
  add column if not exists lancamento_id uuid references public.lancamentos (id) on delete set null;

-- Categoria padrão do lançamento espelho.
insert into public.categorias_financeiras (nome, tipo)
values ('Adiantamentos', 'despesa_variavel')
on conflict (nome, tipo) do nothing;
