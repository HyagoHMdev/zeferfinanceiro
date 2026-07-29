-- Cliente com data de nascimento na venda entra sozinho em Aniversários.
-- Como gatilho (e não no código do formulário), vale também quando a venda é
-- editada depois para incluir ou corrigir o nascimento.
alter table public.aniversariantes
  add column if not exists venda_id uuid
    references financeiro.vendas(id) on delete set null;

create unique index if not exists aniversariantes_venda_uq
  on public.aniversariantes (venda_id) where venda_id is not null;

/**
 * Espelha o cliente da venda em Aniversários.
 *
 * Deduplica em duas frentes: pela venda (edição não duplica) e pela pessoa
 * (mesmo nome + mesmo dia/mês), porque cliente que compra duas vezes é a mesma
 * pessoa fazendo aniversário no mesmo dia, não duas.
 */
create or replace function public.sincronizar_aniversariante_venda(p_venda uuid)
returns void language plpgsql security definer
set search_path to 'public', 'financeiro' as $$
declare v record; alvo uuid; d smallint; m smallint;
begin
  select * into v from financeiro.vendas where id = p_venda;

  if not found
     or v.cliente_nascimento is null
     or coalesce(trim(v.cliente), '') = '' then
    delete from public.aniversariantes where venda_id = p_venda;
    return;
  end if;

  d := extract(day from v.cliente_nascimento)::smallint;
  m := extract(month from v.cliente_nascimento)::smallint;

  select id into alvo from public.aniversariantes where venda_id = p_venda;

  if alvo is null then
    select id into alvo
    from public.aniversariantes
    where lower(trim(nome)) = lower(trim(v.cliente))
      and dia = d and mes = m and venda_id is null
    limit 1;
  end if;

  if alvo is null then
    insert into public.aniversariantes (nome, dia, mes, telefone, venda_id)
    values (trim(v.cliente), d, m, nullif(trim(coalesce(v.cliente_telefone, '')), ''), p_venda);
  else
    update public.aniversariantes
       set nome = trim(v.cliente), dia = d, mes = m,
           -- Não apaga um telefone já cadastrado se a venda vier sem ele.
           telefone = coalesce(nullif(trim(coalesce(v.cliente_telefone, '')), ''), telefone),
           venda_id = p_venda
     where id = alvo;
  end if;
end $$;

create or replace function public.trg_venda_aniversariante()
returns trigger language plpgsql security definer
set search_path to 'public', 'financeiro' as $$
begin
  perform public.sincronizar_aniversariante_venda(new.id);
  return new;
end $$;

drop trigger if exists venda_aniversariante_trg on financeiro.vendas;
create trigger venda_aniversariante_trg
  after insert or update on financeiro.vendas
  for each row execute function public.trg_venda_aniversariante();
