-- 0013_adiantamento_despesa_trigger
-- Ao excluir um adiantamento (por qualquer caminho, inclusive o cascade quando
-- um corretor é removido), apaga junto o lançamento-espelho (despesa variável).
-- Evita despesas "pago" órfãs inflando o Financeiro.

create or replace function public.excluir_despesa_do_adiantamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.lancamento_id is not null then
    delete from public.lancamentos where id = old.lancamento_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_adiantamento_delete_despesa on public.adiantamentos;
create trigger trg_adiantamento_delete_despesa
  after delete on public.adiantamentos
  for each row execute function public.excluir_despesa_do_adiantamento();
