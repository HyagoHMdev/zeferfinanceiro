-- 0017_entrada_escopo_joinville
-- Permite registrar uma entrada (aba Entradas) com destino "Zefer Joinville":
-- 100% do líquido vai para a carteira Joinville, sem split empresa/pessoal.
--
-- - Novo destino de distribuição "joinville" (a entrada gera 1 distribuição).
-- - Coluna escopo na entrada para diferenciar da entrada normal (empresa).
--
-- Isolamento: a receita Joinville NÃO entra no dashboard/DRE da Zefer (o app
-- filtra escopo <> 'joinville'); entra só no caixa da Zefer Joinville.

alter type financeiro.distribuicao_destino add value if not exists 'joinville';

alter table financeiro.entradas
  add column if not exists escopo text not null default 'empresa';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'financeiro.entradas'::regclass and conname = 'entradas_escopo_check'
  ) then
    alter table financeiro.entradas
      add constraint entradas_escopo_check check (escopo in ('empresa', 'joinville'));
  end if;
end$$;
