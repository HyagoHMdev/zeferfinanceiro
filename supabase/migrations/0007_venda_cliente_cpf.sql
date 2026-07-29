-- CPF do cliente na venda (junto dos demais dados de cliente que já existem:
-- nome, nascimento e telefone). Guardado como texto: CPF tem zeros à esquerda,
-- e o formulário grava já formatado (000.000.000-00), que é como sai no recibo.
alter table financeiro.vendas
  add column if not exists cliente_cpf text;

comment on column financeiro.vendas.cliente_cpf is
  'CPF do cliente comprador, só dígitos ou formatado; usado nos recibos e contratos.';
