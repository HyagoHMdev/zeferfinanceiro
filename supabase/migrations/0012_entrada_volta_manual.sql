-- Volta atrás: a venda não cria/atualiza mais a entrada. O lançamento em
-- Entradas passa a ser manual de novo.
--
-- Só o GATILHO sai. As entradas já lançadas ficam como estão (inclusive o
-- venda_id, que preserva de qual venda cada uma veio). A função continua no
-- banco, sem estar ligada a nada: serve para religar isto no futuro com uma
-- linha só, ou para ressincronizar uma venda pontual à mão.
drop trigger if exists venda_entrada_trg on financeiro.vendas;

comment on function financeiro.sincronizar_entrada_venda(uuid) is
  'DESLIGADA: nao ha gatilho chamando. Entradas sao lancadas manualmente. '
  'Chamar a mao so se quiser espelhar uma venda especifica em Entradas.';

-- Para religar no futuro:
--   create trigger venda_entrada_trg
--     after insert or update on financeiro.vendas
--     for each row execute function financeiro.trg_venda_entrada();
