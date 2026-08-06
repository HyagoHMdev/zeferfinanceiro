import { createAdminClient } from "@/lib/supabase/admin";

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
  clienteTelefone: string | null;
  clienteEmail: string | null;
  clienteNascimento: string | null;
  clienteCidade: string | null;
  clienteEstado: string | null;
  finalidade: string | null;
  origem: string | null;
  docs: { rotulo: string; arquivos: { path: string; nome: string }[] }[];
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

export async function listarChecklistsPendentes(): Promise<ChecklistPendente[]> {
  const pub = createAdminClient().schema("public");
  const { data } = await pub
    .from("vendas_checklist")
    .select("*, profiles!vendas_checklist_corretor_id_fkey(nome)")
    .eq("status", "aguardando_aprovacao")
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as Linha[]).map((r) => ({
    id: r.id,
    corretorNome: r.profiles?.nome ?? null,
    construtora: r.construtora,
    empreendimento: r.empreendimento,
    unidade: r.unidade,
    torre: r.torre,
    valorContrato: Number(r.valor_contrato),
    clienteNome: r.cliente_nome,
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
    criadoEm: r.created_at,
  }));
}

export async function buscarChecklist(id: string): Promise<ChecklistPendente | null> {
  const todos = await listarChecklistsPendentes();
  return todos.find((c) => c.id === id) ?? null;
}
