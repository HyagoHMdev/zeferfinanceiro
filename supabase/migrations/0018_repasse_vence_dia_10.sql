-- O repasse ao investidor vence sempre no dia 10 do mês seguinte à venda.
-- Antes usava a própria data da venda (ver 0013), o que colocava o vencimento
-- no mesmo dia em que a obrigação nascia.
create or replace function financeiro.sincronizar_repasse_investidor(p_venda uuid)
returns void language plpgsql security definer
set search_path to 'financeiro', 'public' as $$
declare v record; i record; venc date;
begin
  select * into v from financeiro.vendas where id = p_venda;
  if not found then
    delete from financeiro.lancamentos where origem_venda_id = p_venda;
    return;
  end if;

  venc := (date_trunc('month', v.data_venda) + interval '1 month')::date + 9;

  delete from financeiro.lancamentos l
  where l.origem_venda_id = p_venda
    and not exists (
      select 1 from public.investidor_vendas iv
      join public.investidores inv on inv.id = iv.investidor_id and inv.ativo
      where iv.venda_id = p_venda and iv.investidor_id = l.origem_investidor_id
    );

  for i in
    select inv.id, inv.nome, coalesce(inv.percentual, 0) as percentual
    from public.investidor_vendas iv
    join public.investidores inv on inv.id = iv.investidor_id
    where iv.venda_id = p_venda and inv.ativo
  loop
    insert into financeiro.lancamentos (
      escopo, natureza, descricao, valor, competencia, data_vencimento, status,
      origem_venda_id, origem_investidor_id, observacoes
    ) values (
      'empresa', 'despesa_variavel',
      'Repasse investidor · ' || i.nome || coalesce(' · ' || nullif(v.cliente, ''), ''),
      round(coalesce(v.lucro_liquido, 0) * (i.percentual / 100.0), 2),
      date_trunc('month', v.data_venda)::date,
      venc,
      'pendente',
      p_venda, i.id,
      'Gerado automaticamente pela venda. O valor acompanha o lucro líquido dela.'
    )
    on conflict (origem_venda_id, origem_investidor_id) do update
      set valor = excluded.valor,
          descricao = excluded.descricao,
          competencia = excluded.competencia,
          data_vencimento = excluded.data_vencimento,
          updated_at = now();
  end loop;
end $$;

-- Realinha os repasses já existentes que ainda não foram pagos.
update financeiro.lancamentos l
set data_vencimento = (date_trunc('month', v.data_venda) + interval '1 month')::date + 9
from financeiro.vendas v
where v.id = l.origem_venda_id
  and l.origem_investidor_id is not null
  and l.status <> 'pago';
