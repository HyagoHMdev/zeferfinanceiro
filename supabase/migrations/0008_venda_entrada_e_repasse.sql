-- ============================================================================
-- 1) Venda -> Entrada (agora por gatilho, e não só no cadastro pelo app)
-- ============================================================================
-- A venda já criava a entrada no cadastro, mas EDITAR a venda não mexia na
-- entrada: o lucro mudava e a entrada ficava com o valor velho. E venda
-- cadastrada com lucro zero, depois corrigida, nunca ganhava entrada.
-- Como gatilho, vale para qualquer caminho de escrita (app, painel ou SQL).

create unique index if not exists entradas_venda_uq
  on financeiro.entradas (venda_id) where venda_id is not null;

create or replace function financeiro.sincronizar_entrada_venda(p_venda uuid)
returns void language plpgsql security definer
set search_path to 'financeiro', 'public' as $$
declare v record; ent_id uuid; val numeric;
begin
  select * into v from financeiro.vendas where id = p_venda;
  if not found then
    delete from financeiro.entradas where venda_id = p_venda;
    return;
  end if;

  val := round(coalesce(v.lucro_liquido, 0), 2);
  if val <= 0 then
    delete from financeiro.entradas where venda_id = p_venda;
    return;
  end if;

  insert into financeiro.entradas (
    data, tipo, descricao, valor, percentual_dizimo, valor_dizimo, liquido, venda_id, escopo
  ) values (
    v.data_venda, 'comissao',
    coalesce('Comissão · ' || nullif(v.cliente, ''), 'Comissão da venda'),
    val, 0, 0, val, p_venda, 'empresa'
  )
  -- O índice é parcial, então o ON CONFLICT repete a mesma condição.
  on conflict (venda_id) where venda_id is not null do update
    set data = excluded.data, descricao = excluded.descricao,
        valor = excluded.valor, liquido = excluded.liquido, updated_at = now()
  returning id into ent_id;

  if ent_id is null then
    select id into ent_id from financeiro.entradas where venda_id = p_venda;
  end if;

  delete from financeiro.distribuicoes where entrada_id = ent_id;
  insert into financeiro.distribuicoes (entrada_id, destino, percentual, valor) values
    (ent_id, 'empresa', 0, 0),
    (ent_id, 'pessoal', 1, val);
end $$;

create or replace function financeiro.trg_venda_entrada()
returns trigger language plpgsql security definer
set search_path to 'financeiro', 'public' as $$
begin
  perform financeiro.sincronizar_entrada_venda(new.id);
  return new;
end $$;

drop trigger if exists venda_entrada_trg on financeiro.vendas;
create trigger venda_entrada_trg
  after insert or update on financeiro.vendas
  for each row execute function financeiro.trg_venda_entrada();

-- ============================================================================
-- 2) Repasse ao investidor como despesa variável
-- ============================================================================
-- (tabela public.investidor_vendas e a função de sincronização vivem no painel;
--  aqui ficam só as colunas de origem no lançamento, para referência)
alter table financeiro.lancamentos
  add column if not exists origem_venda_id uuid
    references financeiro.vendas(id) on delete cascade,
  add column if not exists origem_investidor_id uuid
    references public.investidores(id) on delete cascade;

create unique index if not exists lancamentos_repasse_uq
  on financeiro.lancamentos (origem_venda_id, origem_investidor_id);
