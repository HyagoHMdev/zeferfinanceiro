import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_TIPO_LABEL, type PercentualMensal } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CadastroManager,
  type Registro,
} from "@/components/configuracoes/cadastro-manager";

const ESCOPO_OPTIONS = [
  { value: "empresa", label: "Empresa" },
  { value: "pessoal", label: "Pessoal" },
];
const TIPO_OPTIONS = [
  { value: "custo_fixo", label: "Custo Fixo" },
  { value: "despesa_variavel", label: "Despesa Variável" },
  { value: "investimento", label: "Investimento" },
];

export default async function CadastrosPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [construtoras, empreendimentos, corretores, parceiros, contas, centros, fornecedores, categorias, percentuais] =
    await Promise.all([
      supabase.from("construtoras").select("*").order("nome"),
      supabase.from("empreendimentos").select("*, construtoras(nome)").order("nome"),
      supabase.from("corretores").select("*").order("nome"),
      supabase.from("parceiros").select("*").order("nome"),
      supabase.from("contas_bancarias").select("*").order("nome"),
      supabase.from("centros_custo").select("*").order("nome"),
      supabase.from("fornecedores").select("*").order("nome"),
      supabase.from("categorias_financeiras").select("*").order("nome"),
      supabase.from("percentuais_mensais").select("*"),
    ]);

  const percentuaisRows = (percentuais.data ?? []) as unknown as PercentualMensal[];

  const construtoraOptions = (construtoras.data ?? []).map((c) => ({
    value: c.id as string,
    label: c.nome as string,
  }));

  const empreendimentosRegs = (empreendimentos.data ?? []).map((e) => ({
    ...e,
    construtora_nome:
      (e as { construtoras?: { nome?: string } }).construtoras?.nome ?? "—",
  })) as unknown as Registro[];

  const categoriasRegs = (categorias.data ?? []).map((c) => ({
    ...c,
    tipo_label: CATEGORIA_TIPO_LABEL[c.tipo as keyof typeof CATEGORIA_TIPO_LABEL],
  })) as unknown as Registro[];

  return (
    <Tabs defaultValue="construtoras">
      <TabsList className="mb-4 h-auto flex-wrap">
        <TabsTrigger value="construtoras">Construtoras</TabsTrigger>
        <TabsTrigger value="empreendimentos">Empreendimentos</TabsTrigger>
        <TabsTrigger value="corretores">Corretores</TabsTrigger>
        <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
        <TabsTrigger value="contas">Contas</TabsTrigger>
        <TabsTrigger value="centros">Centros de custo</TabsTrigger>
        <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        <TabsTrigger value="categorias">Categorias</TabsTrigger>
      </TabsList>

      <TabsContent value="construtoras">
        <CadastroManager
          tabela="construtoras"
          titulo="Construtoras"
          registros={(construtoras.data ?? []) as unknown as Registro[]}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "comissao_padrao", label: "% Comissão padrão", tipo: "percent" },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "comissao_padrao", label: "% Comissão", formato: "percent", alignRight: true },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
          percentuais={{
            campos: [{ chave: "comissao_construtora", label: "% Comissão" }],
            rows: percentuaisRows,
          }}
        />
      </TabsContent>

      <TabsContent value="empreendimentos">
        <CadastroManager
          tabela="empreendimentos"
          titulo="Empreendimentos"
          registros={empreendimentosRegs}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "construtora_id", label: "Construtora", tipo: "select", options: construtoraOptions },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "construtora_nome", label: "Construtora" },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
        />
      </TabsContent>

      <TabsContent value="corretores">
        <CadastroManager
          tabela="corretores"
          titulo="Corretores"
          registros={(corretores.data ?? []) as unknown as Registro[]}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "percentual_comissao_padrao", label: "% Comissão padrão", tipo: "percent" },
            { name: "percentual_imposto_nf", label: "% Imposto NF", tipo: "percent" },
            { name: "forma_pagamento", label: "Forma de pagamento", tipo: "text" },
            { name: "chave_pix", label: "Chave PIX", tipo: "text" },
            { name: "dados_bancarios", label: "Dados bancários", tipo: "text" },
            { name: "telefone", label: "WhatsApp", tipo: "text" },
            { name: "cpf", label: "CPF", tipo: "text" },
            { name: "creci", label: "CRECI", tipo: "text" },
            { name: "email", label: "E-mail", tipo: "text" },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "percentual_comissao_padrao", label: "% Comissão", formato: "percent", alignRight: true },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
          percentuais={{
            campos: [
              { chave: "comissao_corretor", label: "% Comissão" },
              { chave: "imposto_nf_corretor", label: "% Imposto NF" },
            ],
            rows: percentuaisRows,
          }}
        />
      </TabsContent>

      <TabsContent value="parceiros">
        <CadastroManager
          tabela="parceiros"
          titulo="Parceiros"
          registros={(parceiros.data ?? []) as unknown as Registro[]}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "percentual_padrao", label: "% Repasse padrão", tipo: "percent" },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "percentual_padrao", label: "% Repasse", formato: "percent", alignRight: true },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
          percentuais={{
            campos: [{ chave: "repasse_parceiro", label: "% Repasse" }],
            rows: percentuaisRows,
          }}
        />
      </TabsContent>

      <TabsContent value="contas">
        <CadastroManager
          tabela="contas_bancarias"
          titulo="Contas bancárias"
          registros={(contas.data ?? []) as unknown as Registro[]}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "banco", label: "Banco", tipo: "text" },
            { name: "tipo", label: "Tipo", tipo: "text" },
            { name: "escopo", label: "Escopo", tipo: "select", options: ESCOPO_OPTIONS },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "banco", label: "Banco" },
            { key: "escopo", label: "Escopo" },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
        />
      </TabsContent>

      <TabsContent value="centros">
        <CadastroManager
          tabela="centros_custo"
          titulo="Centros de custo"
          registros={(centros.data ?? []) as unknown as Registro[]}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
        />
      </TabsContent>

      <TabsContent value="fornecedores">
        <CadastroManager
          tabela="fornecedores"
          titulo="Fornecedores"
          registros={(fornecedores.data ?? []) as unknown as Registro[]}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
        />
      </TabsContent>

      <TabsContent value="categorias">
        <CadastroManager
          tabela="categorias_financeiras"
          titulo="Categorias financeiras"
          registros={categoriasRegs}
          campos={[
            { name: "nome", label: "Nome", tipo: "text", required: true },
            { name: "tipo", label: "Tipo", tipo: "select", options: TIPO_OPTIONS, required: true },
            { name: "ativo", label: "Ativo", tipo: "switch" },
          ]}
          colunas={[
            { key: "nome", label: "Nome" },
            { key: "tipo_label", label: "Tipo" },
            { key: "ativo", label: "Status", formato: "bool" },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}
