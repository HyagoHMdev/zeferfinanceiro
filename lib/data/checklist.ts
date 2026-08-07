import { createAdminClient } from "@/lib/supabase/admin";
import { telefoneChave, umaCampanha, type LeadDaVenda } from "@/lib/data/lead";

/**
 * Submissões de venda feitas pelos corretores no painel, aguardando aprovação.
 *
 * Vive em public.vendas_checklist (schema do painel), por isso o client admin
 * com .schema("public"): o client padrão deste app aponta para o schema
 * `financeiro`.
 */
export interface ChecklistPendente {
  id: string;
  corretorNome: string | null;
  construtora: string;
  empreendimento: string;
  unidade: string | null;
  torre: string | null;
  valorContrato: number;
  clienteNome: string;
  clienteCpf: string | null;
  clienteTelefone: string | null;
  clienteEmail: string | null;
  clienteNascimento: string | null;
  clienteCidade: string | null;
  clienteEstado: string | null;
  finalidade: string | null;
  origem: string | null;
  docs: { rotulo: string; arquivos: { path: string; nome: string }[] }[];
  // Contrato e comprovante de pagamento sao o que o aceite exige; o corretor
  // pode enviar a venda sem eles e anexar depois.
  podeAprovar: boolean;
  // Lead do CRM com o mesmo telefone. Aparece já na fila, antes de a venda
  // existir: quem aprova quer saber de onde o cliente veio na hora de decidir,
  // não depois.
  lead: LeadDaVenda | null;
  criadoEm: string;
}

type Linha = {
  id: string;
  construtora: string;
  empreendimento: string;
  unidade: string | null;
  torre: string | null;
  valor_contrato: number;
  cliente_nome: string;
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_nascimento: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  finalidade: string | null;
  origem: string | null;
  doc_cliente: { path: string; nome: string }[];
  doc_residencia: { path: string; nome: string }[];
  doc_contrato: { path: string; nome: string }[];
  doc_pagamento: { path: string; nome: string }[];
  created_at: string;
  profiles: { nome: string | null } | null;
};

type LinhaLeadFila = {
  id: string;
  nome: string | null;
  fonte: string | null;
  origem: string | null;
  origem_form: string | null;
  utm: string | null;
  campanha_id: string | null;
  campanhas: unknown;
  created_at: string;
};

export async function listarChecklistsPendentes(): Promise<ChecklistPendente[]> {
  const pub = createAdminClient().schema("public");
  const { data } = await pub
    .from("vendas_checklist")
    .select("*, profiles!vendas_checklist_corretor_id_fkey(nome)")
    .eq("status", "aguardando_aprovacao")
    .order("created_at", { ascending: true });

  const linhas = (data ?? []) as unknown as Linha[];

  // Leads de todos os telefones da fila numa consulta só, em vez de uma por
  // submissão. Mais antigo por telefone: contato repetido é o mesmo cliente
  // voltando, e a pergunta é quando ele chegou.
  const chaves = [...new Set(linhas.map((r) => telefoneChave(r.cliente_telefone)).filter(Boolean))] as string[];
  const porChave = new Map<string, LeadDaVenda>();
  if (chaves.length) {
    const { data: leads } = await pub
      .from("leads")
      .select("id,nome,fonte,origem,origem_form,utm,campanha_id,created_at,telefone_chave,campanhas:campanha_id(nome,plataforma)")
      .in("telefone_chave", chaves)
      .order("created_at", { ascending: true });
    for (const l of (leads ?? []) as unknown as (LinhaLeadFila & { telefone_chave: string })[]) {
      if (!porChave.has(l.telefone_chave)) {
        porChave.set(l.telefone_chave, {
          id: l.id,
          nome: l.nome,
          fonte: l.fonte,
          origem: l.origem,
          origemForm: l.origem_form,
          utm: l.utm,
          campanhaId: l.campanha_id,
          campanhaNome: umaCampanha(l.campanhas as never)?.nome ?? null,
          plataforma: umaCampanha(l.campanhas as never)?.plataforma ?? null,
          primeiroContato: l.created_at,
        });
      }
    }
  }

  return linhas.map((r) => ({
    id: r.id,
    corretorNome: r.profiles?.nome ?? null,
    construtora: r.construtora,
    empreendimento: r.empreendimento,
    unidade: r.unidade,
    torre: r.torre,
    valorContrato: Number(r.valor_contrato),
    clienteNome: r.cliente_nome,
    clienteCpf: r.cliente_cpf,
    clienteTelefone: r.cliente_telefone,
    clienteEmail: r.cliente_email,
    clienteNascimento: r.cliente_nascimento,
    clienteCidade: r.cliente_cidade,
    clienteEstado: r.cliente_estado,
    finalidade: r.finalidade,
    origem: r.origem,
    docs: [
      { rotulo: "Documentos do cliente", arquivos: r.doc_cliente ?? [] },
      { rotulo: "Comprovante de residência", arquivos: r.doc_residencia ?? [] },
      { rotulo: "Contrato", arquivos: r.doc_contrato ?? [] },
      { rotulo: "Comprovante de pagamento", arquivos: r.doc_pagamento ?? [] },
    ],
    podeAprovar: (r.doc_contrato ?? []).length > 0 && (r.doc_pagamento ?? []).length > 0,
    lead: porChave.get(telefoneChave(r.cliente_telefone) ?? "") ?? null,
    criadoEm: r.created_at,
  }));
}

export async function buscarChecklist(id: string): Promise<ChecklistPendente | null> {
  const todos = await listarChecklistsPendentes();
  return todos.find((c) => c.id === id) ?? null;
}
