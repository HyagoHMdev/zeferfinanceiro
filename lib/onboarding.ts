/**
 * Conteúdo de onboarding/ajuda por tela. Cada tela tem um texto de introdução e
 * uma lista de tópicos (o que é / como usar). Renderizado pelo componente
 * <OnboardingHelp screen="..." />, que abre sozinho na primeira visita e pode
 * ser reaberto pelo botão "?" no cabeçalho.
 *
 * Para editar a ajuda de uma tela, altere só este arquivo.
 */

export interface OnboardingTopico {
  titulo: string;
  texto: string;
}

export interface OnboardingConteudo {
  titulo: string;
  intro: string;
  topicos: OnboardingTopico[];
}

export type OnboardingScreen =
  | "dashboard"
  | "vendas"
  | "vendas-form"
  | "corretores"
  | "corretores-processar"
  | "pagamentos"
  | "entradas"
  | "financeiro-caixa"
  | "financeiro-a-pagar"
  | "financeiro-fluxo"
  | "financeiro-lancamentos"
  | "meu-extrato"
  | "relatorios"
  | "configuracoes";

export const ONBOARDING: Record<OnboardingScreen, OnboardingConteudo> = {
  dashboard: {
    titulo: "Dashboard",
    intro:
      "A visão geral do financeiro da Zefer: os principais números e o gráfico de Receita × Despesa.",
    topicos: [
      {
        titulo: "Filtro de período",
        texto:
          "No topo você escolhe o ano e, se quiser, um mês. Os indicadores recalculam para o período escolhido.",
      },
      {
        titulo: "O gráfico segue o ano",
        texto:
          "O gráfico Receita × Despesa sempre mostra o ano inteiro (Jan–Dez) do ano selecionado, mesmo com um mês escolhido.",
      },
      {
        titulo: "Saldo em caixa",
        texto:
          "É o saldo corrente acumulado até o fim do período — não apenas a movimentação daquele mês.",
      },
    ],
  },
  vendas: {
    titulo: "Vendas",
    intro:
      "Onde ficam todas as vendas cadastradas, com o status de recebimento de cada uma.",
    topicos: [
      {
        titulo: "Nova venda",
        texto:
          "Use o botão de nova venda para cadastrar. Ao salvar, o sistema já cria uma Entrada com o Líquido Zefer e marca a venda como Recebido.",
      },
      {
        titulo: "Status na lista",
        texto:
          "Dá para mudar o status (Aguardando recebimento / Recebido / Pago) direto na lista, sem abrir a venda.",
      },
      {
        titulo: "Comissão do corretor",
        texto:
          "A parte do corretor é ajustada na tela Corretores; aqui você cuida do lado da imobiliária até o Líquido Zefer.",
      },
    ],
  },
  "vendas-form": {
    titulo: "Cadastro de venda",
    intro:
      "Preencha em três blocos: dados da venda, parceria (se houver) e valores. O painel calcula tudo ao vivo.",
    topicos: [
      {
        titulo: "Percentuais",
        texto:
          "Os percentuais vêm dos cadastros/mês, mas você pode editar na mão nesta tela. A parceria incide sobre o VGV (por isso costuma ser um número pequeno, ~1%).",
      },
      {
        titulo: "Painel de valores",
        texto:
          "À direita, a cadeia é calculada em tempo real: comissão bruta → parceria → imposto → Líquido Zefer.",
      },
      {
        titulo: "Ao salvar",
        texto:
          "A venda entra na lista e gera automaticamente a Entrada correspondente (valor = Líquido Zefer).",
      },
    ],
  },
  corretores: {
    titulo: "Corretores",
    intro:
      "As comissões dos corretores, uma linha por venda, com o status de pagamento de cada uma.",
    topicos: [
      {
        titulo: "Status de pagamento",
        texto:
          "Cada comissão fica como Aguardando liberação ou Pago. Dá para alternar direto na lista.",
      },
      {
        titulo: "Processar",
        texto:
          "Em Processar você ajusta os percentuais do corretor (comissão, desconto de parceria, imposto NF) e lança adiantamentos daquela venda.",
      },
      {
        titulo: "Pagamento",
        texto:
          "O pagamento efetivo (com recibo) é feito na tela Pagamentos, que junta as comissões liberadas de cada corretor.",
      },
    ],
  },
  "corretores-processar": {
    titulo: "Processar comissão",
    intro:
      "Detalhe de uma comissão: dados da venda, percentuais do corretor e adiantamentos.",
    topicos: [
      {
        titulo: "Percentuais do corretor",
        texto:
          "Ajuste % de comissão, desconto (quando há parceria) e imposto NF. O resumo recalcula o Líquido do corretor na hora.",
      },
      {
        titulo: "Adiantamentos",
        texto:
          "Lance adiantamentos desta venda. Eles são descontados no Líquido para pagamento e depois no recibo.",
      },
      {
        titulo: "Líquido para pagamento",
        texto:
          "É o que o corretor tem a receber nesta venda: Líquido do corretor − adiantamentos.",
      },
    ],
  },
  pagamentos: {
    titulo: "Pagamentos",
    intro:
      "Onde as comissões liberadas viram pagamento efetivo ao corretor, com recibo imprimível.",
    topicos: [
      {
        titulo: "A pagar",
        texto:
          "Agrupa por corretor as comissões Aguardando liberação e desconta os adiantamentos ainda não quitados. Mostra o líquido a pagar.",
      },
      {
        titulo: "Registrar pagamento",
        texto:
          "Confirma o pagamento: marca as comissões como Pago, gera o registro e abre o recibo para impressão.",
      },
      {
        titulo: "Estornar",
        texto:
          "Em Pagamentos realizados, o estorno desfaz o pagamento (as comissões voltam para Aguardando liberação). Os adiantamentos não são apagados.",
      },
    ],
  },
  entradas: {
    titulo: "Entradas",
    intro:
      "Todo dinheiro que entra: comissões (geradas pelas vendas), bonificações, premiações, investidores e outras.",
    topicos: [
      {
        titulo: "Dízimo e divisão",
        texto:
          "Cada entrada tem o dízimo e a divisão Empresa / Pessoal (que precisa somar 100%).",
      },
      {
        titulo: "Comissões automáticas",
        texto:
          "As entradas do tipo comissão nascem sozinhas quando você cadastra uma venda.",
      },
      {
        titulo: "Filtro por tipo",
        texto:
          "Use o filtro no topo para ver só um tipo de entrada de cada vez.",
      },
    ],
  },
  "financeiro-caixa": {
    titulo: "Caixa",
    intro:
      "O saldo atual e previsto, separado em Empresa (Zefer) e Pessoal.",
    topicos: [
      {
        titulo: "Filtro de mês",
        texto:
          "Sem filtro, mostra tudo. Escolhendo um mês, você decide entre dois modos.",
      },
      {
        titulo: "Movimento do mês",
        texto:
          "Mostra só o que entrou e saiu naquele mês (a movimentação do período).",
      },
      {
        titulo: "Acumulado até o mês",
        texto:
          "Mostra o saldo corrente considerando tudo até o fim do mês escolhido.",
      },
    ],
  },
  "financeiro-a-pagar": {
    titulo: "A Pagar",
    intro:
      "Tudo que ainda está pendente de pagamento, reunido num lugar só e ordenado pelo vencimento mais próximo.",
    topicos: [
      {
        titulo: "Filtrar por mês e dia",
        texto:
          "Escolha o mês do vencimento e, se quiser, um dia específico para ver só o que vence naquela data.",
      },
      {
        titulo: "Vencido x A vencer",
        texto:
          "Os cards no topo mostram o total a pagar, o que já venceu (atrasado) e o que ainda está por vencer.",
      },
      {
        titulo: "Marcar como pago",
        texto:
          "No status de cada linha você pode marcar como pago, editar ou excluir — some da lista assim que quitar.",
      },
    ],
  },
  "financeiro-fluxo": {
    titulo: "Fluxo de Caixa",
    intro:
      "Entradas e saídas da empresa, mês a mês, ao longo do ano.",
    topicos: [
      {
        titulo: "Leitura",
        texto:
          "Cada linha é um mês, com entradas, saídas e o saldo do mês. O total do ano fica no rodapé.",
      },
      {
        titulo: "De onde vêm os números",
        texto:
          "Entradas vêm das comissões/distribuições; saídas, dos lançamentos da empresa.",
      },
    ],
  },
  "financeiro-lancamentos": {
    titulo: "Lançamentos (Financeiro)",
    intro:
      "Custos fixos, despesas variáveis, investimentos e pessoal funcionam do mesmo jeito.",
    topicos: [
      {
        titulo: "Recorrência",
        texto:
          "Um lançamento pode repetir (mensal/anual). Cada ocorrência tem seu próprio vencimento, ajustado ao último dia do mês quando necessário.",
      },
      {
        titulo: "Editar / excluir",
        texto:
          'Em um lançamento recorrente você escolhe aplicar "somente este" ou "todos do grupo".',
      },
      {
        titulo: "Status e filtros",
        texto:
          "O status é colorido (pago/pendente) e vira Atrasado quando o vencimento passa. Filtre por busca, mês, categoria e status.",
      },
      {
        titulo: "Observações",
        texto:
          "Cada lançamento tem um campo livre de observações — útil para anotar uma chave PIX, por exemplo.",
      },
    ],
  },
  "meu-extrato": {
    titulo: "Meu extrato",
    intro:
      "Suas comissões por venda e o status de pagamento de cada uma.",
    topicos: [
      {
        titulo: "Totais",
        texto:
          "No topo: total de comissões, o que ainda está a receber e o que já foi pago.",
      },
      {
        titulo: "Status",
        texto:
          "Cada venda mostra se a comissão está Aguardando liberação ou Paga. O pagamento é processado pelo financeiro.",
      },
    ],
  },
  relatorios: {
    titulo: "Relatórios",
    intro:
      "Visões de leitura para acompanhar o negócio: por corretor, construtora, empreendimento, fluxo de caixa e DRE.",
    topicos: [
      {
        titulo: "Somente leitura",
        texto:
          "Relatórios não alteram dados — são recortes do que já está cadastrado nas outras telas.",
      },
      {
        titulo: "Navegação",
        texto:
          "Use o menu de relatórios para trocar entre as visões disponíveis.",
      },
    ],
  },
  configuracoes: {
    titulo: "Configurações",
    intro:
      "Os parâmetros do sistema: percentuais padrão, cadastros e usuários. Área do Administrador.",
    topicos: [
      {
        titulo: "Parâmetros",
        texto:
          "Percentuais padrão e valores globais por mês (comissão, impostos, dízimo).",
      },
      {
        titulo: "Cadastros",
        texto:
          "Construtoras, empreendimentos, corretores, parceiros, contas, centros de custo, fornecedores e categorias — com percentuais por mês por entidade.",
      },
      {
        titulo: "Usuários",
        texto:
          "Perfis de acesso: Administrador, Financeiro, Diretor e Corretor.",
      },
    ],
  },
};
