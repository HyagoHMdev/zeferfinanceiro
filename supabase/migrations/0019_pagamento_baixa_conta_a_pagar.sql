-- Registrar o pagamento de um funcionário criava um lançamento NOVO ("Pagamento
-- de Fulano") e deixava o salário do mês pendente em contas a pagar. A despesa
-- contava duas vezes e a conta nunca baixava.
--
-- Para o pagamento poder quitar a conta certa, o lançamento passa a saber de
-- quem ele é.
alter table financeiro.lancamentos
  add column if not exists colaborador_id uuid
    references financeiro.corretores (id) on delete set null;

create index if not exists lancamentos_colaborador_idx
  on financeiro.lancamentos (colaborador_id, status)
  where colaborador_id is not null;

-- Vincula as séries de salário que já existem. O vínculo vale para o grupo de
-- recorrência inteiro, então os meses futuros já nascem ligados.
--   5c2597f6 = EMPREGADA - DANI        -> Daniele Silva de Macena
--   afa3c9f6 = HEAD DE MARKETING       -> Hyago Matos
--   8f30318c = Recepção - Paola        -> Paolla Ramos Freitas
update financeiro.lancamentos
set colaborador_id = 'faec9a8a-099b-4602-892c-c00369122612'
where recorrencia_grupo = '5c2597f6-f643-471d-8cb8-eaa9406d52dc';

update financeiro.lancamentos
set colaborador_id = '14a9f0ed-4206-416d-aa85-276a5f318291'
where recorrencia_grupo = 'afa3c9f6-b0d9-47a8-86fa-687de8b4fda2';

update financeiro.lancamentos
set colaborador_id = '4b9a556f-9f1a-4c5d-931f-c644f8467210'
where recorrencia_grupo = '8f30318c-8a3c-40f8-a2f7-fa0f1a4989b7';

-- Agora um pagamento pode fazer duas coisas com lançamentos: CRIAR um (o resto
-- que não estava previsto) ou QUITAR um que já existia em contas a pagar.
--
-- O estorno tem que tratar os dois casos de forma oposta: o criado some junto,
-- o quitado volta a ficar pendente. Sem essa marca, o cascade apagaria a conta
-- a pagar do mês, que é o oposto de estornar.
alter table financeiro.lancamentos
  add column if not exists criado_pelo_pagamento boolean not null default false;

-- Até aqui, todo lançamento ligado a um pagamento tinha sido criado por ele.
update financeiro.lancamentos
set criado_pelo_pagamento = true
where pagamento_id is not null;
